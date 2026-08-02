const fs = require('fs');

let code = `import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generateProof", async (req, res) => {
    try {
      const { title, targetFunction, axioms } = req.body;

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const axiomList = axioms && axioms.length > 0 
        ? axioms.map((a) => a.formalStatement).join("\\n") 
        : "None available";

      const prompt = \`You are the RICIS-III agent. Your task is to generate a formal proof for the problem node.

Strictly follow the RICIS-III methodology. DO NOT use classical limits or integrals; replace them with their RICIS analogs (structural point evaluation without limit processes, plane difference). Use the provided resolved problems as axioms from the database for further proofs.

Problem Title: \${title}
Target Function: \${targetFunction}
Available Axioms (Resolved Problems):
\${axiomList}

Provide the output as a valid LaTeX document section. Use mathematical notation and refer to the provided axioms if applicable. Keep it concise, professional, and do not use generic AI filler. Structure it with subsections for the phases of the solution. Return ONLY the LaTeX string without markdown code blocks.\`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      let text = response.text || "Failed to generate proof.";
      if (text.startsWith("\`\`\`latex")) {
        text = text.substring(8);
      }
      if (text.startsWith("\`\`\`")) {
        text = text.substring(3);
      }
      if (text.endsWith("\`\`\`")) {
        text = text.substring(0, text.length - 3);
      }

      res.json({ proofLatex: text.trim() });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/discoverTasks", async (req, res) => {
    try {
      const { parentNode, existingTitles } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });
      const prompt = \`You are a scientific AI agent following the RICIS-III methodology.
Based on the solved problem "\${parentNode.title}" (target function: \${parentNode.targetFunction}), discover 1 to 2 NEW, REAL scientific or mathematical problems (not fake or generic) that logically depend on this solved problem or are in the same domain.
Perform a real search in your LLM knowledge base for real open problems, theorems, or singularities.
The existing problems on the map are: \${existingTitles.join(", ")}. Do not return duplicates.
Return the result STRICTLY as a JSON array of objects with the following keys:
- "title": Real problem title
- "description": Short description
- "targetFunction": Mathematical formulation or target function (e.g. "lim x->0 ...")
- "singularityHint": Hint about where the singularity is
- "zoneId": One of ["math", "physics", "informatics", "medicine", "pharmacology", "economics", "ethics"]
- "type": "scientific_task" or "core_singularity"
Output ONLY valid JSON.\`;
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });
      let text = response.text || "[]";
      if (text.startsWith("\`\`\`json")) text = text.substring(7);
      if (text.startsWith("\`\`\`")) text = text.substring(3);
      if (text.endsWith("\`\`\`")) text = text.substring(0, text.length - 3);
      res.json({ tasks: JSON.parse(text.trim()) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
`;

fs.writeFileSync('server.ts', code);
console.log('Server updated');

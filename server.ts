import express from "express";
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
        ? axioms.slice(-3).map((a: any) => a.formalStatement).join("\n") 
        : "None available";

      const prompt = `You are the RICIS-III agent. Your task is to generate a formal proof for the problem node.
Problem Title: ${title}
Target Function: ${targetFunction}
Available Axioms:
${axiomList}

Follow the RICIS-III methodology. Provide the output as a valid LaTeX document section. Use mathematical notation and refer to the provided axioms if applicable. Keep it concise, professional, and do not use generic AI filler. Structure it with subsections for the phases of the solution. Return ONLY the LaTeX string without markdown code blocks.`;

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
    } catch (e: any) {
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
    console.log(`Server running on http://localhost:\${PORT}`);
  });
}

startServer();

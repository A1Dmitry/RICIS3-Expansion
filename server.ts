import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
            "User-Agent": "aistudio-build",
          },
        },
      });

      const axiomList =
        axioms && axioms.length > 0
          ? axioms.map((a) => a.formalStatement).join("\n")
          : "None available";

      const prompt = `You are the RICIS-III agent. Your task is to generate a formal proof for the problem node.

Strictly follow the RICIS-III methodology. DO NOT use classical limits or integrals; replace them with their RICIS analogs (structural point evaluation without limit processes, plane difference). Use the provided resolved problems as axioms from the database for further proofs.

Problem Title: ${title}
Target Function: ${targetFunction}
Available Axioms (Resolved Problems):
${axiomList}

Provide the output as a valid LaTeX document section. Use mathematical notation and refer to the provided axioms if applicable. Keep it concise, professional, and do not use generic AI filler.
STRICT LaTeX OUTPUT RULES:
1. Return ONLY a FRAGMENT: paragraphs and math environments. NO \\documentclass, NO \\usepackage, NO \\begin{document}, NO markdown.
2. DO NOT use \\section, \\subsection, or \\chapter. Use \\textbf{...} for headings instead.
3. ASCII math only: $\\infty$ $\\to$ $\\leq$ --- never unicode.
4. Pair every $. Pair every \\begin{env}/\\end{env}. Allowed: equation*, align*, itemize, enumerate.
5. Max 60 lines. No HTML, no JSON, no error messages.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      let text = response.text || "Failed to generate proof.";
      if (text.startsWith("```latex")) {
        text = text.substring(8);
      }
      if (text.startsWith("```")) {
        text = text.substring(3);
      }
      if (text.endsWith("```")) {
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
          headers: { "User-Agent": "aistudio-build" },
        },
      });
      const prompt = `You are a scientific AI agent following the RICIS-III methodology.
Based on the solved problem "${parentNode.title}" (target function: ${parentNode.targetFunction}), discover 1 to 2 NEW, REAL scientific or mathematical problems (not fake or generic) that logically depend on this solved problem or are in the same domain.
Perform a real search in your LLM knowledge base for real open problems, theorems, or singularities.
The existing problems on the map are: ${existingTitles.join(", ")}. Do not return duplicates.
Return the result STRICTLY as a JSON array of objects with the following keys:
- "title": Real problem title
- "description": Short description
- "targetFunction": Mathematical formulation or target function (e.g. "lim x->0 ...")
- "singularityHint": Hint about where the singularity is
- "zoneId": One of ["math", "physics", "informatics", "medicine", "pharmacology", "economics", "ethics"]
- "type": "scientific_task" or "core_singularity"
Output ONLY valid JSON.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      let text = response.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        text = match[0];
      }
      res.json({ tasks: JSON.parse(text.trim()) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/aiAssistantNode", async (req, res) => {
    try {
      const { title, targetFunction } = req.body;
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      const prompt = `You are a scientific AI assistant. The user wants to add a new problem to the RICIS-III map.
Title: ${title || "Not provided"}
Target Function (rough): ${targetFunction || "Not provided"}

Please do the following:
1. If Title is "Not provided" or very vague, generate a formal scientific title for this mathematical problem.
2. Normalize and strictly formalize the "Target Function" into a mathematical expression or limit involving a singularity (e.g. lim x->0 ... or Formalize(...)).
3. Provide a short, rigorous scientific description of the problem (in Russian).
4. Provide a hint about where the singularity is (in Russian).
5. Provide a relevant Wikipedia or scientific link (URL).

Return the result STRICTLY as a JSON object with the keys:
- "title": string
- "normalizedFunction": string
- "description": string
- "hint": string
- "link": string

Output ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      let text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        text = match[0];
      }
      res.json(JSON.parse(text.trim()));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fillNodeParams", async (req, res) => {
    try {
      const { id, title, description, singularityHint, type, zoneIds } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });

      const prompt = `You are the RICIS-III map curator. A problem node is missing its targetFunction (formal singularity expression).

Use scientific knowledge of open problems, Clay Millennium problems, classical singularities, and standard formulations (Wikipedia / textbooks / arXiv-style naming). Prefer real mathematical target functions when the title is recognizable.

Node id: ${id || "unknown"}
Title: ${title || "unknown"}
Current description: ${description || "(empty)"}
Singularity hint: ${singularityHint || "(empty)"}
Type: ${type || "scientific_task"}
Zones: ${Array.isArray(zoneIds) ? zoneIds.join(", ") : ""}

Return STRICT JSON only with keys:
- "targetFunction": string — formal expression or procedure name
- "description": string — short rigorous description in Russian (1–3 sentences)
- "singularityHint": string — where the singularity / obstruction sits (Russian, short)
- "title": string — keep or lightly normalize the title

Rules:
- Never leave targetFunction empty.
- Do not invent Clay prize claims unless the title clearly matches a known problem.
- Output ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      let text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      const parsed = JSON.parse(text.trim());
      if (!parsed.targetFunction || !String(parsed.targetFunction).trim()) {
        return res.status(502).json({ error: "agent_returned_empty_targetFunction" });
      }
      res.json({
        targetFunction: String(parsed.targetFunction).trim(),
        description: parsed.description ? String(parsed.description).trim() : undefined,
        singularityHint: parsed.singularityHint
          ? String(parsed.singularityHint).trim()
          : undefined,
        title: parsed.title ? String(parsed.title).trim() : undefined,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

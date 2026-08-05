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
          ? axioms.map((a: any, i: number) => `${i + 1}. ${a.title || a.id}: ${a.targetFunction || ""}`).join("\n")
          : "(no prior axioms)";

      const prompt = `You are the RICIS-III formal agent. Prove or construct a resolution for the singularity/problem using ONLY RICIS-III algebra (indexed zeros/infinities, SP2/A6 reductions, no classical limits or integrals).

Problem title: ${title}
Target function / expression: ${targetFunction || "(none)"}

Available axioms from the map (already resolved):
${axiomList}

Output STRICT LaTeX body (no \\section, no \\subsection, no documentclass). Use \\textbf for headings. Prefer constructive indexed-zero / SP2 steps. If partial, state remaining obstacles clearly.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "text/plain" },
      });

      const text = response.text || "";
      res.json({ proof: text, model: "gemini-2.0-flash" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/discoverTasks", async (req, res) => {
    try {
      const { existingTitles, zoneId, focus } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const prompt = `You are a RICIS-III discovery agent. Propose new scientific / mathematical problems that can be reduced via limit-free singularity algebra (SP2, A6, indexed 0/∞).
Zone focus: ${zoneId || "any"}. Extra focus: ${focus || "none"}.
Already on map (do not repeat): ${(Array.isArray(existingTitles) ? existingTitles : []).slice(0, 50).join("; ")}
Return STRICT JSON array of objects: title, description, targetFunction, zoneId, significance (0-1), dependencyHints (string array).
Prefer problems that extend core singularities or apply RICIS to physics/medicine/economics. Max 8 items. Output ONLY the JSON array.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      let text = response.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) text = match[0];
      let tasks = [];
      try {
        tasks = JSON.parse(text.trim());
      } catch {
        tasks = [];
      }
      if (!Array.isArray(tasks)) tasks = [];
      res.json({ tasks });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/aiAssistantNode", async (req, res) => {
    try {
      const { title, zoneId, hint } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const prompt = `Assist creating a RICIS-III map node.
Title draft: ${title || ""}
Zone: ${zoneId || "math"}
Hint: ${hint || ""}
Return STRICT JSON object with keys: title, description, targetFunction, significance (0-1 number), axiomsSuggested (string array). Keep targetFunction in RICIS style (indexed zeros, no lim). Output ONLY JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      let text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      let obj = {};
      try {
        obj = JSON.parse(text.trim());
      } catch {
        obj = { title: title || "Untitled", description: "", targetFunction: "", significance: 0.5 };
      }
      res.json(obj);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/fillNodeParams", async (req, res) => {
    try {
      const { title, description, zoneId } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const prompt = `Fill missing RICIS-III node parameters.
Title: ${title || ""}
Description: ${description || ""}
Zone: ${zoneId || "math"}
Return STRICT JSON: targetFunction (RICIS expression preferred), significance (0-1), shortProofSketch (plain text or simple LaTeX without section), tags (string array). Output ONLY JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      let text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      let obj = {};
      try {
        obj = JSON.parse(text.trim());
      } catch {
        obj = {};
      }
      res.json(obj);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  /**
   * Priority / derivative audit: find works that reuse RICIS-III semantics
   * (limit-free singularity resolution, SP2/A6, indexed zeros) even under rename.
   */
  app.post("/api/searchDerivatives", async (req, res) => {
    try {
      const { prompt, existingTitles } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const fallbackPrompt = `You are a scientific priority auditor for RICIS-III.
Find EXTERNAL works that reuse limit-free singularity algebra (0/0, 0*inf, indexed zeros) without citing Aleynikov/RICIS.
Return STRICT JSON array of objects: title, description, sourceUrl, firstMentionDate, zoneId, matchedSignatures, score, relevantNodeIds, authors.
Exclude official RICIS deposits. Prefer score>=0.55. If none, return [].
Already on map: ${Array.isArray(existingTitles) ? existingTitles.slice(0, 40).join("; ") : ""}
Output ONLY valid JSON array.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: typeof prompt === "string" && prompt.length > 100 ? prompt : fallbackPrompt,
        config: { responseMimeType: "application/json" },
      });

      let text = response.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) text = match[0];
      let hits = [];
      try {
        hits = JSON.parse(text.trim());
      } catch {
        hits = [];
      }
      if (!Array.isArray(hits)) hits = [];
      res.json({ hits });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
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

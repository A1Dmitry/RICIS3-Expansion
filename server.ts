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

            const prompt = `Ты формальный агент RICIS-III. Докажи или построй решение для сингулярности/проблемы, используя ТОЛЬКО алгебру RICIS-III (индексированные нули/бесконечности, редукции SP2/A6, без классических пределов и интегралов). Отвечай строго на русском языке!

Название проблемы: ${title}
Целевая функция / выражение: ${targetFunction || "(нет)"}

Доступные аксиомы с карты (уже решенные):
${axiomList}

ВЫВЕДИ СТРОГИЙ ТЕКСТ LaTeX (без \\section, без \\subsection, без documentclass). Используй \\textbf для заголовков. Предпочитай конструктивные шаги с нулями-индексами и SP2. Если решение частичное, четко укажи оставшиеся препятствия.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "text/plain" },
      });

      const text = response.text || "";
      res.json({ proof: text, model: "gemini-3.6-flash" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/discoverTasks", async (req, res) => {
    try {
            const { existingTitles, parentNode } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const zoneId = parentNode && parentNode.zoneIds && parentNode.zoneIds.length > 0 ? parentNode.zoneIds[0] : "any";
      const prompt = `Ты агент-исследователь RICIS-III. Предложи новые научные или математические проблемы, которые можно свести к алгебре сингулярностей без пределов (SP2, A6, индексированные 0/∞).
Зона науки (zoneId): ${zoneId}. Опора: ${parentNode ? parentNode.title : "нет"}.
Уже на карте (не повторяй): ${(Array.isArray(existingTitles) ? existingTitles : []).slice(0, 50).join("; ")}
Верни СТРОГИЙ JSON массив объектов: title (строка), description (строка), targetFunction (строка), zoneId (строка - ДОЛЖНА БЫТЬ ${zoneId}), significance (число 0-1), singularityHint (строка).
Предпочитай проблемы, расширяющие ядро сингулярностей или применяющие RICIS к биологии, химии, экологии, медицине, физике, экономике. Максимум 8 элементов. Выведи ТОЛЬКО JSON массив.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
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
        model: "gemini-3.6-flash",
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
            const { title, description, zoneIds } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const zoneStr = Array.isArray(zoneIds) && zoneIds.length > 0 ? zoneIds.join(", ") : "math";
      const prompt = `Заполни недостающие параметры узла RICIS-III.
Название: ${title || ""}
Описание: ${description || ""}
Зона: ${zoneStr}
Верни СТРОГИЙ JSON: targetFunction (строка, предпочтительно выражение RICIS-III), significance (число 0-1), shortProofSketch (простой текст без секций), tags (массив строк).
Выведи ТОЛЬКО JSON объект.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
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

            const fallbackPrompt = `Ты аудитор научного приоритета для RICIS-III.
Найди ВНЕШНИЕ работы, которые переиспользуют алгебру сингулярностей без пределов (0/0, 0*inf, индексированные нули) без ссылки на Алейникова/RICIS.
Верни СТРОГИЙ JSON массив объектов: title, description, sourceUrl, firstMentionDate, zoneId, matchedSignatures, score, relevantNodeIds, authors.
Исключай официальные депозиты RICIS. Предпочитай score>=0.55. Если ничего не найдено, верни [].
Уже на карте: ${Array.isArray(existingTitles) ? existingTitles.slice(0, 40).join("; ") : ""}
Отвечай СТРОГО на РУССКОМ ЯЗЫКЕ. Выведи ТОЛЬКО валидный JSON массив.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
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

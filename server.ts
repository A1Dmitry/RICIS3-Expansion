import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";


const MODELS_POOL = [
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-3.6-flash"
];

async function callAIWithFallback(ai: any, prompt: string, responseMimeType = "text/plain", preferredModel?: string) {
  let pool = [...MODELS_POOL];
  if (preferredModel && pool.includes(preferredModel)) {
    pool = [preferredModel, ...pool.filter(m => m !== preferredModel)];
  }
  let lastError = null;
  for (const model of pool) {
    try {
      console.log("[AI] Attempting to call model: " + model);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType },
      });
      console.log("[AI] Successfully called model: " + model);
      return { text: response.text || "", model };
    } catch (e: any) {
      console.warn("[AI] Model " + model + " failed: " + e.message);
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error("All AI models in the pool failed.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generateProof", async (req, res) => {
    try {
      const { title, targetFunction, axioms, preferredModel } = req.body || {};

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

            const prompt = `Ты формальный аналитический агент RICIS-III v7.7 (Recursive Indexed Calculus of Identity and Singularity). Твоя задача — строго и полно формализовать, проанализировать и разрешить математическую или физическую сингулярность, опираясь ИСКЛЮЧИТЕЛЬНО на аксиомы RICIS-III.

СТРОГИЕ ЗАПРЕТЫ:
1. Запрещено использовать заглушки ("0_E", "Reduced(E)", "Result = Result" и т.д.). Каждая переменная и индекс должны отражать реальные физические или математические сущности задачи.
2. Запрещено использовать классические пределы (\\lim), эпсилон-дельта переходы и непрерывные интегралы Римана/Лебега.
3. Запрещено считать 0/0 и 0 * \\infty неопределенностями — это рабочие структурные узлы с топологической информацией.

ГЕОМЕТРИЧЕСКИЙ МОСТ (ОБЯЗАТЕЛЬНЫЙ МЕХАНИЗМ РАЗРЕШЕНИЯ):
Каждая неопределенность вида 0_F * \\infty_G разрешается через косое произведение (детерминант) двух ортогональных векторов:
- Вектор исчезающего термина: u = (F, 0)
- Вектор дивергирующего термина: v = (0, G)
- Инвариант: det(u, v) = u_x * v_y - u_y * v_x = F * G - 0 = F * G.
Это вычисление должно быть явно расписано в доказательстве.

ПРОТОКОЛЫ БЕЗОПАСНОСТИ И ФАЗЫ:
- [Phase -1] L1_IDENTITY: Проверь тип и сохранность идентичности.
- [Phase 0] Remove limits: Отмена пределов, вычисление на ядре через Eval_RICIS.
- [Phase 0.5] SEMANTIC INDEXING (SP4): Индексируй нули и бесконечности их порождающими алгебраическими выражениями (например, 0_{(x^2-4)}, а НЕ 0_0).
- [Phase 1] SAFETY CHECK (SP2): Алгебраическое сокращение и факторизация идентичных факторов ДО вычисления сингулярности.
- [Phase 2] RICIS TRANSFORMS (A6): Примени косое произведение u = (F, 0), v = (0, G), det(u, v) = F * G.
- [Phase 6] L1 VERIFICATION: Подтверждение стабильного инварианта за O(1).

Название проблемы: ${title}
Целевая функция / выражение: ${targetFunction || "(нет)"}

Доступные аксиомы с карты (уже решенные):
${axiomList}

ТРЕБОВАНИЯ К ФОРМАТУ:
Выведи СТРОГИЙ ТЕКСТ LaTeX (без \\documentclass, без \\section). Используй \\textbf для заголовков фаз. Все формулы оборачивай в стандартные LaTeX блоки ($...$ или $$...$$). Напиши подробное, математически завершенное доказательство строго на РУССКОМ ЯЗЫКЕ.`;

      const response = await callAIWithFallback(ai, prompt, "text/plain", preferredModel);

      const text = response.text || "";
      res.json({ proof: text, model: response.model });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/discoverTasks", async (req, res) => {
    try {
      const { existingTitles, parentNode, existingZones, preferredModel } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const zoneId = parentNode && parentNode.zoneIds && parentNode.zoneIds.length > 0 ? parentNode.zoneIds[0] : "any";
      const prompt = `Ты агент-исследователь RICIS-III. Предложи новые научные или математические проблемы, которые можно свести к алгебре сингулярностей без пределов (SP2, A6, индексированные 0/∞).
Опора: ${parentNode ? parentNode.title : "нет"}. Зона опоры: ${zoneId}.
Уже на карте (не повторяй): ${(Array.isArray(existingTitles) ? existingTitles : []).slice(0, 50).join("; ")}
Существующие зоны науки: ${(Array.isArray(existingZones) ? existingZones : []).join(", ")}.
Верни СТРОГИЙ JSON массив объектов: title (строка), description (строка), targetFunction (строка), zoneId (строка - ID научной области на английском. Используй одну из существующих зон, ИЛИ если проблема совсем в них не попадает, придумай НОВЫЙ ID, например finance, ecology), significance (число 0-1), singularityHint (строка).
Предпочитай проблемы, расширяющие ядро сингулярностей или применяющие RICIS к новым дисциплинам. Максимум 8 элементов. Выведи ТОЛЬКО JSON массив.`;

      const response = await callAIWithFallback(ai, prompt, "application/json", preferredModel);

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
      res.json({ tasks, model: response.model });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/aiAssistantNode", async (req, res) => {
    try {
      const { title, zoneId, hint, preferredModel } = req.body || {};
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const prompt = `Assist creating a RICIS-III map node.
Title draft: ${title || ""}
Zone: ${zoneId || "math"}
Hint: ${hint || ""}
Return STRICT JSON object with keys: title, description, targetFunction, significance (0-1 number), axiomsSuggested (string array). Keep targetFunction in RICIS style (indexed zeros, no lim). Output ONLY JSON.`;

      const response = await callAIWithFallback(ai, prompt, "application/json", preferredModel);

      let text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      let obj: any = {};
      try {
        obj = JSON.parse(text.trim());
      } catch {
        obj = { title: title || "Untitled", description: "", targetFunction: "", significance: 0.5 };
      }
      res.json({ ...obj, model: response.model });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/fillNodeParams", async (req, res) => {
    try {
      const { title, description, zoneIds, preferredModel } = req.body || {};
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

      const response = await callAIWithFallback(ai, prompt, "application/json", preferredModel);

      let text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];
      let obj: any = {};
      try {
        obj = JSON.parse(text.trim());
      } catch {
        obj = {};
      }
      res.json({ ...obj, model: response.model });
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
      const { prompt, existingTitles, preferredModel } = req.body || {};
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

      const response = await callAIWithFallback(ai, typeof prompt === "string" && prompt.length > 100 ? prompt : fallbackPrompt, "application/json", preferredModel);

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
      res.json({ hits, model: response.model });
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

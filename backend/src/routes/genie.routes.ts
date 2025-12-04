import { Router } from "express";
import axios from "axios";
import type { Request, Response } from "express";

const router = Router();

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const SUMMARIZER_URL = (process.env.SUMMARIZER_URL || "").trim();

router.post("/", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const systemInstruction = String(req.body?.systemInstruction || "").trim();
    if (!prompt) return res.status(400).json({ message: "prompt required" });

    const payload = {
      contents: [
        {
          parts: [
            ...(systemInstruction ? [{ text: systemInstruction }] : []),
            { text: prompt },
          ],
        },
      ],
    };

    // If no API key, return a minimal fallback
    if (!GEMINI_API_KEY) {
      return res.json({ text: "Gemini API key not configured. Please set GEMINI_API_KEY." });
    }

    const { data } = await axios.post(`${API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, payload, {
      timeout: 10000,
    });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.json({ text });
  } catch (err: any) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err?.message || "Gemini request failed";
    return res.status(status).json({ message });
  }
});

router.post("/summarize-text", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "text required" });

    if (SUMMARIZER_URL) {
      try {
        const url = `${SUMMARIZER_URL.replace(/\/$/, "")}/summarize`;
        const { data } = await axios.post(url, { text }, { timeout: 20000 });
        const t = data?.summary || data?.text || "";
        return res.json({ text: t });
      } catch {}
    }

    if (!GEMINI_API_KEY) {
      return res.json({ text: "Gemini API key not configured." });
    }

    const maxChunk = 20000;
    const overlap = 500;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxChunk - overlap) {
      chunks.push(text.slice(i, i + maxChunk));
    }

    const partials: string[] = [];
    for (const chunk of chunks) {
      const payload = {
        contents: [
          {
            parts: [
              { text: "Summarize this portion in 2-3 sentences, focusing on plot, characters, mood." },
              { text: chunk },
            ],
          },
        ],
      };
      const { data } = await axios.post(`${API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, payload, { timeout: 15000 });
      const part = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (part) partials.push(part);
    }

    const combinePayload = {
      contents: [
        {
          parts: [
            { text: "Combine these short summaries into one coherent paragraph." },
            { text: partials.join("\n") },
          ],
        },
      ],
    };
    const { data: combineData } = await axios.post(`${API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, combinePayload, { timeout: 15000 });
    const finalText = combineData?.candidates?.[0]?.content?.parts?.[0]?.text || partials.join(" \n");
    return res.json({ text: finalText });
  } catch (err: any) {
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.error?.message || err?.message || "Summarize request failed";
    return res.status(status).json({ message });
  }
});

// duplicate removed in favor of single proxy-first, Gemini-fallback route

export default router;

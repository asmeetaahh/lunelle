import { Router } from "express";

import { generateReflection, isAiConfigured } from "../services/ai.js";

import {
  getJournalById,
} from "../db/journalStore.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    if (!isAiConfigured) {
      console.error(
        "AI chat request received but Featherless is not configured (missing FEATHERLESS_API_KEY/FEATHERLESS_MODEL).",
      );
      return res.status(503).json({
        error: "The AI companion isn't available right now. Please try again later.",
      });
    }

    const {
    journalId,
    cycleDay,
    cycleLength,
    phase,
    mood,
    symptoms,
    journalEntry,
    message,
  } = req.body;

    // Preferred flow:
    // If a journalId is provided and still resolves to a real entry, use
    // that journal as the AI's context. A missing/blank/stale journalId is
    // treated the same as "no journal" below, rather than as an error.
    let journal = null;

    if (journalId !== undefined && journalId !== null) {
      const id = String(journalId).trim();

      if (id) {
        journal = await getJournalById(id);
      }
    }

    let context;

    if (journal) {
      context = {
        cycleDay: journal.cycleDay,
        cycleLength: journal.cycleLength,
        phase: journal.phase,
        mood: journal.mood,
        symptoms: journal.symptoms,
        journalEntry: journal.entry,
        userMessage: message || '',
      };
    } else {
      // No journal to draw from (none provided, or the id no longer
      // resolves to an entry). This is not an error case — respond using
      // the user's message plus whatever cycle context the client sent.
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          error: "message is required when no journal entry is available",
        });
      }

      context = {
        cycleDay,
        cycleLength,
        phase,
        mood,
        symptoms,
        journalEntry:
          journalEntry && typeof journalEntry === "string" && journalEntry.trim()
            ? journalEntry.trim()
            : null,
        userMessage: message.trim(),
      };
    }

    const result = await generateReflection(context);

    res.json(result);
  } catch (error) {
    console.error("AI error:", error);

    const status = error?.status;

    if (status === 401 || status === 403) {
      // Auth failure talking to Featherless almost always means a bad/expired
      // API key — a configuration problem, not something the user caused.
      return res.status(503).json({
        error: "The AI companion isn't available right now. Please try again later.",
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: "Lunelle AI is a little busy right now. Please try again in a moment.",
      });
    }

    if (typeof status === "number" && status >= 500) {
      return res.status(502).json({
        error: "Lunelle AI is temporarily unavailable. Please try again shortly.",
      });
    }

    res.status(500).json({
      error: "Lunelle AI could not generate a reflection. Please try again.",
    });
  }
});

export default router;
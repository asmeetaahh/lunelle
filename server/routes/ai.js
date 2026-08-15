import { Router } from "express";

import { generateReflection } from "../services/ai.js";

import {
  getJournalById,
} from "../db/journalStore.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
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

    res.status(500).json({
      error: "Lunelle AI could not generate a reflection.",
    });
  }
});

export default router;
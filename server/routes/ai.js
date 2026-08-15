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
    } = req.body;

    let context;

    // Preferred flow:
    // Frontend sends journalId and backend retrieves the journal.
    if (journalId !== undefined) {
      const id = Number(journalId);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
          error: "journalId must be a positive integer",
        });
      }

      const journal = getJournalById(id);

      if (!journal) {
        return res.status(404).json({
          error: "Journal entry not found",
        });
      }

      context = {
        cycleDay: journal.cycleDay,
        cycleLength: journal.cycleLength,
        phase: journal.phase,
        mood: journal.mood,
        symptoms: journal.symptoms,
        journalEntry: journal.entry,
      };
    } else {
      // Backwards-compatible flow:
      // Frontend can still send the journal data directly.
      if (
        !journalEntry ||
        typeof journalEntry !== "string" ||
        !journalEntry.trim()
      ) {
        return res.status(400).json({
          error: "journalId or journalEntry is required",
        });
      }

      context = {
        cycleDay,
        cycleLength,
        phase,
        mood,
        symptoms,
        journalEntry: journalEntry.trim(),
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
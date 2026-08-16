import { Router } from "express";

import {
  getAllJournals,
  getJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
} from "../db/journalStore.js";

const router = Router();

// Loose, type-level validation for the fields the frontend's Journal data
// model (src/lib/journal.js) actually sends. Deliberately does not hardcode
// the allowed mood keys here — that list already lives in JOURNAL_MOODS on
// the frontend, and duplicating it server-side would create a second source
// of truth that could drift.
function isValidMood(mood) {
  return mood === undefined || mood === null || (typeof mood === "string" && mood.trim().length > 0);
}

function isValidSymptoms(symptoms) {
  return (
    symptoms === undefined ||
    symptoms === null ||
    (Array.isArray(symptoms) && symptoms.every((item) => typeof item === "string"))
  );
}

function isValidNullableNumber(value) {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidNullableString(value) {
  return value === undefined || value === null || typeof value === "string";
}

function validateJournalFields({ title, mood, symptoms, cycleDay, cycleLength, phase }) {
  if (title !== undefined && typeof title !== "string") {
    return "title must be a string";
  }
  if (!isValidMood(mood)) {
    return "mood must be a non-empty string or null";
  }
  if (!isValidSymptoms(symptoms)) {
    return "symptoms must be an array of strings";
  }
  if (!isValidNullableNumber(cycleDay)) {
    return "cycleDay must be a number or null";
  }
  if (!isValidNullableNumber(cycleLength)) {
    return "cycleLength must be a number or null";
  }
  if (!isValidNullableString(phase)) {
    return "phase must be a string or null";
  }
  return null;
}


// GET /api/journal
router.get("/", async (req, res) => {
  try {
    const journals = await getAllJournals();

    res.json({
      journals,
    });
  } catch (error) {
    console.error("Get journals error:", error);

    res.status(500).json({
      error: "Could not retrieve journal entries",
    });
  }
});


// GET /api/journal/:id
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const journal = await getJournalById(id);

    if (!journal) {
      return res.status(404).json({
        error: "Journal entry not found",
      });
    }

    res.json(journal);
  } catch (error) {
    console.error("Get journal error:", error);

    res.status(500).json({
      error: "Could not retrieve journal entry",
    });
  }
});


// POST /api/journal
router.post("/", async (req, res) => {
  try {
    const {
    title,
    entry,
    mood,
    symptoms,
    cycleDay,
    cycleLength,
    phase,
  } = req.body;

    if (!entry || typeof entry !== "string" || !entry.trim()) {
      return res.status(400).json({
        error: "Journal entry is required",
      });
    }

    const validationError = validateJournalFields({ title, mood, symptoms, cycleDay, cycleLength, phase });
    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const journal = await createJournal({
    title: title?.trim() || '',
    entry: entry.trim(),
    mood,
    symptoms,
    cycleDay,
    cycleLength,
    phase,
  });

    res.status(201).json(journal);
  } catch (error) {
    console.error("Create journal error:", error);

    res.status(500).json({
      error: "Could not create journal entry",
    });
  }
});


// PUT /api/journal/:id
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { title, entry, mood, symptoms, cycleDay, cycleLength, phase } = req.body ?? {};

    if (entry !== undefined && (typeof entry !== "string" || !entry.trim())) {
      return res.status(400).json({
        error: "Journal entry cannot be empty",
      });
    }

    const validationError = validateJournalFields({ title, mood, symptoms, cycleDay, cycleLength, phase });
    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const updates = { ...req.body };
    if (entry !== undefined) updates.entry = entry.trim();
    if (title !== undefined) updates.title = title.trim();

    const journal = await updateJournal(id, updates);

    if (!journal) {
      return res.status(404).json({
        error: "Journal entry not found",
      });
    }

    res.json(journal);
  } catch (error) {
    console.error("Update journal error:", error);

    res.status(500).json({
      error: "Could not update journal entry",
    });
  }
});


// DELETE /api/journal/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const deleted = await deleteJournal(id);

    if (!deleted) {
      return res.status(404).json({
        error: "Journal entry not found",
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Delete journal error:", error);

    res.status(500).json({
      error: "Could not delete journal entry",
    });
  }
});


export default router;
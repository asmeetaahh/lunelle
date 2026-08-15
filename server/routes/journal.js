import { Router } from "express";

import {
  getAllJournals,
  getJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
} from "../db/journalStore.js";

const router = Router();


// GET /api/journal
router.get("/", (req, res) => {
  res.json({
    journals: getAllJournals(),
  });
});


// GET /api/journal/:id
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);

  const journal = getJournalById(id);

  if (!journal) {
    return res.status(404).json({
      error: "Journal entry not found",
    });
  }

  res.json(journal);
});


// POST /api/journal
router.post("/", (req, res) => {
  const {
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

  const journal = createJournal({
    entry: entry.trim(),
    mood,
    symptoms,
    cycleDay,
    cycleLength,
    phase,
  });

  res.status(201).json(journal);
});


// PUT /api/journal/:id
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);

  const journal = updateJournal(id, req.body);

  if (!journal) {
    return res.status(404).json({
      error: "Journal entry not found",
    });
  }

  res.json(journal);
});


// DELETE /api/journal/:id
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  const deleted = deleteJournal(id);

  if (!deleted) {
    return res.status(404).json({
      error: "Journal entry not found",
    });
  }

  res.status(204).send();
});


export default router;
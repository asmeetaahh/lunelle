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
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid journal ID",
      });
    }

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

    const journal = await createJournal({
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
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid journal ID",
      });
    }

    const journal = await updateJournal(id, req.body);

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
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid journal ID",
      });
    }

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
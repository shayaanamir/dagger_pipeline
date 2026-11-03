const express = require("express");

const router = express.Router();

// In-memory store keeps the demo app dependency-free
let notes = [];
let nextId = 1;

router.get("/", (req, res) => {
  res.json(notes);
});

router.get("/:id", (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
});

router.post("/", (req, res) => {
  const { title, body = "" } = req.body || {};
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const note = { id: nextId++, title: title.trim(), body, createdAt: new Date().toISOString() };
  notes.push(note);
  res.status(201).json(note);
});

router.delete("/:id", (req, res) => {
  const before = notes.length;
  notes = notes.filter((n) => n.id !== Number(req.params.id));
  if (notes.length === before) return res.status(404).json({ error: "Note not found" });
  res.status(204).end();
});

// Test helper to start each test with an empty store
router.reset = () => {
  notes = [];
  nextId = 1;
};

module.exports = router;

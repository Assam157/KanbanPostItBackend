 const express = require('express');
const auth = require('../middleware/auth');
const Board = require('../models/Board');
const Task = require('../models/Task');
const router = express.Router();

// Middleware: board member or admin
const boardMemberOrAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();   // admins bypass membership
    const board = await Board.findById(req.params.id);
    if (!board || !board.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    req.board = board;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Create a new board (any authenticated user)
router.post('/', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const board = await Board.create({ title, members: [req.user.id], createdBy: req.user.id });
    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// Get all boards for the logged‑in user (admins see all boards)
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { members: req.user.id };
    const boards = await Board.find(query).populate('members', 'name email');
    res.json(boards);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// Get a single board (admin or member)
router.get('/:id', auth, boardMemberOrAdmin, async (req, res) => {
  try {
    const board = await Board.findById(req.params.id).populate('members', 'name email');
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get board' });
  }
});

// Join a board (admin can join any board)
router.post('/:id/join', auth, async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!board.members.includes(req.user.id)) {
      board.members.push(req.user.id);
      await board.save();
    }
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: 'Failed to join board' });
  }
});

// Get all tasks for a board (admin or member)
router.get('/:id/tasks', auth, boardMemberOrAdmin, async (req, res) => {
  try {
    const tasks = await Task.find({ boardId: req.params.id });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Create a task in a board (admin or member)
router.post('/:id/tasks', auth, boardMemberOrAdmin, async (req, res) => {
  try {
    const { title, description, deadline, status } = req.body;
    const task = await Task.create({
      boardId: req.params.id,
      userId: req.user.id,
      title,
      description: description || '',
      deadline: deadline || null,
      status: status || 'todo',
    });
    req.io.to(req.params.id.toString()).emit('taskCreated', { task });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

module.exports = router;
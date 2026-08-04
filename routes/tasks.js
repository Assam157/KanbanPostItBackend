 const express = require('express');
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Board = require('../models/Board');
const User = require('../models/User');
const router = express.Router();

// Middleware: board member or admin
const boardMemberOrAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();
    const board = await Board.findById(req.params.boardId);
    if (!board || !board.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Not a board member' });
    }
    req.board = board;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------------------------------------------------
// PERSONAL TASKS (no boardId)
// ------------------------------------------------------------

// GET personal tasks
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({
      userId: req.user.id,
      boardId: { $exists: false }
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST personal task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, deadline } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const task = new Task({
      userId: req.user.id,
      title,
      description: description || '',
      deadline: deadline || null,
      status: 'todo',
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH personal task (move) – optional, but your personal board also uses moveTask
router.patch('/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, userId: req.user.id, boardId: { $exists: false } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { status } = req.body;
    if (status && ['todo', 'inprogress', 'done'].includes(status)) {
      task.status = status;
      await task.save();
      res.json(task);
    } else {
      res.status(400).json({ error: 'Invalid status' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE personal task
router.delete('/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, userId: req.user.id, boardId: { $exists: false } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------------------------------------
// COLLABORATIVE BOARD TASKS (with boardId in params)
// ------------------------------------------------------------

// Update task status (move)
router.patch('/:boardId/tasks/:taskId', auth, boardMemberOrAdmin, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, boardId: req.params.boardId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { status } = req.body;
    if (status && ['todo', 'inprogress', 'done'].includes(status)) {
      task.status = status;
      await task.save();
      req.io.to(req.params.boardId).emit('taskUpdated', { task, changedBy: req.user.id });
      res.json(task);
    } else {
      res.status(400).json({ error: 'Invalid status' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete collaborative task
router.delete('/:boardId/tasks/:taskId', auth, boardMemberOrAdmin, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, boardId: req.params.boardId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await task.deleteOne();
    req.io.to(req.params.boardId).emit('taskDeleted', { taskId: task._id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------------------------------------
// ADMIN ROUTES (unchanged)
// ------------------------------------------------------------
router.get('/admin/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const users = await User.aggregate([
      { $match: { role: 'user' } },
      {
        $lookup: {
          from: 'tasks',
          localField: '_id',
          foreignField: 'userId',
          as: 'tasks',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          flagged: 1,
          taskCount: { $size: '$tasks' },
        },
      },
    ]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/admin/users/:userId/flag', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.flagged = !user.flagged;
    await user.save();
    res.json({ userId: user._id, flagged: user.flagged });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/admin/users/:userId/tasks', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const tasks = await Task.find({ userId: req.params.userId });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
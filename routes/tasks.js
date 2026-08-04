const express = require('express');
const Task = require('./models/Task');
const User = require('./models/User');
const auth = require('./middleware/auth');

const router = express.Router();

// Get all tasks for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, deadline, status } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const task = new Task({
      userId: req.user.id,
      title,
      description: description || '',
      deadline: deadline || null,
      status: status || 'todo',
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update task status (move)
router.patch('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    // owner or admin
    if (task.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { status } = req.body;
    if (status && ['todo', 'inprogress', 'done'].includes(status)) {
      task.status = status;
    }
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: get all users with task counts
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

// Admin: toggle user flag
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

// Admin: get tasks for a specific user
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

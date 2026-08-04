const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // creator
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['todo', 'inprogress', 'done'], default: 'todo' },
  deadline: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
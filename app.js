 const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIo = require('socket.io');

dotenv.config();

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const timeRoutes = require('./routes/time');
const boardRoutes = require('./routes/boards');
const aiRoutes = require('./routes/ai');   // keep if you have AI

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const io = socketIo(server, {
  cors: { origin: '*' } // adjust in production
});

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/ai', aiRoutes);   // optional

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Socket.IO events
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('joinBoard', (boardId) => {
    socket.join(boardId);
    console.log(`Socket ${socket.id} joined board ${boardId}`);
  });
  socket.on('leaveBoard', (boardId) => {
    socket.leave(boardId);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
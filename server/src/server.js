const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const multer = require('multer');
const env = require('./config/env');
const rateLimiter = require('./middleware/rateLimiter');
const chatRoutes = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - exact origin contract
const allowedOrigins = [
  'http://localhost:3000',
  env.frontendUrl,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing and compression
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Rate limiting
app.use('/api/auth', rateLimiter.authLimiter);
app.use('/api/chat', rateLimiter.chatLimiter);
app.use('/api/documents', rateLimiter.documentLimiter);
app.use('/api', rateLimiter.apiLimiter);

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);

// Multer-specific errors -> 400
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size must be less than 10MB'
        : err.message;
    return res.status(400).json({ error: message });
  }

  if (err.message && err.message.includes('Only PDF')) {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  next(err);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 && env.nodeEnv === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(statusCode).json({ error: message });
});

// Start server
const PORT = env.port;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Frontend origin: ${env.frontendUrl}`);
  console.log(`   Environment: ${env.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;

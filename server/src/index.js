require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const cron = require('node-cron');

const stockRoutes = require('./routes/stocks');
const portfolioRoutes = require('./routes/portfolio');
const aiRoutes = require('./routes/ai');
const valuationRoutes = require('./routes/valuation');
const reportRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const { scrapeGSEData } = require('./scrapers/gseScraper');

const app = express();
const PORT = process.env.PORT || 5001;

// Trust the first proxy (Render, Heroku, nginx, etc.) so that express-rate-limit
// can read the real client IP from the X-Forwarded-For header correctly.
app.set('trust proxy', 1);

// Security & Performance Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('dev'));

// CORS — allow all localhost origins in development
const rawClientUrl = process.env.CLIENT_URL || '';
const clientUrl = rawClientUrl.startsWith('http') ? rawClientUrl : `https://${rawClientUrl}`;
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [clientUrl]
  : true; // allow all in dev (any port)

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Body Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting (exclude health check)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.path === '/api/health' || req.path === '/health',
});
app.use('/api/', limiter);

// Disable caching for all API responses — prevents 304 Not Modified in browsers/proxies
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/valuation', valuationRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server immediately — don't wait for MongoDB
const server = app.listen(PORT, () => {
  const url = process.env.NODE_ENV === 'production'
    ? `https://gse-analyser-server.onrender.com`
    : `http://localhost:${PORT}`;
  console.log(`🚀 GSE Analyser Server running on ${url}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Kill the existing process or change PORT in server/.env`);
    process.exit(1);
  } else {
    throw err;
  }
});

// MongoDB Connection (non-blocking)
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gse_analyser', {
    serverSelectionTimeoutMS: 5000,
  })
  .then(async () => {
    console.log(`✅ MongoDB connected — database: ${mongoose.connection.db.databaseName}`);

    // Seed sample data on first run
    const { seedSampleData } = require('./scrapers/gseScraper');
    const Stock = require('./models/Stock');
    const count = await Stock.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding sample GSE stock data...');
      await seedSampleData();
    }

    // Schedule GSE data scraping every 30 minutes during trading hours (Mon-Fri, 9am-5pm Accra)
    cron.schedule('*/30 9-17 * * 1-5', async () => {
      console.log('🔄 Running scheduled GSE scrape...');
      await scrapeGSEData();
    }, { timezone: 'Africa/Accra' });
  })
  .catch((err) => {
    console.error('⚠️  MongoDB connection failed:', err.message);
    console.error('   Please ensure MongoDB is running: brew services start mongodb-community');
    console.error('   Or set MONGODB_URI in server/.env to a MongoDB Atlas connection string');
    console.error('   Server is still running but database features will not work.');
  });

module.exports = app;

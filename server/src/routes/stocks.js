const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const { scrapeGSEData } = require('../scrapers/gseScraper');
const { analyzeStock } = require('../services/aiService');

// GET /api/stocks - List all stocks
router.get('/', async (req, res, next) => {
  try {
    const { sector, search, sort = 'ticker', limit = 50, page = 1 } = req.query;
    const filter = {};
    if (sector) filter.sector = sector;
    if (search) {
      filter.$or = [
        { ticker: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const stocks = await Stock.find(filter)
      .select('-priceHistory')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();
    const total = await Stock.countDocuments(filter);

    res.json({ stocks, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/sectors - Get distinct sectors
router.get('/sectors', async (req, res, next) => {
  try {
    const sectors = await Stock.distinct('sector');
    res.json(sectors.filter(Boolean));
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/market-summary - Top movers & market stats
router.get('/market-summary', async (req, res, next) => {
  try {
    const allStocks = await Stock.find().select('-priceHistory').lean();
    const sorted = [...allStocks].sort((a, b) => parseFloat(b.changePct) - parseFloat(a.changePct));
    const topGainers = sorted.slice(0, 5);
    const topLosers = [...allStocks]
      .sort((a, b) => parseFloat(a.changePct) - parseFloat(b.changePct))
      .slice(0, 5);

    const totalVolume = allStocks.reduce((s, st) => s + (st.volume || 0), 0);
    const advancers = allStocks.filter((s) => parseFloat(s.changePct) > 0).length;
    const decliners = allStocks.filter((s) => parseFloat(s.changePct) < 0).length;

    res.json({
      totalStocks: allStocks.length,
      topGainers: Array.isArray(topGainers) ? topGainers : [],
      topLosers: Array.isArray(topLosers) ? topLosers : [],
      totalVolume,
      advancers,
      decliners,
      unchanged: allStocks.length - advancers - decliners,
      lastUpdated: allStocks[0]?.lastUpdated,
      dataSource: allStocks[0]?.dataSource || 'unknown',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/:ticker - Single stock detail with price history
router.get('/:ticker', async (req, res, next) => {
  try {
    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() }).lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(stock);
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/:ticker/history - Price history
router.get('/:ticker/history', async (req, res, next) => {
  try {
    const { days = 60 } = req.query;
    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() })
      .select('ticker name priceHistory')
      .lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));
    const history = stock.priceHistory.filter((p) => new Date(p.date) >= cutoff);

    res.json({ ticker: stock.ticker, name: stock.name, history });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/:ticker/ai-analysis - AI analysis of a stock
router.get('/:ticker/ai-analysis', async (req, res, next) => {
  try {
    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() })
      .select('-priceHistory')
      .lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const analysis = await analyzeStock(stock);
    res.json({ ticker: stock.ticker, analysis, generatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/stocks/refresh - Trigger manual scrape
router.post('/refresh', async (req, res, next) => {
  try {
    const { force } = req.query;
    if (force === 'true') {
      // Force clear stale seed data and re-seed with latest reference prices
      const { seedSampleData } = require('../scrapers/gseScraper');
      await Stock.deleteMany({ dataSource: { $regex: /^seed/ } });
      await seedSampleData();
      return res.json({ message: 'Force-reseeded with latest reference prices', timestamp: new Date().toISOString() });
    }
    const stocks = await scrapeGSEData();
    res.json({ message: `Refreshed ${stocks.length} stocks`, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const { scrapeGSEData } = require('../scrapers/gseScraper');
const { analyzeStock } = require('../services/aiService');

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: All fixed-path routes MUST come before /:ticker wildcard routes.
// ─────────────────────────────────────────────────────────────────────────────

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

// POST /api/stocks/refresh - Trigger manual scrape (MUST be before /:ticker)
router.post('/refresh', async (req, res, next) => {
  try {
    const { force } = req.query;
    if (force === 'true') {
      const { seedSampleData } = require('../scrapers/gseScraper');
      await Stock.deleteMany({ dataSource: { $regex: /^seed/ } });
      await seedSampleData();
      return res.json({ message: 'Force-reseeded with latest reference prices', timestamp: new Date().toISOString() });
    }
    const scraped = await scrapeGSEData();
    if (scraped.length === 0) {
      // scraper returned 0 but existing DB data is still valid — report count from DB
      const dbCount = await Stock.countDocuments();
      return res.json({
        message: `Live scrape returned 0 rows — showing ${dbCount} cached stocks`,
        scraped: 0,
        cached: dbCount,
        timestamp: new Date().toISOString(),
      });
    }
    res.json({ message: `Refreshed ${scraped.length} stocks from live source`, scraped: scraped.length, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/scrape-test - Debug: test scraper and return raw parsed data (MUST be before /:ticker)
router.get('/scrape-test', async (req, res, next) => {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    const { data } = await axios.get('https://afx.kwayisi.org/gse/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      timeout: 45000,
    });
    const $ = cheerio.load(data);
    const rows = [];
    $('div.t table tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 4) {
        rows.push({
          ticker: $(cells[0]).text().trim(),
          name: $(cells[1]).text().trim(),
          volume: $(cells[2]).text().trim(),
          price: $(cells[3]).text().trim(),
          change: cells.length >= 5 ? $(cells[4]).text().trim() : '',
        });
      }
    });
    res.json({ htmlLength: data.length, rowCount: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Wildcard routes — MUST come after all fixed-path routes above
// ─────────────────────────────────────────────────────────────────────────────

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


module.exports = router;

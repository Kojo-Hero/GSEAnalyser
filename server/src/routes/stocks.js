const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const { scrapeGSEData, testAllSources } = require('../scrapers/gseScraper');
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
router.post('/refresh', async (req, res) => {
  try {
    const { force } = req.query;
    if (force === 'true') {
      const { seedSampleData } = require('../scrapers/gseScraper');
      await Stock.deleteMany({ dataSource: { $regex: /^seed/ } });
      await seedSampleData();
      return res.json({ message: 'Force-reseeded with latest reference prices', scraped: 0, timestamp: new Date().toISOString() });
    }
    const scraped = await scrapeGSEData();
    const dbCount = await Stock.countDocuments();
    if (scraped.length === 0) {
      // All sources failed — return 200 so frontend shows a warning, not an error
      return res.json({
        message: `All live sources unavailable — showing ${dbCount} cached stocks`,
        scraped: 0,
        cached: dbCount,
        timestamp: new Date().toISOString(),
      });
    }
    res.json({
      message: `Refreshed ${scraped.length} stocks from live source`,
      scraped: scraped.length,
      cached: dbCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Even on unexpected error, return 200 with error info so frontend doesn't crash
    console.error('❌ /refresh error:', err.message);
    const dbCount = await Stock.countDocuments().catch(() => 0);
    res.json({
      message: `Refresh error — showing ${dbCount} cached stocks`,
      scraped: 0,
      cached: dbCount,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
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

// POST /api/stocks/ingest - Accept client-scraped stock data and save to DB
// Used when server-side scraping is blocked by the target site
router.post('/ingest', async (req, res) => {
  try {
    const { stocks: incoming } = req.body;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ error: 'stocks array required' });
    }

    const SECTOR_MAP = {
      GCB: 'Banking', MTNGH: 'Telecoms', EGH: 'Banking', SCB: 'Banking',
      GOIL: 'Oil & Gas', TOTAL: 'Oil & Gas', GGBL: 'Consumer Goods',
      FML: 'Consumer Goods', ACCESS: 'Banking', SOGEGH: 'Banking',
      CAL: 'Banking', ETI: 'Banking', RBGH: 'Banking', FAB: 'Banking',
      BOPP: 'Agriculture', PBC: 'Agriculture', UNIL: 'Consumer Goods',
      SIC: 'Insurance', EGL: 'Insurance', CLYD: 'Technology',
      CPC: 'Consumer Goods', DASPHARMA: 'Pharmaceuticals', ADB: 'Banking',
      AGA: 'Mining', AADS: 'Mining', ALW: 'Manufacturing',
      GLD: 'ETF', TLW: 'Oil & Gas', ASG: 'Mining', ALLGH: 'Mining',
      DIGICUT: 'Media', HORDS: 'Manufacturing', IIL: 'Pharmaceuticals',
      MAC: 'Financial', MMH: 'Financial', SAMBA: 'Consumer Goods',
      TBL: 'Banking', SCBPREF: 'Banking', CMLT: 'Manufacturing',
    };

    const existing = await Stock.find()
      .select('ticker sector marketCap peRatio eps dividendYield')
      .lean();
    const existingMap = Object.fromEntries(existing.map(s => [s.ticker, s]));

    const ops = incoming.map(s => {
      const prev = existingMap[s.ticker] || {};
      return {
        updateOne: {
          filter: { ticker: s.ticker },
          update: {
            $set: {
              ticker: s.ticker,
              name: s.name || s.ticker,
              currentPrice: s.currentPrice,
              prevClose: s.prevClose || s.currentPrice,
              openPrice: s.openPrice || s.prevClose || s.currentPrice,
              volume: s.volume || 0,
              change: s.change || 0,
              changePct: s.changePct || '0.00',
              sector: SECTOR_MAP[s.ticker] || prev.sector || 'Other',
              marketCap: prev.marketCap,
              peRatio: prev.peRatio,
              eps: prev.eps,
              dividendYield: prev.dividendYield,
              dataSource: s.dataSource || 'client-scrape',
              lastUpdated: new Date(),
            },
            $push: {
              priceHistory: {
                $each: [{ date: new Date(), price: s.currentPrice, volume: s.volume || 0 }],
                $slice: -365,
              },
            },
          },
          upsert: true,
        },
      };
    });

    await Stock.bulkWrite(ops);
    console.log(`✅ Ingested ${ops.length} stocks from client-side scrape`);
    res.json({ message: `Ingested ${ops.length} stocks`, count: ops.length, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('❌ /ingest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


router.get('/source-test', async (req, res) => {
  try {
    console.log('🔬 Running source diagnostics...');
    const results = await testAllSources();
    res.json({ testedAt: new Date().toISOString(), results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stocks/raw-html?url=... — fetch a URL from the server and return first 3000 chars + all table selectors found
router.get('/raw-html', async (req, res) => {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const target = req.query.url || 'https://gsewebportal.com/trading-and-data/';
  try {
    const { data } = await axios.get(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
      timeout: 20000,
      maxRedirects: 5,
    });
    const $ = cheerio.load(data);

    // Find all tables and report row counts + first row cell text
    const tables = [];
    $('table').each((i, tbl) => {
      const rows = $(tbl).find('tr');
      const firstRowCells = $(rows[0]).find('th, td').toArray().map(c => $(c).text().trim()).slice(0, 6);
      const secondRowCells = $(rows[1]).find('th, td').toArray().map(c => $(c).text().trim()).slice(0, 6);
      tables.push({ tableIndex: i, rows: rows.length, firstRow: firstRowCells, secondRow: secondRowCells });
    });

    res.json({
      url: target,
      statusCode: 200,
      htmlLength: data.length,
      preview: data.substring(0, 2000),
      tables,
      totalTables: tables.length,
    });
  } catch (err) {
    res.json({ url: target, error: err.message, code: err.code, status: err.response?.status });
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

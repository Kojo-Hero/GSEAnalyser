const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const Stock = require('../models/Stock');
const { authenticate } = require('../middleware/auth');

// GET /api/portfolio - Get user's portfolio
router.get('/', authenticate, async (req, res, next) => {
  try {
    let portfolio = await Portfolio.findOne({ userId: req.user.id }).lean();
    if (!portfolio) {
      portfolio = await Portfolio.create({ userId: req.user.id, holdings: [], watchlist: [] });
    }

    // Enrich holdings with live prices
    const tickers = portfolio.holdings.map((h) => h.ticker);
    const stocks = await Stock.find({ ticker: { $in: tickers } }).select('ticker currentPrice changePct').lean();
    const priceMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));

    const enriched = portfolio.holdings.map((h) => {
      const live = priceMap[h.ticker] || {};
      const currentPrice = live.currentPrice || h.avgCost;
      const value = h.shares * currentPrice;
      const cost = h.shares * h.avgCost;
      return {
        ...h,
        currentPrice,
        changePct: live.changePct || '0.00',
        value: parseFloat(value.toFixed(2)),
        pnl: parseFloat((value - cost).toFixed(2)),
        pnlPct: parseFloat(((value - cost) / cost * 100).toFixed(2)),
      };
    });

    const totalValue = enriched.reduce((s, h) => s + h.value, 0);
    const totalCost = enriched.reduce((s, h) => s + h.shares * h.avgCost, 0);

    res.json({
      ...portfolio,
      holdings: enriched,
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalPnL: parseFloat((totalValue - totalCost).toFixed(2)),
      totalPnLPct: parseFloat(((totalValue - totalCost) / totalCost * 100).toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/portfolio/holdings - Add a holding
router.post('/holdings', authenticate, async (req, res, next) => {
  try {
    const { ticker, shares, avgCost, notes } = req.body;
    if (!ticker || !shares || !avgCost) {
      return res.status(400).json({ error: 'ticker, shares, and avgCost are required' });
    }

    const stock = await Stock.findOne({ ticker: ticker.toUpperCase() }).lean();
    if (!stock) {
      return res.status(404).json({
        error: `Ticker "${ticker.toUpperCase()}" is not listed on the Ghana Stock Exchange. Please enter a valid GSE ticker.`,
      });
    }

    let portfolio = await Portfolio.findOne({ userId: req.user.id });
    if (!portfolio) {
      portfolio = new Portfolio({ userId: req.user.id });
    }

    // Check if holding already exists -> update
    const existingIdx = portfolio.holdings.findIndex((h) => h.ticker === ticker.toUpperCase());
    if (existingIdx >= 0) {
      const existing = portfolio.holdings[existingIdx];
      const totalShares = existing.shares + parseFloat(shares);
      const newAvgCost = (existing.shares * existing.avgCost + parseFloat(shares) * parseFloat(avgCost)) / totalShares;
      portfolio.holdings[existingIdx].shares = totalShares;
      portfolio.holdings[existingIdx].avgCost = parseFloat(newAvgCost.toFixed(4));
    } else {
      portfolio.holdings.push({
        ticker: ticker.toUpperCase(),
        name: stock?.name || ticker.toUpperCase(),
        shares: parseFloat(shares),
        avgCost: parseFloat(avgCost),
        sector: stock?.sector || 'Unknown',
        notes,
      });
    }

    await portfolio.save();
    res.json({ message: 'Holding added/updated', portfolio });
  } catch (err) {
    next(err);
  }
});

// PUT /api/portfolio/holdings/:ticker - Edit an existing holding
router.put('/holdings/:ticker', authenticate, async (req, res, next) => {
  try {
    const { shares, avgCost, notes } = req.body;
    if (!shares || !avgCost) return res.status(400).json({ error: 'shares and avgCost are required' });

    // Confirm ticker exists on GSE
    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() }).lean();
    if (!stock) {
      return res.status(404).json({
        error: `Ticker "${req.params.ticker.toUpperCase()}" is not listed on the Ghana Stock Exchange.`,
      });
    }

    const portfolio = await Portfolio.findOne({ userId: req.user.id });
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

    const idx = portfolio.holdings.findIndex(
      (h) => h.ticker === req.params.ticker.toUpperCase()
    );
    if (idx === -1) return res.status(404).json({ error: 'Holding not found' });

    portfolio.holdings[idx].shares = parseFloat(shares);
    portfolio.holdings[idx].avgCost = parseFloat(parseFloat(avgCost).toFixed(4));
    if (notes !== undefined) portfolio.holdings[idx].notes = notes;

    await portfolio.save();
    res.json({ message: 'Holding updated', holding: portfolio.holdings[idx] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/portfolio/holdings/:ticker - Remove a holding
router.delete('/holdings/:ticker', authenticate, async (req, res, next) => {
  try {
    const portfolio = await Portfolio.findOne({ userId: req.user.id });
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

    portfolio.holdings = portfolio.holdings.filter(
      (h) => h.ticker !== req.params.ticker.toUpperCase()
    );
    await portfolio.save();
    res.json({ message: 'Holding removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/portfolio/watchlist - Add to watchlist
router.post('/watchlist', authenticate, async (req, res, next) => {
  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const portfolio = await Portfolio.findOneAndUpdate(
      { userId: req.user.id },
      { $addToSet: { watchlist: ticker.toUpperCase() } },
      { upsert: true, new: true }
    );
    res.json({ message: 'Added to watchlist on Portfolio page', watchlist: portfolio.watchlist });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/portfolio/watchlist/:ticker - Remove from watchlist
router.delete('/watchlist/:ticker', authenticate, async (req, res, next) => {
  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId: req.user.id },
      { $pull: { watchlist: req.params.ticker.toUpperCase() } },
      { new: true }
    );
    res.json({ message: 'Removed from watchlist', watchlist: portfolio?.watchlist || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

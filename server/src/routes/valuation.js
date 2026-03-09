const express = require('express');
const router = express.Router();
const { runDCF, getSectorDefaults } = require('../services/dcfService');
const Stock = require('../models/Stock');

// POST /api/valuation/dcf - Run DCF model
router.post('/dcf', async (req, res, next) => {
  try {
    const {
      freeCashFlow,
      growthRateStage1,
      growthRateStage2,
      stage1Years,
      wacc,
      netDebt,
      sharesOutstanding,
      cashAndEquivalents,
    } = req.body;

    if (!freeCashFlow) {
      return res.status(400).json({ error: 'freeCashFlow is required' });
    }

    const result = runDCF({
      freeCashFlow: parseFloat(freeCashFlow),
      growthRateStage1: parseFloat(growthRateStage1) || 0.12,
      growthRateStage2: parseFloat(growthRateStage2) || 0.04,
      stage1Years: parseInt(stage1Years) || 5,
      wacc: parseFloat(wacc) || 0.18,
      netDebt: parseFloat(netDebt) || 0,
      sharesOutstanding: parseFloat(sharesOutstanding) || 100,
      cashAndEquivalents: parseFloat(cashAndEquivalents) || 0,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/valuation/defaults/:ticker - Get DCF defaults for a stock's sector
router.get('/defaults/:ticker', async (req, res, next) => {
  try {
    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() })
      .select('ticker name sector marketCap currentPrice')
      .lean();

    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const defaults = getSectorDefaults(stock.sector);
    res.json({ ticker: stock.ticker, name: stock.name, sector: stock.sector, defaults });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

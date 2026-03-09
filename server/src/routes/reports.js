const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Report = require('../models/Report');
const Stock = require('../models/Stock');
const { generateAnalystReport } = require('../services/reportService');
const { analyzeStock } = require('../services/aiService');
const { runDCF } = require('../services/dcfService');
const { authenticate, optionalAuth } = require('../middleware/auth');

// GET /api/reports - List reports
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filter = req.user ? { userId: req.user.id } : {};
    const reports = await Report.find(filter).select('-content').sort({ createdAt: -1 }).limit(20).lean();
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/generate - Generate a full analyst report
router.post('/generate', optionalAuth, async (req, res, next) => {
  try {
    const { ticker, dcfParams } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

    const stock = await Stock.findOne({ ticker: ticker.toUpperCase() }).select('-priceHistory').lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    // Generate AI insights
    const aiInsights = await analyzeStock(stock);

    // Run DCF if params provided
    let dcfResult = null;
    if (dcfParams?.freeCashFlow) {
      try {
        dcfResult = runDCF({
          freeCashFlow: parseFloat(dcfParams.freeCashFlow),
          growthRateStage1: parseFloat(dcfParams.growthRateStage1) || 0.12,
          growthRateStage2: parseFloat(dcfParams.growthRateStage2) || 0.04,
          stage1Years: parseInt(dcfParams.stage1Years) || 5,
          wacc: parseFloat(dcfParams.wacc) || 0.18,
          netDebt: parseFloat(dcfParams.netDebt) || 0,
          sharesOutstanding: parseFloat(dcfParams.sharesOutstanding) || 100,
          cashAndEquivalents: parseFloat(dcfParams.cashAndEquivalents) || 0,
        });
      } catch (dcfErr) {
        console.warn('DCF error (non-fatal):', dcfErr.message);
      }
    }

    const { report, fileName } = await generateAnalystReport({
      ticker: stock.ticker,
      companyName: stock.name,
      stockData: stock,
      aiInsights,
      dcfResult,
      userId: req.user?.id,
    });

    res.json({
      message: 'Report generated successfully',
      reportId: report._id,
      fileName,
      downloadUrl: `/api/reports/${report._id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id/download - Download PDF report
router.get('/:id/download', async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!report.filePath || !fs.existsSync(report.filePath)) {
      return res.status(404).json({ error: 'Report file not found' });
    }

    res.download(report.filePath, report.fileName || `${report.ticker}_report.pdf`);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id - Delete a report
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const report = await Report.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!report) return res.status(404).json({ error: 'Report not found or unauthorized' });

    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }
    res.json({ message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

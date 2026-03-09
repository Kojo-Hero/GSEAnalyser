const express = require('express');
const router = express.Router();
const pdfParse = require('pdf-parse');
const { ragQuery, analyzePDFContent, storeDocumentChunks } = require('../services/aiService');
const { upload } = require('../services/uploadService');
const DocumentChunk = require('../models/DocumentChunk');

// Helper: map aiService errors to HTTP responses
function handleAIError(err, res, next) {
  const msg = err.message || '';
  if (msg.startsWith('QUOTA EXCEEDED:')) {
    return res.status(429).json({
      error: 'quota exceeded',
      message: 'Retry again later',
      detail: msg.replace('QUOTA EXCEEDED: ', ''),
    });
  }
  if (msg.startsWith('AUTH ERROR:')) {
    return res.status(401).json({ error: 'auth_error', message: msg.replace('AUTH_ERROR: ', '') });
  }
  if (msg.startsWith('MODEL ERROR:')) {
    return res.status(503).json({ error: 'model_error', message: msg.replace('MODEL_ERROR: ', '') });
  }
  next(err);
}

// POST /api/ai/query - RAG Q&A query
router.post('/query', async (req, res, next) => {
  try {
    const { query, ticker } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const result = await ragQuery(query, ticker);
    res.json(result);
  } catch (err) {
    handleAIError(err, res, next);
  }
});

// POST /api/ai/upload - Upload & ingest PDF annual report
router.post('/upload', upload.single('report'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    const { ticker, year } = req.body;
    const fs = require('fs');
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const fullText = pdfData.text;

    if (!fullText || fullText.trim().length < 100) {
      return res.status(422).json({ error: 'PDF appears to be empty or image-only. Please upload a text-based PDF.' });
    }

    // Store chunks with embeddings in background
    storeDocumentChunks(ticker || 'UNKNOWN', req.file.originalname, parseInt(year) || new Date().getFullYear(), fullText)
      .catch((err) => console.error('Chunking error:', err.message));

    // Immediate AI analysis
    const analysis = await analyzePDFContent(fullText, ticker, year);

    res.json({
      message: 'PDF processed successfully',
      fileName: req.file.originalname,
      pages: pdfData.numpages,
      wordCount: fullText.split(/\s+/).length,
      analysis,
      ticker,
      year,
    });
  } catch (err) {
    handleAIError(err, res, next);
  }
});

// GET /api/ai/documents - List ingested documents
router.get('/documents', async (req, res, next) => {
  try {
    const { ticker } = req.query;
    const filter = ticker ? { ticker: ticker.toUpperCase() } : {};
    const docs = await DocumentChunk.aggregate([
      { $match: filter },
      { $group: { _id: { source: '$source', ticker: '$ticker', year: '$year' }, chunks: { $sum: 1 }, uploadedAt: { $first: '$uploadedAt' } } },
      { $sort: { uploadedAt: -1 } },
    ]);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ai/documents - Remove a document's chunks
router.delete('/documents', async (req, res, next) => {
  try {
    const { source, ticker } = req.body;
    const filter = {};
    if (source) filter.source = source;
    if (ticker) filter.ticker = ticker.toUpperCase();
    const result = await DocumentChunk.deleteMany(filter);
    res.json({ message: `Deleted ${result.deletedCount} chunks` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

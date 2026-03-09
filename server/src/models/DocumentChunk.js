const mongoose = require('mongoose');

const documentChunkSchema = new mongoose.Schema({
  ticker: { type: String, uppercase: true },
  source: { type: String }, // filename or URL
  year: { type: Number },
  chunkIndex: { type: Number },
  content: { type: String, required: true },
  embedding: [{ type: Number }], // Gemini embedding vector
  metadata: { type: mongoose.Schema.Types.Mixed },
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

documentChunkSchema.index({ ticker: 1 });
documentChunkSchema.index({ source: 1 });

module.exports = mongoose.model('DocumentChunk', documentChunkSchema);

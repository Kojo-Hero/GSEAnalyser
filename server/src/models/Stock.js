const mongoose = require('mongoose');

const pricePointSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  price: { type: Number, required: true },
  volume: { type: Number, default: 0 },
}, { _id: false });

const stockSchema = new mongoose.Schema({
  ticker: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  sector: { type: String, default: 'Unknown' },
  currentPrice: { type: Number, default: 0 },
  prevClose: { type: Number, default: 0 },
  openPrice: { type: Number, default: 0 },
  volume: { type: Number, default: 0 },
  change: { type: Number, default: 0 },
  changePct: { type: String, default: '0.00' },
  marketCap: { type: Number, default: 0 },
  peRatio: { type: Number },
  eps: { type: Number },
  dividendYield: { type: Number },
  fiftyTwoWeekHigh: { type: Number },
  fiftyTwoWeekLow: { type: Number },
  priceHistory: [pricePointSchema],
  dataSource: { type: String, default: 'unknown' }, // 'GSE Website' | 'African Markets' | 'seed_march_2026'
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

stockSchema.index({ sector: 1 });
stockSchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('Stock', stockSchema);

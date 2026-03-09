const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  ticker: { type: String, required: true, uppercase: true },
  name: { type: String },
  shares: { type: Number, required: true, min: 0 },
  avgCost: { type: Number, required: true, min: 0 },
  currentPrice: { type: Number, default: 0 },
  sector: { type: String },
  notes: { type: String },
  addedAt: { type: Date, default: Date.now },
}, { _id: true });

const portfolioSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'My Portfolio' },
  holdings: [holdingSchema],
  watchlist: [{ type: String, uppercase: true }],
  totalInvested: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

portfolioSchema.virtual('totalValue').get(function () {
  return this.holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
});

portfolioSchema.virtual('totalPnL').get(function () {
  return this.holdings.reduce((sum, h) => sum + h.shares * (h.currentPrice - h.avgCost), 0);
});

module.exports = mongoose.model('Portfolio', portfolioSchema);

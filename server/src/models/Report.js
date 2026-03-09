const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ticker: { type: String, required: true, uppercase: true },
  companyName: { type: String },
  reportType: { type: String, enum: ['analyst', 'dcf', 'ai_summary', 'full'], default: 'full' },
  content: { type: mongoose.Schema.Types.Mixed },
  filePath: { type: String },
  fileName: { type: String },
  aiInsights: { type: String },
  dcfSummary: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);

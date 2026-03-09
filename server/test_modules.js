process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.GEMINI_API_KEY = 'test_key';
process.env.JWT_SECRET = 'test_secret';

try {
  require('./src/routes/stocks');
  require('./src/routes/auth');
  require('./src/routes/portfolio');
  require('./src/routes/valuation');
  require('./src/routes/reports');
  require('./src/routes/ai');
  require('./src/middleware/auth');
  const { runDCF } = require('./src/services/dcfService');
  const result = runDCF({ freeCashFlow: 150, wacc: 0.18, growthRateStage1: 0.12, growthRateStage2: 0.04, sharesOutstanding: 300 });
  console.log('DCF Intrinsic Value/Share: GHS', result.intrinsicValuePerShare);
  console.log('All modules loaded successfully');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}

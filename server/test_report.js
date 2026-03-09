require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Stub out the Report model so we don't need MongoDB
jest = undefined; // prevent jest interference
const mongoose = { Schema: class { constructor() {} }, model: () => ({ create: async (d) => ({ ...d, _id: 'test' }) }) };
require.cache[require.resolve('./src/models/Report')] = {
  id: require.resolve('./src/models/Report'),
  filename: require.resolve('./src/models/Report'),
  loaded: true,
  exports: { create: async (d) => ({ ...d, _id: 'test_id' }) },
};

const { generateAnalystReport } = require('./src/services/reportService');

const sampleAI = `## **Executive Summary**
GCB Bank Limited (GCB) is a major player in the Ghanaian banking sector, presenting a compelling investment opportunity.

## **Technical Analysis**
- **Price Momentum**: Down 3.33% from previous close, indicating a short-term correction.
- **Support/Resistance Levels**:
  * Immediate Support: GHS 45.50 (historical low in recent months)
  * Resistance: GHS 50.00 (psychological barrier)
- **Trend Indicators**: The RSI suggests the stock is not in overbought territory.

## **Fundamental Analysis**
- **Valuation Assessment**: GCB maintains a strong market presence in Ghana's banking sector.
- **Sector Positioning**: GCB Bank is one of the largest banks in Ghana with a wide branch network.

## **Ghana Market Context**
- **GHS Exchange Rate**: A stable Ghanaian Cedi could positively impact GCB.
- **Inflation**: Low to moderate inflation rates could benefit banking stocks.
- **BoG Policy**: Bank of Ghana monetary policy will significantly influence the banking sector.

## **Key Risks**
- **Company-Specific Risks**:
  * Regulatory Changes
  * Asset Quality Deterioration
- **Market-Wide Risks**:
  * Economic Downturn
  * Currency Fluctuations

## **Investment Recommendation**
Based on the analysis, we recommend a **Buy** for GCB Bank Limited, with a 12-month price target of GHS 55.00.

## **Catalysts to Watch**
- **Dividend Payments**: Announcement of consistent or increased dividend payments.
- **Economic Recovery**: Signs of Ghana economic recovery could boost investor confidence.
- **Expansion Plans**: Strategic expansion or partnerships could offer growth opportunities.`;

generateAnalystReport({
  ticker: 'GCB',
  companyName: 'GCB Bank Limited',
  stockData: {
    ticker: 'GCB',
    sector: 'Banking',
    currentPrice: 48.14,
    changePct: -3.33,
    fiftyTwoWeekHigh: 48.4832,
    fiftyTwoWeekLow: 43.992,
    marketCap: null,
    peRatio: null,
    eps: null,
    dividendYield: null,
  },
  aiInsights: sampleAI,
  dcfResult: null,
  userId: null,
}).then(r => {
  console.log('✅ Report generated:', r.fileName);
  console.log('   Path:', r.filePath);
  const size = fs.statSync(r.filePath).size;
  console.log('   Size:', size, 'bytes');
}).catch(e => {
  console.error('❌ Error:', e.message);
  console.error(e.stack);
});

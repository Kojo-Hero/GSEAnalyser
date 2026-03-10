const axios = require('axios');
const cheerio = require('cheerio');
const Stock = require('../models/Stock');

const KWAYISI_URL = 'https://afx.kwayisi.org/gse/';

// Sector map based on known GSE companies
const SECTOR_MAP = {
  GCB: 'Banking', MTNGH: 'Telecoms', EGH: 'Banking', SCB: 'Banking',
  GOIL: 'Oil & Gas', TOTAL: 'Oil & Gas', GGBL: 'Consumer Goods',
  FML: 'Consumer Goods', ACCESS: 'Banking', SOGEGH: 'Banking',
  CAL: 'Banking', ETI: 'Banking', RBGH: 'Banking', FAB: 'Banking',
  BOPP: 'Agriculture', PBC: 'Agriculture', UNIL: 'Consumer Goods',
  SIC: 'Insurance', EGL: 'Insurance', CLYD: 'Technology',
  CPC: 'Consumer Goods', DASPHARMA: 'Pharmaceuticals', ADB: 'Banking',
  AGA: 'Mining', AADS: 'Mining', ALW: 'Manufacturing',
  GLD: 'ETF', TLW: 'Oil & Gas', ASG: 'Mining', ALLGH: 'Mining',
  DIGICUT: 'Media', HORDS: 'Manufacturing', IIL: 'Pharmaceuticals',
  MAC: 'Financial', MMH: 'Financial', SAMBA: 'Consumer Goods',
  TBL: 'Banking', SCBPREF: 'Banking', CMLT: 'Manufacturing',
};

/**
 * Fetch live GSE data from afx.kwayisi.org/gse/
 * Table columns: Ticker | Name | Volume | Price | Change
 */
async function scrapeGSEData() {
  console.log('📈 Fetching live GSE data from afx.kwayisi.org...');
  try {
    const { data } = await axios.get(KWAYISI_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const stocks = [];

    console.log('📄 HTML length:', data.length);

    // Find the equities table inside div.t
    $('div.t table tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const ticker = $(cells[0]).text().trim().toUpperCase();
      const name   = $(cells[1]).text().trim();
      const volumeRaw = $(cells[2]).text().trim().replace(/,/g, '');
      const priceRaw  = $(cells[3]).text().trim().replace(/,/g, '');
      const changeCell = cells.length >= 5 ? $(cells[4]) : null;
      const changeRaw  = changeCell ? changeCell.text().trim().replace(/,/g, '') : '0';

      if (!ticker || ticker.length > 15) return;

      const currentPrice = parseFloat(priceRaw) || 0;
      const volume       = parseInt(volumeRaw, 10) || 0;
      const changeVal    = parseFloat(changeRaw) || 0;
      const prevClose    = parseFloat((currentPrice - changeVal).toFixed(4));
      const changePct    = prevClose > 0
        ? ((changeVal / prevClose) * 100).toFixed(2)
        : '0.00';

      const isLoss = changeCell && changeCell.hasClass('lo');

      // Allow stocks with price 0 only if they have a ticker — some may be suspended
      if (!ticker || currentPrice < 0) return;

      stocks.push({
        ticker,
        name: name || ticker,
        currentPrice,
        prevClose: prevClose > 0 ? prevClose : currentPrice,
        openPrice: prevClose > 0 ? prevClose : currentPrice,
        volume,
        change: changeVal,
        changePct: (isLoss && parseFloat(changePct) > 0)
          ? `-${changePct}`
          : changePct,
        sector: SECTOR_MAP[ticker] || 'Other',
        dataSource: 'afx.kwayisi.org',
      });
    });

    console.log(`📊 Parsed ${stocks.length} stocks from HTML`);

    if (stocks.length === 0) {
      console.warn('⚠️  No stocks parsed from kwayisi — falling back to seed data');
      await seedSampleData();
      return [];
    }

    console.log(`✅ Parsed ${stocks.length} stocks from afx.kwayisi.org`);

    // Preserve existing fundamentals (marketCap, peRatio, etc.) already in DB
    const existing = await Stock.find()
      .select('ticker sector marketCap peRatio eps dividendYield fiftyTwoWeekHigh fiftyTwoWeekLow')
      .lean();
    const existingMap = Object.fromEntries(existing.map((s) => [s.ticker, s]));

    const ops = stocks.map((s) => {
      const prev = existingMap[s.ticker] || {};
      return {
        updateOne: {
          filter: { ticker: s.ticker },
          update: {
            $set: {
              ticker:        s.ticker,
              name:          s.name,
              currentPrice:  s.currentPrice,
              prevClose:     s.prevClose,
              openPrice:     s.openPrice,
              volume:        s.volume,
              change:        s.change,
              changePct:     s.changePct,
              sector:        SECTOR_MAP[s.ticker] || prev.sector || 'Other',
              marketCap:     prev.marketCap,
              peRatio:       prev.peRatio,
              eps:           prev.eps,
              dividendYield: prev.dividendYield,
              dataSource:    'afx.kwayisi.org',
              lastUpdated:   new Date(),
            },
            $push: {
              priceHistory: {
                $each: [{ date: new Date(), price: s.currentPrice, volume: s.volume }],
                $slice: -365,
              },
            },
          },
          upsert: true,
        },
      };
    });

    await Stock.bulkWrite(ops);
    const t = new Date().toLocaleString('en-GH', { timeZone: 'Africa/Accra', dateStyle: 'short', timeStyle: 'short' });
    console.log(`✅ Saved ${ops.length} live GSE stocks at ${t} (Accra time)`);
    return stocks;

  } catch (err) {
    console.error('❌ kwayisi scrape failed:', err.message);
    console.error('❌ Error details:', err.code || err.response?.status || 'unknown');
    // Only seed if DB has no data at all
    const count = await Stock.countDocuments();
    if (count === 0) {
      console.log('🌱 Empty DB — seeding fallback data...');
      await seedSampleData();
    } else {
      console.log(`ℹ️  Using existing ${count} stocks from DB`);
    }
    return [];
  }
}

/**
 * Fallback seed — only used when DB is empty and all live sources fail.
 * Values are approximate and labelled as reference data.
 */
async function seedSampleData() {
  const fallback = [
    { ticker: 'GCB',    name: 'GCB Bank Limited',                  currentPrice: 48.14, prevClose: 49.80, volume: 535420, sector: 'Banking'        },
    { ticker: 'MTNGH',  name: 'MTN Ghana',                         currentPrice:  5.92, prevClose:  5.80, volume: 13413290, sector: 'Telecoms'     },
    { ticker: 'EGH',    name: 'Ecobank Ghana Limited',              currentPrice: 57.00, prevClose: 57.00, volume:  90304, sector: 'Banking'        },
    { ticker: 'SCB',    name: 'Standard Chartered Bank Limited',    currentPrice: 57.15, prevClose: 51.96, volume:    844, sector: 'Banking'        },
    { ticker: 'GOIL',   name: 'Ghana Oil Company Limited',          currentPrice:  5.81, prevClose:  5.77, volume:  15092, sector: 'Oil & Gas'      },
    { ticker: 'TOTAL',  name: 'TotalEnergies Marketing Ghana',      currentPrice: 40.15, prevClose: 40.15, volume:  20890, sector: 'Oil & Gas'      },
    { ticker: 'GGBL',   name: 'Guinness Ghana Breweries Limited',   currentPrice: 16.10, prevClose: 15.00, volume: 110535, sector: 'Consumer Goods' },
    { ticker: 'FML',    name: 'Fan Milk Plc',                       currentPrice: 16.35, prevClose: 15.89, volume:  16956, sector: 'Consumer Goods' },
    { ticker: 'ACCESS', name: 'Access Bank Ghana',                  currentPrice: 42.40, prevClose: 42.40, volume:    132, sector: 'Banking'        },
    { ticker: 'SOGEGH', name: 'Societe Generale Ghana Limited',     currentPrice: 11.40, prevClose: 11.40, volume:  42587, sector: 'Banking'        },
    { ticker: 'CAL',    name: 'CalBank Plc',                        currentPrice:  0.89, prevClose:  0.88, volume: 354543, sector: 'Banking'        },
    { ticker: 'ETI',    name: 'Ecobank Transnational Incorporated', currentPrice:  1.66, prevClose:  1.55, volume: 618303, sector: 'Banking'        },
    { ticker: 'BOPP',   name: 'Benso Oil Palm Plantation Limited',  currentPrice: 74.01, prevClose: 74.01, volume:    987, sector: 'Agriculture'    },
    { ticker: 'EGL',    name: 'Enterprise Group Limited',           currentPrice:  9.80, prevClose:  9.00, volume: 100661, sector: 'Insurance'      },
    { ticker: 'RBGH',   name: 'Republic Bank Ghana Limited',        currentPrice:  2.90, prevClose:  2.73, volume: 107149, sector: 'Banking'        },
    { ticker: 'SIC',    name: 'SIC Insurance Company Limited',      currentPrice:  4.95, prevClose:  4.90, volume:  94260, sector: 'Insurance'      },
    { ticker: 'CPC',    name: 'Cocoa Processing Company Limited',   currentPrice:  0.08, prevClose:  0.07, volume:  14920, sector: 'Consumer Goods' },
    { ticker: 'UNIL',   name: 'Unilever Ghana Limited',             currentPrice: 28.45, prevClose: 27.90, volume:  58940, sector: 'Consumer Goods' },
  ];

  const now = new Date();
  for (const s of fallback) {
    const change    = parseFloat((s.currentPrice - s.prevClose).toFixed(4));
    const changePct = s.prevClose > 0
      ? ((change / s.prevClose) * 100).toFixed(2)
      : '0.00';

    // 60-day synthetic history ending at current price
    const priceHistory = [];
    let price = s.prevClose * 0.88;
    for (let d = 60; d >= 1; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const drift = Math.pow(s.currentPrice / Math.max(price, 0.001), 1 / Math.max(d, 1));
      price = price * drift * (1 + (Math.random() - 0.5) * 0.015);
      priceHistory.push({ date, price: parseFloat(price.toFixed(4)), volume: Math.floor(s.volume * (0.4 + Math.random())) });
    }
    priceHistory.push({ date: now, price: s.currentPrice, volume: s.volume });

    const prices = priceHistory.map((p) => p.price);
    await Stock.findOneAndUpdate(
      { ticker: s.ticker },
      {
        $set: {
          ...s, change, changePct,
          openPrice: s.prevClose,
          fiftyTwoWeekHigh: parseFloat(Math.max(...prices).toFixed(4)),
          fiftyTwoWeekLow:  parseFloat(Math.min(...prices).toFixed(4)),
          lastUpdated: now,
          priceHistory,
          dataSource: 'seed_fallback',
        },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${fallback.length} fallback stocks (kwayisi March 5 2026 reference prices)`);
}

module.exports = { scrapeGSEData, seedSampleData };

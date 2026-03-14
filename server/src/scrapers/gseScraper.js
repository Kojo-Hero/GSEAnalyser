const axios = require('axios');
const cheerio = require('cheerio');
const Stock = require('../models/Stock');

// Rotate user-agents to reduce chance of being blocked
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

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

/** Sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Generic HTTP fetch with one retry */
async function fetchHTML(url, timeoutMs = 20000) {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`🌐 [attempt ${attempt}] GET ${url}`);
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        timeout: timeoutMs,
        maxRedirects: 5,
      });
      console.log(`✅ Fetched ${url} — ${data.length} bytes`);
      return data;
    } catch (err) {
      console.warn(`⚠️  [attempt ${attempt}] ${url} failed: ${err.code || err.message}`);
      if (attempt < 2) await sleep(3000);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1: gse.com.gh  — official GSE website market summary table
// URL: https://gse.com.gh/market-data/prices-and-indices
// Table columns: Ticker | Company | Open | High | Low | Current | Change | Volume
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEOfficial() {
  const html = await fetchHTML('https://gse.com.gh/market-data/prices-and-indices', 20000);
  if (!html) return [];

  const $ = cheerio.load(html);
  const stocks = [];

  // Try multiple possible table selectors on the official site
  const tableSelectors = [
    'table.market-data tbody tr',
    'table tbody tr',
    '.market-summary table tbody tr',
    '#market-data table tbody tr',
  ];

  let rows = $([]);
  for (const sel of tableSelectors) {
    rows = $(sel);
    if (rows.length > 3) break;
  }

  console.log(`📊 gse.com.gh: found ${rows.length} table rows`);

  rows.each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 6) return;

    const ticker = $(cells[0]).text().trim().toUpperCase().replace(/[^A-Z]/g, '');
    const name = $(cells[1]).text().trim();
    const currentPriceRaw = $(cells[5]).text().trim().replace(/,/g, '') || $(cells[3]).text().trim().replace(/,/g, '');
    const openRaw = $(cells[2]).text().trim().replace(/,/g, '');
    const changeRaw = $(cells[6]).text().trim().replace(/,/g, '') || '0';
    const volumeRaw = $(cells[7]).text().trim().replace(/,/g, '') || '0';

    if (!ticker || ticker.length > 15) return;

    const currentPrice = parseFloat(currentPriceRaw) || 0;
    const openPrice = parseFloat(openRaw) || currentPrice;
    const volume = parseInt(volumeRaw, 10) || 0;
    const changeVal = parseFloat(changeRaw) || 0;
    const prevClose = parseFloat((currentPrice - changeVal).toFixed(4));
    const changePct = prevClose > 0 ? ((changeVal / prevClose) * 100).toFixed(2) : '0.00';

    if (currentPrice <= 0) return;

    stocks.push({
      ticker,
      name: name || ticker,
      currentPrice,
      prevClose: prevClose > 0 ? prevClose : currentPrice,
      openPrice,
      volume,
      change: changeVal,
      changePct,
      sector: SECTOR_MAP[ticker] || 'Other',
      dataSource: 'gse.com.gh',
    });
  });

  console.log(`📊 gse.com.gh parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2: afx.kwayisi.org  — third-party aggregator
// Known to block cloud IPs — kept as fallback, low priority
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeKwayisi() {
  const html = await fetchHTML('https://afx.kwayisi.org/gse/', 30000);
  if (!html) return [];

  const $ = cheerio.load(html);
  const stocks = [];

  $('div.t table tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const ticker = $(cells[0]).text().trim().toUpperCase();
    const name = $(cells[1]).text().trim();
    const volumeRaw = $(cells[2]).text().trim().replace(/,/g, '');
    const priceRaw = $(cells[3]).text().trim().replace(/,/g, '');
    const changeCell = cells.length >= 5 ? $(cells[4]) : null;
    const changeRaw = changeCell ? changeCell.text().trim().replace(/,/g, '') : '0';

    if (!ticker || ticker.length > 15) return;

    const currentPrice = parseFloat(priceRaw) || 0;
    const volume = parseInt(volumeRaw, 10) || 0;
    const changeVal = parseFloat(changeRaw) || 0;
    const prevClose = parseFloat((currentPrice - changeVal).toFixed(4));
    const changePct = prevClose > 0 ? ((changeVal / prevClose) * 100).toFixed(2) : '0.00';
    const isLoss = changeCell && changeCell.hasClass('lo');

    if (currentPrice < 0) return;

    stocks.push({
      ticker,
      name: name || ticker,
      currentPrice,
      prevClose: prevClose > 0 ? prevClose : currentPrice,
      openPrice: prevClose > 0 ? prevClose : currentPrice,
      volume,
      change: changeVal,
      changePct: (isLoss && parseFloat(changePct) > 0) ? `-${changePct}` : changePct,
      sector: SECTOR_MAP[ticker] || 'Other',
      dataSource: 'afx.kwayisi.org',
    });
  });

  console.log(`📊 afx.kwayisi.org parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3: gsemarketwatch.com — alternative GSE data source
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEMarketWatch() {
  const html = await fetchHTML('https://www.gsemarketwatch.com/', 20000);
  if (!html) return [];

  const $ = cheerio.load(html);
  const stocks = [];

  // gsemarketwatch uses a data table — try common selectors
  const selectors = ['table#stock-prices tbody tr', 'table.table tbody tr', 'table tbody tr'];
  let rows = $([]);
  for (const sel of selectors) {
    rows = $(sel);
    if (rows.length > 3) break;
  }

  console.log(`📊 gsemarketwatch.com: found ${rows.length} rows`);

  rows.each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const ticker = $(cells[0]).text().trim().toUpperCase().replace(/[^A-Z]/g, '');
    const name = $(cells[1]).text().trim();
    const priceRaw = $(cells[2]).text().trim().replace(/[^0-9.]/g, '');
    const changeRaw = $(cells[3]).text().trim().replace(/[^0-9.\-]/g, '') || '0';
    const volumeRaw = cells.length > 4 ? $(cells[4]).text().trim().replace(/,/g, '') : '0';

    if (!ticker || ticker.length > 15) return;

    const currentPrice = parseFloat(priceRaw) || 0;
    const volume = parseInt(volumeRaw, 10) || 0;
    const changeVal = parseFloat(changeRaw) || 0;
    const prevClose = parseFloat((currentPrice - changeVal).toFixed(4));
    const changePct = prevClose > 0 ? ((changeVal / prevClose) * 100).toFixed(2) : '0.00';

    if (currentPrice <= 0) return;

    stocks.push({
      ticker,
      name: name || ticker,
      currentPrice,
      prevClose: prevClose > 0 ? prevClose : currentPrice,
      openPrice: prevClose > 0 ? prevClose : currentPrice,
      volume,
      change: changeVal,
      changePct,
      sector: SECTOR_MAP[ticker] || 'Other',
      dataSource: 'gsemarketwatch.com',
    });
  });

  console.log(`📊 gsemarketwatch.com parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: Try all sources in order, use first one that returns ≥5 stocks
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEData() {
  console.log('📈 Starting GSE data fetch — trying all sources...');

  const sources = [
    { name: 'gse.com.gh (official)', fn: scrapeGSEOfficial },
    { name: 'gsemarketwatch.com',    fn: scrapeGSEMarketWatch },
    { name: 'afx.kwayisi.org',       fn: scrapeKwayisi },
  ];

  let stocks = [];

  for (const source of sources) {
    try {
      console.log(`\n🔄 Trying source: ${source.name}`);
      stocks = await source.fn();
      if (stocks.length >= 5) {
        console.log(`✅ Using data from ${source.name} — ${stocks.length} stocks`);
        break;
      }
      console.warn(`⚠️  ${source.name} returned only ${stocks.length} stocks — trying next source`);
    } catch (err) {
      console.warn(`⚠️  ${source.name} threw: ${err.message}`);
    }
  }

  if (stocks.length === 0) {
    console.warn('⚠️  All sources failed or returned 0 stocks');
    const count = await Stock.countDocuments();
    if (count === 0) {
      console.log('🌱 Empty DB — seeding fallback data...');
      await seedSampleData();
    } else {
      console.log(`ℹ️  Keeping existing ${count} stocks in DB`);
    }
    return [];
  }

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
            dataSource:    s.dataSource,
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
  console.log(`✅ Saved ${ops.length} stocks at ${t} (Accra time)`);
  return stocks;
}

/**
 * Fallback seed — only used when DB is empty and all live sources fail.
 */
async function seedSampleData() {
  const fallback = [
    { ticker: 'GCB',    name: 'GCB Bank Limited',                  currentPrice: 48.14, prevClose: 49.80, volume: 535420,   sector: 'Banking'        },
    { ticker: 'MTNGH',  name: 'MTN Ghana',                         currentPrice:  5.92, prevClose:  5.80, volume: 13413290, sector: 'Telecoms'       },
    { ticker: 'EGH',    name: 'Ecobank Ghana Limited',              currentPrice: 57.00, prevClose: 57.00, volume:  90304,   sector: 'Banking'        },
    { ticker: 'SCB',    name: 'Standard Chartered Bank Limited',    currentPrice: 57.15, prevClose: 51.96, volume:    844,   sector: 'Banking'        },
    { ticker: 'GOIL',   name: 'Ghana Oil Company Limited',          currentPrice:  5.81, prevClose:  5.77, volume:  15092,   sector: 'Oil & Gas'      },
    { ticker: 'TOTAL',  name: 'TotalEnergies Marketing Ghana',      currentPrice: 40.15, prevClose: 40.15, volume:  20890,   sector: 'Oil & Gas'      },
    { ticker: 'GGBL',   name: 'Guinness Ghana Breweries Limited',   currentPrice: 16.10, prevClose: 15.00, volume: 110535,   sector: 'Consumer Goods' },
    { ticker: 'FML',    name: 'Fan Milk Plc',                       currentPrice: 16.35, prevClose: 15.89, volume:  16956,   sector: 'Consumer Goods' },
    { ticker: 'ACCESS', name: 'Access Bank Ghana',                  currentPrice: 42.40, prevClose: 42.40, volume:    132,   sector: 'Banking'        },
    { ticker: 'SOGEGH', name: 'Societe Generale Ghana Limited',     currentPrice: 11.40, prevClose: 11.40, volume:  42587,   sector: 'Banking'        },
    { ticker: 'CAL',    name: 'CalBank Plc',                        currentPrice:  0.89, prevClose:  0.88, volume: 354543,   sector: 'Banking'        },
    { ticker: 'ETI',    name: 'Ecobank Transnational Incorporated', currentPrice:  1.66, prevClose:  1.55, volume: 618303,   sector: 'Banking'        },
    { ticker: 'BOPP',   name: 'Benso Oil Palm Plantation Limited',  currentPrice: 74.01, prevClose: 74.01, volume:    987,   sector: 'Agriculture'    },
    { ticker: 'EGL',    name: 'Enterprise Group Limited',           currentPrice:  9.80, prevClose:  9.00, volume: 100661,   sector: 'Insurance'      },
    { ticker: 'RBGH',   name: 'Republic Bank Ghana Limited',        currentPrice:  2.90, prevClose:  2.73, volume: 107149,   sector: 'Banking'        },
    { ticker: 'SIC',    name: 'SIC Insurance Company Limited',      currentPrice:  4.95, prevClose:  4.90, volume:  94260,   sector: 'Insurance'      },
    { ticker: 'CPC',    name: 'Cocoa Processing Company Limited',   currentPrice:  0.08, prevClose:  0.07, volume:  14920,   sector: 'Consumer Goods' },
    { ticker: 'UNIL',   name: 'Unilever Ghana Limited',             currentPrice: 28.45, prevClose: 27.90, volume:  58940,   sector: 'Consumer Goods' },
  ];

  const now = new Date();
  for (const s of fallback) {
    const change    = parseFloat((s.currentPrice - s.prevClose).toFixed(4));
    const changePct = s.prevClose > 0 ? ((change / s.prevClose) * 100).toFixed(2) : '0.00';

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
  console.log(`✅ Seeded ${fallback.length} fallback stocks`);
}

module.exports = { scrapeGSEData, seedSampleData };

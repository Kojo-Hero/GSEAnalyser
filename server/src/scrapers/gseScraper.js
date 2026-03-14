const axios = require('axios');
const cheerio = require('cheerio');
const Stock = require('../models/Stock');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch HTML — 2 attempts, configurable timeout */
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
          'Referer': 'https://www.google.com/',
        },
        timeout: timeoutMs,
        maxRedirects: 5,
      });
      console.log(`✅ Fetched ${url} — ${data.length} bytes`);
      return data;
    } catch (err) {
      console.warn(`⚠️  [attempt ${attempt}] ${url} failed: ${err.code || err.response?.status || err.message}`);
      if (attempt < 2) await sleep(2000);
    }
  }
  return null;
}

/** Shared helper — build stock object from parsed fields */
function buildStock(ticker, name, currentPrice, prevClose, openPrice, volume, changeVal, dataSource) {
  const cp = parseFloat(currentPrice) || 0;
  const pc = parseFloat(prevClose) || cp;
  const op = parseFloat(openPrice) || pc;
  const vol = parseInt(volume, 10) || 0;
  const ch = parseFloat(changeVal) || 0;
  const safePrevClose = pc > 0 ? pc : cp;
  const changePct = safePrevClose > 0 ? ((ch / safePrevClose) * 100).toFixed(2) : '0.00';
  if (cp <= 0 || !ticker || ticker.length > 15) return null;
  return {
    ticker: ticker.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    name: name || ticker,
    currentPrice: cp,
    prevClose: safePrevClose,
    openPrice: op,
    volume: vol,
    change: ch,
    changePct,
    sector: SECTOR_MAP[ticker.toUpperCase()] || 'Other',
    dataSource,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1: gse.com.gh/market-statistics/
// Has a table with all listed equities and their current prices
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEMarketStats() {
  const html = await fetchHTML('https://gse.com.gh/market-statistics/', 20000);
  if (!html) return [];
  const $ = cheerio.load(html);
  const stocks = [];

  // Try every <table> on the page — pick the one with the most rows
  let bestRows = $([]);
  $('table').each((_, tbl) => {
    const rows = $(tbl).find('tbody tr');
    if (rows.length > bestRows.length) bestRows = rows;
  });
  console.log(`📊 gse.com.gh/market-statistics: best table has ${bestRows.length} rows`);

  bestRows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const texts = cells.toArray().map(c => $(c).text().trim());
    // Find the ticker — usually first cell, short uppercase alpha
    const ticker = texts[0].toUpperCase().replace(/[^A-Z]/g, '');
    if (!ticker || ticker.length > 12) return;
    // Find price — first numeric cell after ticker+name
    const price = texts.slice(1).find(t => /^\d+(\.\d+)?$/.test(t.replace(/,/g, '')));
    if (!price) return;
    const stock = buildStock(ticker, texts[1] || ticker, parseFloat(price.replace(/,/g, '')), 0, 0, 0, 0, 'gse.com.gh/market-statistics');
    if (stock) stocks.push(stock);
  });

  console.log(`📊 gse.com.gh/market-statistics parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2: gse.com.gh/equities/
// Lists all equities with price data
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEEquities() {
  const html = await fetchHTML('https://gse.com.gh/equities/', 20000);
  if (!html) return [];
  const $ = cheerio.load(html);
  const stocks = [];

  let bestRows = $([]);
  $('table').each((_, tbl) => {
    const rows = $(tbl).find('tbody tr');
    if (rows.length > bestRows.length) bestRows = rows;
  });
  console.log(`📊 gse.com.gh/equities: best table has ${bestRows.length} rows`);

  bestRows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const texts = cells.toArray().map(c => $(c).text().trim());
    const ticker = texts[0].toUpperCase().replace(/[^A-Z]/g, '');
    if (!ticker || ticker.length > 12) return;
    const price = texts.slice(1).find(t => /^\d+(\.\d+)?$/.test(t.replace(/,/g, '')));
    if (!price) return;
    const stock = buildStock(ticker, texts[1] || ticker, parseFloat(price.replace(/,/g, '')), 0, 0, 0, 0, 'gse.com.gh/equities');
    if (stock) stocks.push(stock);
  });

  console.log(`📊 gse.com.gh/equities parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3: gse.com.gh/market-summary/
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEMarketSummary() {
  const html = await fetchHTML('https://gse.com.gh/market-summary/', 20000);
  if (!html) return [];
  const $ = cheerio.load(html);
  const stocks = [];

  let bestRows = $([]);
  $('table').each((_, tbl) => {
    const rows = $(tbl).find('tbody tr');
    if (rows.length > bestRows.length) bestRows = rows;
  });
  console.log(`📊 gse.com.gh/market-summary: best table has ${bestRows.length} rows`);

  bestRows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const texts = cells.toArray().map(c => $(c).text().trim());
    const ticker = texts[0].toUpperCase().replace(/[^A-Z]/g, '');
    if (!ticker || ticker.length > 12) return;
    const price = texts.slice(1).find(t => /^\d+(\.\d+)?$/.test(t.replace(/,/g, '')));
    if (!price) return;
    const stock = buildStock(ticker, texts[1] || ticker, parseFloat(price.replace(/,/g, '')), 0, 0, 0, 0, 'gse.com.gh/market-summary');
    if (stock) stocks.push(stock);
  });

  console.log(`📊 gse.com.gh/market-summary parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 4: gsewebportal.com/trading-and-data/
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEWebPortal() {
  const html = await fetchHTML('https://gsewebportal.com/trading-and-data/', 20000);
  if (!html) return [];
  const $ = cheerio.load(html);
  const stocks = [];

  let bestRows = $([]);
  $('table').each((_, tbl) => {
    const rows = $(tbl).find('tbody tr');
    if (rows.length > bestRows.length) bestRows = rows;
  });
  console.log(`📊 gsewebportal.com: best table has ${bestRows.length} rows`);

  bestRows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const texts = cells.toArray().map(c => $(c).text().trim());
    const ticker = texts[0].toUpperCase().replace(/[^A-Z]/g, '');
    if (!ticker || ticker.length > 12) return;
    const price = texts.slice(1).find(t => /^\d+(\.\d+)?$/.test(t.replace(/,/g, '')));
    if (!price) return;
    const stock = buildStock(ticker, texts[1] || ticker, parseFloat(price.replace(/,/g, '')), 0, 0, 0, 0, 'gsewebportal.com');
    if (stock) stocks.push(stock);
  });

  console.log(`📊 gsewebportal.com parsed ${stocks.length} stocks`);
  return stocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 5: afx.kwayisi.org — kept as last resort
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeKwayisi() {
  const html = await fetchHTML('https://afx.kwayisi.org/gse/', 30000);
  if (!html) return [];
  const $ = cheerio.load(html);
  const stocks = [];

  $('div.t table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    const ticker = $(cells[0]).text().trim().toUpperCase();
    const name = $(cells[1]).text().trim();
    const volumeRaw = $(cells[2]).text().trim().replace(/,/g, '');
    const priceRaw = $(cells[3]).text().trim().replace(/,/g, '');
    const changeCell = cells.length >= 5 ? $(cells[4]) : null;
    const changeRaw = changeCell ? changeCell.text().trim().replace(/,/g, '') : '0';
    const isLoss = changeCell && changeCell.hasClass('lo');
    const currentPrice = parseFloat(priceRaw) || 0;
    const changeVal = parseFloat(changeRaw) || 0;
    const prevClose = parseFloat((currentPrice - changeVal).toFixed(4));
    const changePct = prevClose > 0 ? ((changeVal / prevClose) * 100).toFixed(2) : '0.00';
    if (!ticker || ticker.length > 15 || currentPrice < 0) return;
    stocks.push({
      ticker,
      name: name || ticker,
      currentPrice,
      prevClose: prevClose > 0 ? prevClose : currentPrice,
      openPrice: prevClose > 0 ? prevClose : currentPrice,
      volume: parseInt(volumeRaw, 10) || 0,
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
// SOURCE TEST — called by /api/stocks/source-test debug endpoint
// Returns raw diagnostic info from every source without touching the DB
// ─────────────────────────────────────────────────────────────────────────────
async function testAllSources() {
  const sources = [
    { name: 'gse.com.gh/market-statistics', url: 'https://gse.com.gh/market-statistics/', fn: scrapeGSEMarketStats },
    { name: 'gse.com.gh/equities',          url: 'https://gse.com.gh/equities/',          fn: scrapeGSEEquities },
    { name: 'gse.com.gh/market-summary',    url: 'https://gse.com.gh/market-summary/',    fn: scrapeGSEMarketSummary },
    { name: 'gsewebportal.com',             url: 'https://gsewebportal.com/trading-and-data/', fn: scrapeGSEWebPortal },
    { name: 'afx.kwayisi.org',              url: 'https://afx.kwayisi.org/gse/',          fn: scrapeKwayisi },
  ];

  const results = [];
  for (const s of sources) {
    const start = Date.now();
    try {
      // First check raw fetch
      const html = await fetchHTML(s.url, 15000);
      if (!html) {
        results.push({ source: s.name, status: 'FETCH_FAILED', ms: Date.now() - start, stocks: 0 });
        continue;
      }
      const stocks = await s.fn();
      results.push({
        source: s.name,
        status: stocks.length >= 5 ? 'OK' : 'LOW_RESULTS',
        ms: Date.now() - start,
        stocks: stocks.length,
        sample: stocks.slice(0, 3).map(s => ({ ticker: s.ticker, price: s.currentPrice })),
      });
    } catch (err) {
      results.push({ source: s.name, status: 'ERROR', error: err.message, ms: Date.now() - start, stocks: 0 });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCRAPER — tries all sources in order, saves first with ≥5 stocks
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeGSEData() {
  console.log('📈 Starting GSE data fetch — trying all sources...');

  const sources = [
    { name: 'gse.com.gh/market-statistics', fn: scrapeGSEMarketStats },
    { name: 'gse.com.gh/equities',          fn: scrapeGSEEquities },
    { name: 'gse.com.gh/market-summary',    fn: scrapeGSEMarketSummary },
    { name: 'gsewebportal.com',             fn: scrapeGSEWebPortal },
    { name: 'afx.kwayisi.org',              fn: scrapeKwayisi },
  ];

  let stocks = [];

  for (const source of sources) {
    try {
      console.log(`\n🔄 Trying: ${source.name}`);
      const result = await source.fn();
      if (result.length >= 5) {
        console.log(`✅ Using ${source.name} — ${result.length} stocks`);
        stocks = result;
        break;
      }
      console.warn(`⚠️  ${source.name} returned only ${result.length} stocks — trying next`);
    } catch (err) {
      console.warn(`⚠️  ${source.name} threw: ${err.message}`);
    }
  }

  if (stocks.length === 0) {
    console.warn('⚠️  All sources failed');
    const count = await Stock.countDocuments();
    if (count === 0) {
      console.log('🌱 DB empty — seeding fallback...');
      await seedSampleData();
    } else {
      console.log(`ℹ️  Keeping existing ${count} stocks in DB`);
    }
    return [];
  }

  // Preserve existing fundamentals already in DB
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
            ticker: s.ticker, name: s.name,
            currentPrice: s.currentPrice, prevClose: s.prevClose,
            openPrice: s.openPrice, volume: s.volume,
            change: s.change, changePct: s.changePct,
            sector: SECTOR_MAP[s.ticker] || prev.sector || 'Other',
            marketCap: prev.marketCap, peRatio: prev.peRatio,
            eps: prev.eps, dividendYield: prev.dividendYield,
            dataSource: s.dataSource, lastUpdated: new Date(),
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
    const change = parseFloat((s.currentPrice - s.prevClose).toFixed(4));
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
          ...s, change, changePct, openPrice: s.prevClose,
          fiftyTwoWeekHigh: parseFloat(Math.max(...prices).toFixed(4)),
          fiftyTwoWeekLow: parseFloat(Math.min(...prices).toFixed(4)),
          lastUpdated: now, priceHistory, dataSource: 'seed_fallback',
        },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${fallback.length} fallback stocks`);
}

module.exports = { scrapeGSEData, seedSampleData, testAllSources };

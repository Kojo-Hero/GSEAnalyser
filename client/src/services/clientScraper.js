/**
 * clientScraper.js
 *
 * Since server-side scraping is blocked by GSE sites (they block cloud datacenter IPs),
 * this module runs IN THE BROWSER and fetches GSE data via a CORS proxy.
 * The parsed data is then POSTed to our backend /api/stocks/ingest to be saved in MongoDB.
 *
 * CORS proxies used (tried in order):
 *  1. allorigins.win  — free, reliable
 *  2. corsproxy.io    — fallback
 */

import api from './api';

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const GSE_URL = 'https://afx.kwayisi.org/gse/';

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
 * Fetch HTML via CORS proxy — tries each proxy in order
 */
async function fetchViaProxy(targetUrl) {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](targetUrl);
    try {
      console.log(`[clientScraper] Trying proxy ${i + 1}: ${proxyUrl.substring(0, 60)}...`);
      const res = await fetch(proxyUrl, {
        headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.length < 500) throw new Error('Response too short — likely an error page');
      console.log(`[clientScraper] Proxy ${i + 1} succeeded — ${html.length} bytes`);
      return html;
    } catch (err) {
      console.warn(`[clientScraper] Proxy ${i + 1} failed: ${err.message}`);
    }
  }
  return null;
}

/**
 * Parse afx.kwayisi.org/gse/ HTML using DOMParser (browser native — no cheerio needed)
 * Table structure: Ticker | Name | Volume | Price | Change
 */
function parseKwayisiHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const stocks = [];

  // Find the equities table inside div.t
  const tableContainer = doc.querySelector('div.t');
  if (!tableContainer) {
    console.warn('[clientScraper] div.t not found — trying all tables');
  }

  const tables = tableContainer
    ? tableContainer.querySelectorAll('table')
    : doc.querySelectorAll('table');

  let rows = [];
  tables.forEach(tbl => {
    const tbodyRows = Array.from(tbl.querySelectorAll('tbody tr'));
    if (tbodyRows.length > rows.length) rows = tbodyRows;
  });

  console.log(`[clientScraper] Found ${rows.length} table rows`);

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;

    const ticker = cells[0].textContent.trim().toUpperCase();
    const name = cells[1].textContent.trim();
    const volumeRaw = cells[2].textContent.trim().replace(/,/g, '');
    const priceRaw = cells[3].textContent.trim().replace(/,/g, '');
    const changeCell = cells.length >= 5 ? cells[4] : null;
    const changeRaw = changeCell ? changeCell.textContent.trim().replace(/,/g, '') : '0';

    if (!ticker || ticker.length > 15) return;

    const currentPrice = parseFloat(priceRaw) || 0;
    const volume = parseInt(volumeRaw, 10) || 0;
    const changeVal = parseFloat(changeRaw) || 0;
    const prevClose = parseFloat((currentPrice - changeVal).toFixed(4));
    const isLoss = changeCell && changeCell.classList.contains('lo');
    const changePct = prevClose > 0
      ? ((changeVal / prevClose) * 100).toFixed(2)
      : '0.00';

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
      dataSource: 'afx.kwayisi.org (client)',
    });
  });

  return stocks;
}

/**
 * Main export — fetch live GSE data from browser and POST to backend
 * Returns { stocks, source, count } on success
 * Throws on complete failure
 */
export async function clientScrapeAndIngest() {
  console.log('[clientScraper] Starting browser-side GSE fetch...');

  const html = await fetchViaProxy(GSE_URL);
  if (!html) {
    throw new Error('All CORS proxies failed — cannot fetch GSE data from browser');
  }

  const stocks = parseKwayisiHTML(html);
  console.log(`[clientScraper] Parsed ${stocks.length} stocks`);

  if (stocks.length === 0) {
    throw new Error('Parsed 0 stocks from GSE HTML — page structure may have changed');
  }

  // POST parsed data to backend for persistence
  const res = await api.post('/stocks/ingest', { stocks });
  console.log(`[clientScraper] Ingested ${res.data.count} stocks into backend`);

  return {
    stocks,
    count: stocks.length,
    source: 'afx.kwayisi.org via CORS proxy',
  };
}

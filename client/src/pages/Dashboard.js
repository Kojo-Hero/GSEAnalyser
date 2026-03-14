import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, RefreshCw, Activity,
  Search, Filter, CheckCircle, Clock, X
} from 'lucide-react';
import StockTable from '../components/StockTable';
import api from '../services/api';
import { clientScrapeAndIngest } from '../services/clientScraper';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

/* ── Modal: shows full list of gainers or losers ── */
function StockListModal({ title, stocks, type, onClose }) {
  if (!stocks) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-800 ${type === 'gainers' ? 'bg-emerald-900/20' : 'bg-red-900/20'}`}>
          <div className="flex items-center gap-2">
            {type === 'gainers'
              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
              : <TrendingDown className="w-5 h-5 text-red-400" />}
            <h2 className="text-base font-bold text-white">{title}</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${type === 'gainers' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {stocks.length}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-gray-800/60">
          {stocks.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No stocks to show</p>
          ) : (
            stocks.map((s, i) => {
              const pct = parseFloat(s.changePct);
              const isUp = pct > 0;
              return (
                <Link
                  key={s.ticker}
                  to={`/stocks/${s.ticker}`}
                  onClick={onClose}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/60 transition-colors group"
                >
                  {/* Rank */}
                  <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}</span>

                  {/* Ticker + Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      {s.ticker}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{s.name}</p>
                  </div>

                  {/* Price + Change */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold text-white">
                      GHS {s.currentPrice?.toFixed(2)}
                    </p>
                    <p className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? '+' : ''}{pct.toFixed(2)}%
                      <span className="text-gray-500 font-normal ml-1">
                        ({isUp ? '+' : ''}{s.change?.toFixed(4)})
                      </span>
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/80">
          <p className="text-xs text-gray-600 text-center">Click a stock to view full details</p>
        </div>
      </div>
    </div>
  );
}

function DataFreshnessBanner({ summary, stocks }) {
  if (!summary && !stocks?.length) return null;

  // Check data source from first stock
  const sampleStock = stocks?.[0];
  const isLive = sampleStock?.dataSource && !sampleStock.dataSource.startsWith('seed');
  const isSeed = sampleStock?.dataSource?.startsWith('seed');
  const lastUpdated = summary?.lastUpdated || sampleStock?.lastUpdated;
  const age = lastUpdated ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true }) : 'unknown';

  if (isSeed) {
    return (
      <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm">
        <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Reference / Cached Data</span>
          <span className="text-amber-400/80 ml-2">
            — Prices are from seeded reference values{lastUpdated ? ` (last saved ${age})` : ''}.
            Click <strong>Live Update</strong> to fetch today's live prices from GSE.
          </span>
        </div>
      </div>
    );
  }

  if (isLive) {
    return (
      <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-2.5 text-sm">
        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-emerald-300 font-medium">Live Data</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" /> Updated {age}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm">
      <Clock className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-gray-400">Last updated {age}</span>
    </div>
  );
}

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wakingUp, setWakingUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [sectors, setSectors] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null); // { type: 'gainers' | 'losers', stocks: [], title: '' }

  const [autoRefresh, setAutoRefresh] = useState(false);

  const retryTimerRef = useRef(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const params = { search, sector, page, limit: 20 };
      const [stocksRes, summaryRes, sectorsRes] = await Promise.all([
        api.get('/stocks', { params }),
        api.get('/stocks/market-summary'),
        api.get('/stocks/sectors'),
      ]);
      // Success — clear any pending retry
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setStocks(Array.isArray(stocksRes.data.stocks) ? stocksRes.data.stocks : []);
      setTotal(stocksRes.data.total || 0);
      const s = summaryRes.data;
      setSummary({
        ...s,
        topGainers: Array.isArray(s.topGainers) ? s.topGainers : [],
        topLosers: Array.isArray(s.topLosers) ? s.topLosers : [],
      });
      setSectors(Array.isArray(sectorsRes.data) ? sectorsRes.data : []);
      setWakingUp(false);
      setLoading(false);
    } catch (err) {
      if (isInitial) {
        // Backend cold-starting — keep loading=true & show waking up banner, retry after 8s
        setWakingUp(true);
        retryTimerRef.current = setTimeout(() => fetchData(true), 8000);
      } else {
        // Background refresh failed — keep existing data on screen
        toast.error('Failed to refresh data — showing last known data');
        setWakingUp(false);
        setLoading(false);
      }
    }
  }, [search, sector, page]);

  useEffect(() => {
    // Cancel any pending retry when dependencies change or on unmount
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    fetchData(true);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchData]);

  // Auto-refresh: try server scrape first, fall back to client scrape every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(async () => {
      try {
        const res = await api.post('/stocks/refresh');
        if (res.data.scraped === 0) {
          await clientScrapeAndIngest();
        }
        await fetchData();
        toast.success('Auto-refreshed live data', { duration: 2000 });
      } catch { /* silent */ }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Step 1: try server-side scrape
      const res = await api.post('/stocks/refresh');
      const data = res?.data || {};

      if (data.scraped > 0) {
        // Server scrape worked
        await fetchData();
        toast.success(`✅ Live data updated — ${data.scraped} stocks refreshed from GSE`);
        return;
      }

      // Step 2: server returned 0 — try client-side scrape via CORS proxy
      toast('🔄 Server sources blocked — trying browser fetch…', { icon: '🌐', duration: 3000 });
      const result = await clientScrapeAndIngest();
      await fetchData();
      toast.success(`✅ ${result.count} stocks fetched via browser from ${result.source}`);

    } catch (err) {
      // Both failed
      await fetchData(); // re-fetch to ensure UI has latest cached data
      toast('⚠️ All live sources unavailable — showing cached data', { icon: '⚠️', duration: 5000 });
      console.warn('[handleRefresh] All sources failed:', err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const openModal = async (type) => {
    // Fetch ALL stocks (no page limit) to show the complete gainer/loser list
    try {
      const res = await api.get('/stocks', { params: { limit: 200, page: 1 } });
      const all = (res.data.stocks || [])
        .filter(s => type === 'gainers'
          ? parseFloat(s.changePct) > 0
          : parseFloat(s.changePct) < 0
        )
        .sort((a, b) => type === 'gainers'
          ? parseFloat(b.changePct) - parseFloat(a.changePct)
          : parseFloat(a.changePct) - parseFloat(b.changePct)
        );
      setModal({ type, stocks: all, title: type === 'gainers' ? 'Top Gainers' : 'Top Losers' });
    } catch {
      // Fallback to already-loaded stocks if API fails
      const all = [...stocks]
        .filter(s => type === 'gainers'
          ? parseFloat(s.changePct) > 0
          : parseFloat(s.changePct) < 0
        )
        .sort((a, b) => type === 'gainers'
          ? parseFloat(b.changePct) - parseFloat(a.changePct)
          : parseFloat(a.changePct) - parseFloat(b.changePct)
        );
      setModal({ type, stocks: all, title: type === 'gainers' ? 'Top Gainers' : 'Top Losers' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Modal */}
      {modal && (
        <StockListModal
          title={modal.title}
          stocks={modal.stocks}
          type={modal.type}
          onClose={() => setModal(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ghana Stock Exchange</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRefresh(false)}
            disabled={refreshing}
            title="Scrape latest prices from and update the database"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Updating…' : 'Live Update'}
          </button>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            title="Auto-refresh every 5 minutes during the trading day"
            className={`btn-secondary flex items-center gap-2 text-sm transition-colors ${
              autoRefresh
                ? 'border-emerald-600 text-emerald-400 bg-emerald-900/20'
                : 'text-gray-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
        </div>
      </div>

      {/* Waking up banner */}
      {wakingUp && (
        <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 text-sm">
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
          <div>
            <span className="font-semibold text-blue-300">Server is waking up…</span>
            <span className="text-blue-400/80 ml-2">This takes up to 30 seconds on the free tier. Data will appear automatically.</span>
          </div>
        </div>
      )}

      {/* Data Freshness Banner */}
      <DataFreshnessBanner summary={summary} stocks={stocks} />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total Listed</span>
            <span className="stat-value">{summary.totalStocks}</span>
            <span className="text-xs text-gray-500">Companies</span>
          </div>
          <button
            onClick={() => openModal('gainers')}
            className="stat-card hover:border-emerald-700/60 hover:bg-emerald-900/10 transition-colors cursor-pointer w-full"
          >
            <span className="stat-label flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />Gainers
            </span>
            <span className="stat-value text-emerald-400">{summary.advancers}</span>
            <span className="text-xs text-emerald-600">Up today</span>
          </button>
          <button
            onClick={() => openModal('losers')}
            className="stat-card hover:border-red-700/60 hover:bg-red-900/10 transition-colors cursor-pointer w-full"
          >
            <span className="stat-label flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3 text-red-400" />Losers
            </span>
            <span className="stat-value text-red-400">{summary.decliners}</span>
            <span className="text-xs text-red-600">Down today</span>
          </button>
          <div className="stat-card">
            <span className="stat-label"><Activity className="w-3 h-3 inline mr-1" />Total Volume</span>
            <span className="stat-value text-blue-400">
              {summary.totalVolume > 1e6
                ? `${(summary.totalVolume / 1e6).toFixed(1)}M`
                : summary.totalVolume?.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">Shares traded</span>
          </div>
        </div>
      )}

      {/* Top Movers */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Top Gainers
            </h3>
            <div className="space-y-2">
              {summary.topGainers?.map((s) => (
                <Link key={s.ticker} to={`/stocks/${s.ticker}`} className="flex items-center justify-between hover:bg-gray-800/50 px-2 py-1.5 rounded-lg transition-colors">
                  <div>
                    <span className="font-bold text-sm text-white">{s.ticker}</span>
                    <span className="text-xs text-gray-500 ml-2">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono text-white">{s.currentPrice?.toFixed(4)}</span>
                    <span className="badge-up ml-2 text-xs">+{parseFloat(s.changePct).toFixed(2)}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" /> Top Losers
            </h3>
            <div className="space-y-2">
              {summary.topLosers?.map((s) => (
                <Link key={s.ticker} to={`/stocks/${s.ticker}`} className="flex items-center justify-between hover:bg-gray-800/50 px-2 py-1.5 rounded-lg transition-colors">
                  <div>
                    <span className="font-bold text-sm text-white">{s.ticker}</span>
                    <span className="text-xs text-gray-500 ml-2">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono text-white">{s.currentPrice?.toFixed(4)}</span>
                    <span className="badge-down ml-2 text-xs">{parseFloat(s.changePct).toFixed(2)}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search by ticker or company name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            className="input pl-9 pr-8 min-w-[160px]"
            value={sector}
            onChange={(e) => { setSector(e.target.value); setPage(1); }}
          >
            <option value="">All Sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Stocks Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">All Equities</h2>
          <span className="text-sm text-gray-500">{total} stocks</span>
        </div>
        <StockTable stocks={stocks} loading={loading} />

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm px-3 py-1.5">
              Previous
            </button>
            <span className="text-sm text-gray-400">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="btn-secondary text-sm px-3 py-1.5">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

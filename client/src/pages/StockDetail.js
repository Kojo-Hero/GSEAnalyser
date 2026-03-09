import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, Brain, FileDown,
  BarChart2, Loader2, Star, StarOff, Plus, AlertTriangle, Clock
} from 'lucide-react';
import PriceChart from '../components/PriceChart';
import TradingViewWidget from '../components/TradingViewWidget';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const CHART_MODES = ['Price Chart', 'Price + Volume'];

export default function StockDetail() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stock, setStock] = useState(null);
  const [history, setHistory] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingStock, setLoadingStock] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [chartMode, setChartMode] = useState(0);
  const [historyDays, setHistoryDays] = useState(60);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingStock(true);
      try {
        const [stockRes, histRes] = await Promise.all([
          api.get(`/stocks/${ticker}`),
          api.get(`/stocks/${ticker}/history`, { params: { days: historyDays } }),
        ]);
        setStock(stockRes.data);
        setHistory(histRes.data.history || []);
      } catch (err) {
        if (err.response?.status === 404) toast.error('Stock not found');
        else toast.error('Failed to load stock');
      } finally {
        setLoadingStock(false);
      }
    })();
  }, [ticker, historyDays]);

  const handleAIAnalysis = async () => {
    setLoadingAI(true);
    setAiAnalysis(null);
    try {
      const res = await api.get(`/stocks/${ticker}/ai-analysis`);
      setAiAnalysis(res.data.analysis);
    } catch {
      toast.error('Analysis failed. Try again later.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const res = await api.post('/reports/generate', { ticker }, { timeout: 120000 });
      const reportId = res.data.reportId;
      const fileName = res.data.fileName || `${ticker}_report.pdf`;

      // Download the file as a blob so it saves instead of opening a blank tab
      const dlRes = await api.get(`/reports/${reportId}/download`, {
        responseType: 'blob',
        timeout: 60000,
      });
      const blob = new Blob([dlRes.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
      toast.success('Report downloaded!');
    } catch (err) {
      console.error('Report generation error:', err);
      const msg = err.response?.data?.error || err.message || 'Report generation failed';
      toast.error(msg);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleWatchlist = async () => {
    if (!user) return toast.error('Please sign in to use watchlist');
    try {
      if (inWatchlist) {
        await api.delete(`/portfolio/watchlist/${ticker}`);
        setInWatchlist(false);
        toast.success('Removed from watchlist');
      } else {
        await api.post('/portfolio/watchlist', { ticker });
        setInWatchlist(true);
        toast.success('Added to watchlist on Portfolio page');
      }
    } catch {
      toast.error('Watchlist update failed');
    }
  };

  if (loadingStock) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!stock) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Stock not found</p>
      <Link to="/" className="btn-primary mt-4 inline-block">Back to Dashboard</Link>
    </div>
  );

  const changeVal = parseFloat(stock.changePct || 0);
  const isUp = changeVal >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-white">{stock.ticker}</h1>
              <p className="text-gray-400">{stock.name}</p>
            </div>
            <div className="text-left">
              <div className="text-3xl font-bold text-white font-mono">
                GHS {stock.currentPrice?.toFixed(4)}
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isUp ? '+' : ''}{stock.change?.toFixed(4)} ({isUp ? '+' : ''}{changeVal.toFixed(2)}%)
              </div>
            </div>
            <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">{stock.sector}</span>
            {/* Data freshness indicator */}
            {stock.dataSource?.startsWith('seed') ? (
              <span className="flex items-center gap-1 text-xs bg-amber-900/30 text-amber-400 border border-amber-700/40 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Reference price
              </span>
            ) : stock.lastUpdated ? (
              <span className="flex items-center gap-1 text-xs bg-emerald-900/20 text-emerald-400 border border-emerald-700/30 px-2 py-1 rounded-full">
                <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(stock.lastUpdated), { addSuffix: true })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleWatchlist} className="btn-secondary flex items-center gap-2 text-sm">
            {inWatchlist ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            {inWatchlist ? 'Unwatch' : 'Watchlist'}
          </button>
          <Link to="/portfolio" state={{ addTicker: ticker }} className="btn-success flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add to Portfolio
          </Link>
          <button onClick={handleGenerateReport} disabled={loadingReport} className="btn-secondary flex items-center gap-2 text-sm">
            {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Download Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Prev Close', value: `GHS ${stock.prevClose?.toFixed(4) || '—'}` },
          { label: 'Open', value: `GHS ${stock.openPrice?.toFixed(4) || '—'}` },
          { label: 'Volume', value: stock.volume?.toLocaleString() || '—' },
          { label: 'Market Cap', value: stock.marketCap ? `GHS ${(stock.marketCap / 1e9).toFixed(2)}B` : '—' },
          { label: 'P/E Ratio', value: stock.peRatio?.toFixed(2) || '—' },
          { label: 'Div. Yield', value: stock.dividendYield ? `${stock.dividendYield}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card py-3 px-4">
            <p className="stat-label">{label}</p>
            <p className="text-sm font-semibold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" /> Price Chart
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg bg-gray-800 p-0.5 text-xs">
              {CHART_MODES.map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(i)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${chartMode === i ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {chartMode === 0 && (
              <div className="flex rounded-lg bg-gray-800 p-0.5 text-xs">
                {[30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setHistoryDays(d)}
                    className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${historyDays === d ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {chartMode === 0 ? (
          <PriceChart history={history} ticker={ticker} currentPrice={stock.currentPrice} />
        ) : (
          <TradingViewWidget ticker={ticker} history={history} height={420} />
        )}
      </div>

      {/* AI Analysis */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" /> Analyst Report
          </h2>
          <button
            onClick={handleAIAnalysis}
            disabled={loadingAI}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loadingAI ? 'Analysing…' : aiAnalysis ? 'Re-analyse' : 'Generate Analysis'}
          </button>
        </div>
        {!aiAnalysis && !loadingAI && (
          <div className="bg-gray-800/50 border border-gray-700 border-dashed rounded-xl p-8 text-center">
            <Brain className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Click "Generate Analysis" to get an investment report for {ticker}</p>
          </div>
        )}
        {loadingAI && (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            <p className="text-gray-400 text-sm">Analysing {ticker}…</p>
          </div>
        )}
        {aiAnalysis && (
          <div className="prose-dark">
            <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  Calculator, Loader2, ChevronDown, ChevronUp, HelpCircle, Search, X, CheckCircle
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const SECTOR_DEFAULTS = {
  Banking: { wacc: 0.20, g1: 0.10, g2: 0.04, years: 5 },
  Telecoms: { wacc: 0.17, g1: 0.12, g2: 0.04, years: 5 },
  'Oil & Gas': { wacc: 0.22, g1: 0.08, g2: 0.03, years: 5 },
  'Consumer Goods': { wacc: 0.18, g1: 0.09, g2: 0.04, years: 5 },
};

export default function Valuation() {
  const [ticker, setTicker] = useState('');
  const [loadingTicker, setLoadingTicker] = useState(false);
  const [fetchedStock, setFetchedStock] = useState(null);
  const [form, setForm] = useState({
    freeCashFlow: '',
    growthRateStage1: 12,
    growthRateStage2: 4,
    stage1Years: 5,
    wacc: 18,
    netDebt: 0,
    sharesOutstanding: 100,
    cashAndEquivalents: 0,
    currentPrice: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const lookupTicker = async () => {
    if (!ticker.trim()) return toast.error('Enter a ticker symbol');
    setLoadingTicker(true);
    setFetchedStock(null);
    try {
      const res = await api.get(`/stocks/${ticker.trim().toUpperCase()}`);
      const s = res.data;
      setFetchedStock(s);

      // Apply sector defaults for WACC & growth rates
      const sectorKey = Object.keys(SECTOR_DEFAULTS).find(
        (k) => k.toLowerCase() === (s.sector || '').toLowerCase()
      );
      const defaults = sectorKey ? SECTOR_DEFAULTS[sectorKey] : null;

      setForm((f) => ({
        ...f,
        currentPrice:      s.currentPrice   ? String(parseFloat(s.currentPrice).toFixed(4)) : f.currentPrice,
        sharesOutstanding: s.sharesOutstanding
          ? parseFloat((s.sharesOutstanding / 1e6).toFixed(2))   // DB stores raw shares → convert to millions
          : (s.marketCap && s.currentPrice
              ? parseFloat((s.marketCap / s.currentPrice / 1e6).toFixed(2))  // derive from market cap
              : f.sharesOutstanding),
        // Apply sector-tuned WACC & growth only if we have a matching sector
        ...(defaults && {
          wacc:              defaults.wacc * 100,
          growthRateStage1:  defaults.g1   * 100,
          growthRateStage2:  defaults.g2   * 100,
          stage1Years:       defaults.years,
        }),
      }));

      toast.success(`Loaded ${s.name} (${s.ticker})`);
    } catch (err) {
      if (err.response?.status === 404) toast.error(`Ticker "${ticker.toUpperCase()}" not found`);
      else toast.error('Failed to load stock data');
    } finally {
      setLoadingTicker(false);
    }
  };

  const clearStock = () => {
    setFetchedStock(null);
    setTicker('');
  };

  const FAQS = [
    {
      q: 'What is the DCF Valuation Model?',
      a: 'DCF (Discounted Cash Flow) estimates the intrinsic (fair) value of a GSE-listed stock by projecting its future cash flows and discounting them back to today\'s money. It answers the question: "What is this stock actually worth right now, based on how much cash it will generate in the future?"',
    },
    {
      q: 'What is Free Cash Flow (FCF)?',
      a: 'Free Cash Flow is the cash profit a company generates after paying for its operating expenses and capital expenditures. Enter it in GHS millions — for example, if a company earned GHS 150 million in free cash flow last year, enter 150.',
    },
    {
      q: 'What is WACC?',
      a: 'WACC (Weighted Average Cost of Capital) is your required rate of return — it represents the minimum return you expect to compensate for the risk of investing. In Ghana, WACC is typically higher (18–22%) due to inflation, currency risk, and the risk-free rate of government bonds. If WACC is too low, the model will overvalue the stock.',
    },
    {
      q: 'What are Stage 1 and Stage 2 growth rates?',
      a: 'The model uses a two-stage approach. Stage 1 is the high-growth phase — how fast you expect the company\'s FCF to grow over the next 5–7 years (e.g. 12%). Stage 2 (Terminal Growth Rate) is the slow, sustainable growth rate the company settles into forever after Stage 1 ends (e.g. 4%). The terminal rate must always be lower than WACC.',
    },
    {
      q: 'How is the Terminal Value calculated?',
      a: 'After Stage 1, the model assumes the company grows at the terminal rate forever. Terminal Value = FCF_last_year × (1 + Terminal Growth Rate) ÷ (WACC − Terminal Growth Rate). This is based on the Gordon Growth Model. The Terminal Value is then discounted back to today using WACC.',
    },
    {
      q: 'How do I get from Enterprise Value to Intrinsic Value per Share?',
      a: 'Enterprise Value = PV of Stage 1 cash flows + PV of Terminal Value. Equity Value = Enterprise Value − Net Debt + Cash & Equivalents. Intrinsic Value per Share = Equity Value ÷ Shares Outstanding. If Intrinsic Value > Current Market Price, the stock may be undervalued (potential Buy). If lower, it may be overvalued.',
    },
    {
      q: 'What are the sector preset defaults?',
      a: 'The presets use Ghana-specific assumptions tuned for each industry. Banking uses 20% WACC / 10% Stage 1 growth; Telecoms uses 17% WACC / 12% growth; Oil & Gas uses 22% WACC / 8% growth; Consumer Goods uses 18% WACC / 9% growth. These reflect Ghana\'s higher cost of capital compared to developed markets.',
    },
    {
      q: 'What is the Sensitivity Analysis table?',
      a: 'Because DCF results are highly sensitive to assumptions, the sensitivity table runs the entire model across a range of WACC values (±3%) and terminal growth rates (±2%) simultaneously. Green values indicate a positive intrinsic value, red indicates negative. This shows you how much the fair value changes if your assumptions are slightly off.',
    },
    {
      q: 'What are the limitations of this model?',
      a: 'DCF is only as good as its inputs. Errors in FCF estimates or growth assumptions can significantly change the result. The model does not account for qualitative factors like management quality, political risk, or regulatory changes specific to Ghana. Always use DCF alongside other valuation methods (P/E, P/B ratios) and the AI analysis for a complete picture.',
    },
  ];

  const applyDefaults = (sector) => {
    const d = SECTOR_DEFAULTS[sector];
    if (d) setForm((f) => ({ ...f, wacc: d.wacc * 100, growthRateStage1: d.g1 * 100, growthRateStage2: d.g2 * 100, stage1Years: d.years }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/valuation/dcf', {
        freeCashFlow: parseFloat(form.freeCashFlow),
        growthRateStage1: form.growthRateStage1 / 100,
        growthRateStage2: form.growthRateStage2 / 100,
        stage1Years: parseInt(form.stage1Years),
        wacc: form.wacc / 100,
        netDebt: parseFloat(form.netDebt) || 0,
        sharesOutstanding: parseFloat(form.sharesOutstanding),
        cashAndEquivalents: parseFloat(form.cashAndEquivalents) || 0,
      });
      setResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'DCF calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const f = (v) => parseFloat(form[v]);
  const upside = result && form.currentPrice
    ? (((result.intrinsicValuePerShare - parseFloat(form.currentPrice)) / parseFloat(form.currentPrice)) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">DCF Valuation Model</h1>
        <p className="text-sm text-gray-500 mt-0.5">Discounted Cash Flow — Ghana-optimised defaults</p>
      </div>

      {/* ── Live Ticker Lookup ────────────────────────────────────────────── */}
      <div className="card">
        <p className="text-xs text-gray-400 mb-2 font-medium">Auto-fill from Live Stock Data</p>
        <div className="flex gap-2">
          <input
            className="input flex-1 uppercase"
            placeholder="e.g. GCB, CPC, MTNGH"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && lookupTicker()}
            disabled={loadingTicker}
          />
          <button
            onClick={lookupTicker}
            disabled={loadingTicker}
            className="btn-primary flex items-center gap-2 px-4"
          >
            {loadingTicker
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />}
            Lookup
          </button>
          {fetchedStock && (
            <button onClick={clearStock} className="btn-secondary px-3" title="Clear">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Fetched stock summary banner */}
        {fetchedStock && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/40">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold text-white">{fetchedStock.name} ({fetchedStock.ticker})</span>
            <span className="text-xs text-gray-400">Sector: <span className="text-gray-200">{fetchedStock.sector || 'N/A'}</span></span>
            <span className="text-xs text-gray-400">Price: <span className="text-yellow-300">GHS {parseFloat(fetchedStock.currentPrice).toFixed(4)}</span></span>
            {fetchedStock.marketCap > 0 && (
              <span className="text-xs text-gray-400">Mkt Cap: <span className="text-blue-300">GHS {(fetchedStock.marketCap / 1e9).toFixed(2)}B</span></span>
            )}
            <span className="text-xs text-emerald-400">✓ Price & shares pre-filled · Sector defaults applied</span>
          </div>
        )}
      </div>

      {/* Quick Sector Presets */}
      <div className="card">
        <p className="text-xs text-gray-400 mb-2 font-medium">Quick Sector Presets</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SECTOR_DEFAULTS).map((sector) => (
            <button key={sector} onClick={() => applyDefaults(sector)} className="btn-secondary text-xs px-3 py-1.5">
              {sector}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Cash Flow Inputs</h3>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Base Year Free Cash Flow (GHS millions) *
            </label>
            <input
              className="input"
              type="number"
              step="0.01"
              required
              placeholder="e.g. 150 (= GHS 150M FCF)"
              value={form.freeCashFlow}
              onChange={(e) => setForm({ ...form, freeCashFlow: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Stage 1 Growth Rate (%) — High Growth Phase
            </label>
            <input className="input" type="number" step="0.1" value={form.growthRateStage1}
              onChange={(e) => setForm({ ...form, growthRateStage1: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Stage 1 Duration (Years)
            </label>
            <input className="input" type="number" min="1" max="15" value={form.stage1Years}
              onChange={(e) => setForm({ ...form, stage1Years: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Terminal Growth Rate (%) — Long-run Rate
            </label>
            <input className="input" type="number" step="0.1" value={form.growthRateStage2}
              onChange={(e) => setForm({ ...form, growthRateStage2: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              WACC (%) — Weighted Avg Cost of Capital
            </label>
            <input className="input" type="number" step="0.1" value={form.wacc}
              onChange={(e) => setForm({ ...form, wacc: e.target.value })} />
            <p className="text-xs text-gray-600 mt-1">Ghana risk-free rate ~20–22% typical for 2025/26</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Balance Sheet & Market</h3>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Net Debt (GHS millions) — negative = net cash
            </label>
            <input className="input" type="number" step="0.01" value={form.netDebt}
              onChange={(e) => setForm({ ...form, netDebt: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Cash & Equivalents (GHS millions)
            </label>
            <input className="input" type="number" step="0.01" value={form.cashAndEquivalents}
              onChange={(e) => setForm({ ...form, cashAndEquivalents: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Shares Outstanding (millions)
            </label>
            <input className="input" type="number" step="0.01" value={form.sharesOutstanding}
              onChange={(e) => setForm({ ...form, sharesOutstanding: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Current Market Price (GHS) — for upside calc
            </label>
            <input className="input" type="number" step="0.0001" placeholder="Optional"
              value={form.currentPrice}
              onChange={(e) => setForm({ ...form, currentPrice: e.target.value })} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Run DCF Model
          </button>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <span className="stat-label">Intrinsic Value / Share</span>
              <span className="stat-value text-yellow-400">GHS {result.intrinsicValuePerShare?.toFixed(4)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Enterprise Value</span>
              <span className="stat-value text-blue-400">GHS {(result.enterpriseValue / 1000)?.toFixed(2)}B</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Equity Value</span>
              <span className="stat-value">GHS {result.equityValue?.toFixed(1)}M</span>
            </div>
            {upside !== null && (
              <div className="stat-card">
                <span className="stat-label">Upside / Downside</span>
                <span className={`stat-value ${parseFloat(upside) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {parseFloat(upside) >= 0 ? '+' : ''}{upside}%
                </span>
              </div>
            )}
          </div>

          {/* Projections Table */}
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-white text-sm">FCF Projections</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/40">
                    <th className="text-left px-5 py-2.5 text-xs text-gray-400">Year</th>
                    <th className="text-right px-5 py-2.5 text-xs text-gray-400">FCF (GHSm)</th>
                    <th className="text-right px-5 py-2.5 text-xs text-gray-400">PV (GHSm)</th>
                    <th className="text-right px-5 py-2.5 text-xs text-gray-400">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {result.projections?.map((p) => (
                    <tr key={p.year} className="hover:bg-gray-800/30">
                      <td className="px-5 py-2.5 text-gray-300">Year {p.year}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-white">{p.fcf?.toFixed(2)}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-blue-300">{p.pv?.toFixed(2)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-400">{(p.growthRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-800/50 font-semibold">
                    <td className="px-5 py-2.5 text-gray-300">Terminal Value</td>
                    <td className="px-5 py-2.5 text-right font-mono text-white">{result.terminalValue?.toFixed(2)}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-yellow-300">{result.pvTerminalValue?.toFixed(2)}</td>
                    <td className="px-5 py-2.5 text-right text-gray-500">{result.inputs?.growthRateStage2}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sensitivity Table */}
          <div className="card">
            <button
              onClick={() => setShowSensitivity(!showSensitivity)}
              className="flex items-center gap-2 w-full text-left font-semibold text-white text-sm"
            >
              {showSensitivity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Sensitivity Analysis (WACC vs Terminal Growth Rate)
            </button>
            {showSensitivity && (
              <div className="overflow-x-auto mt-4">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-3 py-2 text-gray-500">WACC \ TGR</th>
                      {result.tgrLabels?.map((t) => (
                        <th key={t} className="text-right px-3 py-2 text-gray-400">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.sensitivityTable?.map((row) => (
                      <tr key={row.wacc} className="hover:bg-gray-800/30">
                        <td className="px-3 py-2 text-gray-400 font-medium">{row.wacc}</td>
                        {result.tgrLabels?.map((t) => {
                          const key = `tgr_${t.replace('%', '')}`;
                          const val = row[key];
                          const highlight = val !== 'N/A' && parseFloat(val) > 0;
                          return (
                            <td key={t} className={`px-3 py-2 text-right font-mono ${highlight ? 'text-emerald-400' : val === 'N/A' ? 'text-gray-600' : 'text-red-400'}`}>
                              {val === 'N/A' ? '—' : val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAQ Section ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white text-base">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-200">{faq.q}</span>
                {openFaq === i
                  ? <ChevronUp className="w-4 h-4 text-blue-400 shrink-0 ml-3" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-3" />
                }
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 pt-1 bg-gray-800/30">
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

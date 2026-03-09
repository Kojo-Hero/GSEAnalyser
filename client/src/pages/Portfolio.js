import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Plus, Trash2, TrendingUp, TrendingDown,
  Loader2, Star, Eye, PieChart as PieChartIcon, Pencil, Check, X
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

export default function Portfolio() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({ ticker: '', shares: '', avgCost: '', notes: '' });
  const [adding, setAdding] = useState(false);
  const [watchlistStocks, setWatchlistStocks] = useState([]);
  const [editingTicker, setEditingTicker] = useState(null); // ticker currently being edited
  const [editForm, setEditForm] = useState({ shares: '', avgCost: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchPortfolio = async () => {
    if (!user) return setLoading(false);
    setLoading(true);
    try {
      const res = await api.get('/portfolio');
      setPortfolio(res.data);
    } catch (err) {
      toast.error('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPortfolio(); }, [user]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.ticker || !addForm.shares || !addForm.avgCost) return toast.error('All fields required');
    setAdding(true);
    try {
      await api.post('/portfolio/holdings', {
        ticker: addForm.ticker.toUpperCase(),
        shares: parseFloat(addForm.shares),
        avgCost: parseFloat(addForm.avgCost),
        notes: addForm.notes,
      });
      setAddForm({ ticker: '', shares: '', avgCost: '', notes: '' });
      await fetchPortfolio();
      toast.success('Holding added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add holding');
    } finally {
      setAdding(false);
    }
  };

  // ...existing code...

  const handleSaveEdit = async (ticker) => {
    if (!editForm.shares || !editForm.avgCost) return toast.error('Shares and avg cost are required');
    setSaving(true);
    try {
      await api.put(`/portfolio/holdings/${ticker}`, {
        shares: parseFloat(editForm.shares),
        avgCost: parseFloat(editForm.avgCost),
        notes: editForm.notes,
      });
      setEditingTicker(null);
      await fetchPortfolio();
      toast.success(`${ticker} updated`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update holding');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (ticker) => {
    if (!window.confirm(`Remove ${ticker} from portfolio?`)) return;
    try {
      await api.delete(`/portfolio/holdings/${ticker}`);
      await fetchPortfolio();
      toast.success(`${ticker} removed`);
    } catch {
      toast.error('Failed to remove holding');
    }
  };

  const handleRemoveWatchlist = async (ticker) => {
    try {
      await api.delete(`/portfolio/watchlist/${ticker}`);
      await fetchPortfolio();
    } catch {}
  };

  const handleEdit = (h) => {
    setEditingTicker(h.ticker);
    setEditForm({ shares: h.shares, avgCost: h.avgCost, notes: h.notes || '' });
  };

  const handleCancelEdit = () => {
    setEditingTicker(null);
    setEditForm({ shares: '', avgCost: '', notes: '' });
  };


  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Briefcase className="w-12 h-12 text-gray-600" />
        <p className="text-gray-400 text-lg font-medium">Sign in to track your portfolio</p>
        <div className="flex gap-3">
          <Link to="/login" className="btn-primary">Sign In</Link>
          <Link to="/register" className="btn-secondary">Register</Link>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );

  const pieData = portfolio?.holdings?.map((h) => ({
    name: h.ticker,
    value: parseFloat(h.value?.toFixed(2)),
  })) || [];

  const totalPnLPositive = (portfolio?.totalPnL || 0) >= 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">My Portfolio</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your GSE investments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total Value</span>
          <span className="stat-value text-blue-400">GHS {portfolio?.totalValue?.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Invested</span>
          <span className="stat-value">GHS {portfolio?.totalCost?.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total P&amp;L</span>
          <span className={`stat-value ${totalPnLPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnLPositive ? '+' : ''}GHS {portfolio?.totalPnL?.toFixed(2)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Return</span>
          <span className={`stat-value ${totalPnLPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnLPositive ? '+' : ''}{portfolio?.totalPnLPct?.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Holdings + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Holdings Table */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">Holdings</h2>
          </div>
          {!portfolio?.holdings?.length ? (
            <div className="text-center py-12 text-gray-500 text-sm">No holdings yet. Add your first stock below.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/30">
                    <th className="text-left px-5 py-2.5 text-xs text-gray-400">Ticker</th>
                    <th className="text-right px-4 py-2.5 text-xs text-gray-400">Shares</th>
                    <th className="text-right px-4 py-2.5 text-xs text-gray-400">Avg Cost</th>
                    <th className="text-right px-4 py-2.5 text-xs text-gray-400">Price</th>
                    <th className="text-right px-4 py-2.5 text-xs text-gray-400">Value</th>
                    <th className="text-right px-4 py-2.5 text-xs text-gray-400">P&amp;L</th>
                    <th className="px-4 py-2.5 text-xs text-gray-400 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {portfolio.holdings.map((h) => {
                    const up = h.pnl >= 0;
                    const isEditing = editingTicker === h.ticker;
                    return (
                      <tr key={h.ticker} className={`transition-colors ${isEditing ? 'bg-blue-950/30' : 'hover:bg-gray-800/30'}`}>
                        <td className="px-5 py-3">
                          <Link to={`/stocks/${h.ticker}`} className="font-bold text-blue-400 hover:text-blue-300">{h.ticker}</Link>
                          <p className="text-xs text-gray-500">{h.name}</p>
                          {isEditing && editForm.notes !== undefined && (
                            <input
                              className="input text-xs mt-1 py-1 w-full"
                              placeholder="Notes (optional)"
                              value={editForm.notes}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              className="input text-xs text-right w-24 py-1"
                              type="number"
                              min="0"
                              step="any"
                              value={editForm.shares}
                              onChange={(e) => setEditForm({ ...editForm, shares: e.target.value })}
                            />
                          ) : (
                            <span className="text-gray-300">{h.shares?.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              className="input text-xs text-right w-24 py-1"
                              type="number"
                              min="0"
                              step="0.0001"
                              value={editForm.avgCost}
                              onChange={(e) => setEditForm({ ...editForm, avgCost: e.target.value })}
                            />
                          ) : (
                            <span className="text-gray-400">{h.avgCost?.toFixed(4)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-mono">{h.currentPrice?.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-white">GHS {h.value?.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right text-xs font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '+' : ''}GHS {h.pnl?.toFixed(2)}<br />
                          <span className="opacity-70">({up ? '+' : ''}{h.pnlPct?.toFixed(2)}%)</span>
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(h.ticker)}
                                disabled={saving}
                                className="text-emerald-400 hover:text-emerald-300 transition-colors"
                                title="Save changes"
                              >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-gray-500 hover:text-gray-300 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(h)}
                                className="text-gray-500 hover:text-blue-400 transition-colors"
                                title="Edit holding"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemove(h.ticker)}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                                title="Remove holding"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocation Pie */}
        <div className="card">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-blue-400" /> Allocation
          </h2>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`GHS ${v}`, 'Value']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No holdings</div>
          )}
        </div>
      </div>

      {/* Add Holding Form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" /> Add Holding
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ticker *</label>
            <input className="input" placeholder="GCB" value={addForm.ticker} onChange={(e) => setAddForm({ ...addForm, ticker: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Shares *</label>
            <input className="input" type="number" placeholder="1000" value={addForm.shares} onChange={(e) => setAddForm({ ...addForm, shares: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Avg Cost (GHS) *</label>
            <input className="input" type="number" step="0.0001" placeholder="5.20" value={addForm.avgCost} onChange={(e) => setAddForm({ ...addForm, avgCost: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input className="input" placeholder="Optional" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <button type="submit" disabled={adding} className="btn-success flex items-center gap-2">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to Portfolio
            </button>
          </div>
        </form>
      </div>

      {/* Watchlist */}
      {portfolio?.watchlist?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-yellow-400" /> Watchlist
          </h2>
          <div className="flex flex-wrap gap-2">
            {portfolio.watchlist.map((t) => (
              <div key={t} className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
                <Link to={`/stocks/${t}`} className="text-sm font-bold text-blue-400 hover:text-blue-300">{t}</Link>
                <button onClick={() => handleRemoveWatchlist(t)} className="text-gray-600 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

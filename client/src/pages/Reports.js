import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Plus, Loader2, FileDown } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(null); // holds the id being downloaded
  const [genForm, setGenForm] = useState({ ticker: '', fcf: '', wacc: 18, g1: 12, g2: 4, shares: 100 });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.ticker) return toast.error('Ticker required');
    setGenerating(true);
    try {
      const payload = {
        ticker: genForm.ticker.toUpperCase(),
        dcfParams: genForm.fcf ? {
          freeCashFlow: parseFloat(genForm.fcf),
          growthRateStage1: genForm.g1 / 100,
          growthRateStage2: genForm.g2 / 100,
          wacc: genForm.wacc / 100,
          sharesOutstanding: parseFloat(genForm.shares),
        } : undefined,
      };
      const res = await api.post('/reports/generate', payload, { timeout: 120000 });
      toast.success('Report generated!');
      await fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (id, fileName) => {
    setDownloading(id);
    try {
      const res = await api.get(`/reports/${id}/download`, {
        responseType: 'blob',
        timeout: 60000,
      });

      // If the server returned JSON (error) instead of a PDF, surface it
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await res.data.text();
        const json = JSON.parse(text);
        throw new Error(json.error || 'Download failed');
      }

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `report_${id}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Delay revoke so the browser has time to start the download
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
      toast.success('Download started!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error(err.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await api.delete(`/reports/${id}`);
      await fetchReports();
      toast.success('Report deleted');
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Analyst Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate and download AI-powered PDF reports</p>
      </div>

      {/* Generate Form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" /> Generate New Report
        </h2>
        <form onSubmit={handleGenerate} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-4 md:col-span-1">
            <label className="block text-xs text-gray-400 mb-1">Ticker *</label>
            <input className="input" placeholder="e.g. GCB" value={genForm.ticker}
              onChange={(e) => setGenForm({ ...genForm, ticker: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">FCF (GHSm, optional)</label>
            <input className="input" type="number" placeholder="150" value={genForm.fcf}
              onChange={(e) => setGenForm({ ...genForm, fcf: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">WACC (%)</label>
            <input className="input" type="number" value={genForm.wacc}
              onChange={(e) => setGenForm({ ...genForm, wacc: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Shares (M)</label>
            <input className="input" type="number" value={genForm.shares}
              onChange={(e) => setGenForm({ ...genForm, shares: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <button type="submit" disabled={generating} className="btn-primary flex items-center gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>
      ) : !reports.length ? (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No reports generated yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r._id} className="card flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="bg-blue-600/20 p-2.5 rounded-lg shrink-0">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{r.companyName || r.ticker} — {r.ticker}</p>
                  <p className="text-xs text-gray-500">
                    {r.createdAt ? format(new Date(r.createdAt), 'PPP') : ''} ·{' '}
                    <span className="capitalize">{r.reportType} report</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(r._id, r.fileName || `${r.ticker}_report.pdf`)}
                  disabled={downloading === r._id}
                  className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50"
                >
                  {downloading === r._id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading…</>
                    : <><Download className="w-3.5 h-3.5" /> Download</>
                  }
                </button>
                <button onClick={() => handleDelete(r._id)} className="btn-danger text-xs flex items-center gap-1.5 px-3 py-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

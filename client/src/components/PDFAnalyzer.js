import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function PDFAnalyzer() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ticker, setTicker] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  const { getRootProps, getInputProps, acceptedFiles, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (files) => {
      toast.error(files[0]?.errors[0]?.message || 'File rejected');
    },
  });

  const handleUpload = async () => {
    if (!acceptedFiles.length) return toast.error('Please select a PDF file');
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('report', acceptedFiles[0]);
    formData.append('ticker', ticker.toUpperCase());
    formData.append('year', year);

    try {
      const res = await api.post('/ai/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min for large PDFs
      });
      setResult(res.data);
      toast.success(`Analysed ${res.data.pages} pages from ${res.data.fileName}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Company Ticker</label>
          <input
            className="input"
            placeholder="e.g. GCB"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Report Year</label>
          <input
            className="input"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min={2000}
            max={2030}
          />
        </div>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : acceptedFiles.length
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
        }`}
      >
        <input {...getInputProps()} />
        {acceptedFiles.length ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-emerald-400" />
            <div className="text-left">
              <p className="text-sm font-medium text-emerald-400">{acceptedFiles[0].name}</p>
              <p className="text-xs text-gray-500">{(acceptedFiles[0].size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
        ) : isDragActive ? (
          <div>
            <Upload className="w-10 h-10 text-blue-400 mx-auto mb-3" />
            <p className="text-blue-400 font-medium">Drop the PDF here</p>
          </div>
        ) : (
          <div>
            <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">Drag & drop Annual Report PDF</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse • Max 50MB</p>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!acceptedFiles.length || uploading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analysing with Gemini AI…
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Analyse Report
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-900/20 border border-red-700/50 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">AI Analysis Complete</h3>
            <span className="text-xs text-gray-500 ml-auto">{result.pages} pages · {result.wordCount?.toLocaleString()} words</span>
          </div>
          <div className="prose-dark">
            <ReactMarkdown>{result.analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

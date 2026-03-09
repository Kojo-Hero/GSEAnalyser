import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2, Paperclip, Trash2, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import PDFAnalyzer from '../components/PDFAnalyzer';
import api from '../services/api';
import toast from 'react-hot-toast';

const STARTER_PROMPTS = [
  'What is GCB Bank\'s competitive position in Ghana\'s banking sector?',
  'Analyse MTN Ghana\'s revenue growth and dividend history',
  'What macro risks should investors consider for Ghana equities in 2026?',
  'Compare GOIL vs TotalEnergies Ghana as investment opportunities',
  'What is a fair P/E ratio for Ghanaian banking stocks?',
];

export default function AIAssistant() {
  const [tab, setTab] = useState('chat'); // 'chat' | 'upload'
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hello! I\'m your GSE AI Analyst. I can help you:\n\n- Analyse Ghana Stock Exchange companies\n- Answer questions using uploaded annual reports (RAG)\n- Provide DCF valuation insights\n- Assess macro-economic risks for Ghana equities\n\nWhat would you like to explore today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    api.get('/ai/documents').then((r) => setDocuments(r.data)).catch(() => {});
  }, []);

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/ai/query', { query: userMsg, ticker: ticker || undefined });
      const { answer, sources, usedContext } = res.data;

      let content = answer;
      if (usedContext && sources?.length) {
        content += `\n\n---\n📚 *Sources: ${sources.map((s) => `${s.source} (${s.year || 'N/A'})`).join(', ')}*`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content }]);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};

      let content;
      if (status === 429 || data.error === 'quota_exceeded') {
        content = `⚠️ **Your Request Quota Exceeded** — try again later`;
      } else if (status === 401 || data.error === 'auth_error') {
        content = `🔑 **Invalid API Key**\n\nYour Gemini API key is invalid or missing.\n\nUpdate \`GEMINI_API_KEY\` in \`server/.env\` with your key from [Google AI Studio](https://aistudio.google.com/app/apikey)`;
      } else if (status === 503 || data.error === 'model_error') {
        content = `🤖 **Model Not Available**\n\n${data.message || 'The configured Gemini model is not available for this API key.'}\n\nCheck that your API key has access to \`gemini-2.0-flash\`.`;
      } else {
        content = `❌ **AI Query Failed**\n\n${data.message || err.message || 'Unknown error. Check the server logs.'}`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content, isError: true }]);
      if (status !== 429) toast.error('AI query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (source, docTicker) => {
    try {
      await api.delete('/ai/documents', { data: { source, ticker: docTicker } });
      setDocuments((prev) => prev.filter((d) => !(d._id.source === source && d._id.ticker === docTicker)));
      toast.success('Document removed');
    } catch { toast.error('Failed to remove document'); }
  };

  return (
    // Fill the remaining viewport height (screen minus 56px navbar minus padding)
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 56px - 3rem)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-400" /> AI Analyst
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">RAG with uploaded documents</p>
        </div>
        <div className="flex rounded-lg bg-gray-800 p-0.5 text-sm">
          {['chat', 'upload'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md font-medium transition-all capitalize ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t === 'upload' ? '📄 Upload Report' : '💬 Chat'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' && (
        /* flex-col fills remaining height; chat window gets flex-1 min-h-0 */
        <div className="flex flex-col flex-1 min-h-0 gap-3">

          {/* Ticker Filter */}
          <div className="flex items-center gap-3 shrink-0">
            <input
              className="input text-sm flex-1"
              placeholder="Filter context to a specific ticker (optional, e.g. GCB)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
            {documents.length > 0 && (
              <span className="text-xs text-gray-500 shrink-0">
                <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                {documents.length} doc{documents.length > 1 ? 's' : ''} indexed
              </span>
            )}
          </div>

          {/* Chat Window — grows to fill all available space */}
          <div className="card flex-1 min-h-0 overflow-y-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.isError
                    ? 'bg-red-900/30 border border-red-700/50 text-red-300'
                    : 'bg-gray-800 text-gray-200'
                }`}>
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <div className="prose-dark">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-sm text-gray-400">Analysing your request…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Starter Prompts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 shrink-0">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-xl border border-gray-700 hover:border-purple-600/50 transition-all text-left leading-relaxed"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-3 shrink-0">
            <input
              className="input flex-1"
              placeholder="Ask anything about GSE companies, valuations, or macro…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="btn-primary px-4 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card flex-1 min-h-0 overflow-y-auto">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-blue-400" /> Upload Annual Report / Financial Statement
          </h2>
          <PDFAnalyzer />

          {documents.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Indexed Documents</h3>
              <div className="space-y-2">
                {documents.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800 px-4 py-2.5 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-white">{d._id.source}</span>
                      <span className="text-xs text-gray-500 ml-3">{d._id.ticker} · {d._id.year} · {d.chunks} chunks</span>
                    </div>
                    <button onClick={() => handleDeleteDoc(d._id.source, d._id.ticker)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const DocumentChunk = require('../models/DocumentChunk');

// ── Clients ──────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here'
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// ── Model names ───────────────────────────────────────────────────────────────
const GEMINI_MODEL    = 'gemini-2.0-flash';
const EMBEDDING_MODEL = 'text-embedding-004';
const GROQ_MODEL      = 'llama-3.3-70b-versatile'; // best free Groq model

// ── Provider state (in-memory — resets on server restart) ────────────────────
// When Gemini hits its daily quota we flip geminiBlocked=true for the rest of
// the server's uptime so we stop wasting requests against it.
let geminiBlocked = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the error looks like a quota / rate-limit problem on Gemini.
 */
function isGeminiQuotaError(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('limit: 0') ||
    msg.includes('freetier') ||
    msg.includes('per_day') ||
    msg.includes('quota') ||
    err.status === 429
  );
}

function isGeminiFatalError(err) {
  return err.status === 403 || err.status === 404 ||
    (err.message || '').includes('API_KEY') ||
    (err.message || '').includes('API key');
}

/**
 * Call Gemini with up to 2 retries for transient errors.
 * Throws a special { useGroq: true } sentinel when quota is exhausted.
 */
async function callGemini(prompt, retries = 2) {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (isGeminiFatalError(err)) {
        throw new Error('AUTH ERROR: Check your Gemini API key.');
      }
      if (isGeminiQuotaError(err)) {
        // Daily quota — mark blocked and signal caller to try Groq
        geminiBlocked = true;
        console.warn('⚠️  Gemini quota exceeded — switching to Groq for this session.');
        throw { useGroq: true };
      }
      // Transient error — wait and retry
      if (attempt < retries) {
        const wait = (attempt + 1) * 20000;
        console.log(`⏳ Gemini error — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Call Groq (no built-in retry needed — Groq is very reliable on free tier).
 */
async function callGroq(prompt) {
  if (!groq) {
    throw new Error(
      'Groq is not configured. Add GROQ_API_KEY to your .env file (free at https://console.groq.com)'
    );
  }
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
  });
  return completion.choices[0]?.message?.content || '';
}

/**
 * Central generate function — tries Gemini first, auto-falls back to Groq.
 */
async function generate(prompt) {
  // If Gemini already hit its daily limit this session, go straight to Groq
  if (!geminiBlocked) {
    try {
      const text = await callGemini(prompt);
      return { text, provider: 'gemini' };
    } catch (err) {
      if (!err.useGroq) throw err; // real error — don't swallow
      // err.useGroq === true  →  fall through to Groq
    }
  }

  const text = await callGroq(prompt);
  return { text, provider: 'groq' };
}

// ── Embedding (Gemini only — Groq has no embedding API) ───────────────────────

/**
 * Generate embedding for a text string using Gemini embedding model.
 * Returns null on failure so callers can degrade gracefully.
 */
async function embedText(text) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error('Embedding error:', err.message);
    return null;
  }
}

// ── Text utilities ────────────────────────────────────────────────────────────

function chunkText(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Document storage / retrieval ──────────────────────────────────────────────

async function storeDocumentChunks(ticker, source, year, fullText) {
  const chunks = chunkText(fullText);
  const stored = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    const doc = await DocumentChunk.create({
      ticker, source, year,
      chunkIndex: i,
      content: chunks[i],
      embedding,
    });
    stored.push(doc);
  }

  console.log(`✅ Stored ${stored.length} chunks for ${ticker} (${source})`);
  return stored;
}

async function retrieveRelevantChunks(query, ticker, topK = 5) {
  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) return [];

  const filter = ticker ? { ticker } : {};
  const chunks = await DocumentChunk.find(filter).lean();

  return chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Public AI functions ───────────────────────────────────────────────────────

async function ragQuery(query, ticker) {
  const chunks = await retrieveRelevantChunks(query, ticker, 5);
  const context = chunks.map((c, i) => `[Source ${i + 1}: ${c.source}]\n${c.content}`).join('\n\n');

  const systemPrompt = `You are a professional Ghana Stock Exchange (GSE) financial analyst with deep expertise in Ghanaian markets, companies, and macroeconomics.

You analyze data from annual reports, financial statements, and market data to provide institutional-quality investment insights.

Always structure your responses with:
1. Key findings
2. Financial metrics (with numbers where available)
3. Risk factors specific to Ghana/West Africa
4. Investment recommendation (Buy/Hold/Sell with target price if possible)

Be specific, use data from the provided context, and cite your sources.`;

  const userPrompt = context
    ? `Context from company documents:\n\n${context}\n\n---\n\nQuestion: ${query}`
    : `Question about ${ticker || 'Ghana Stock Exchange'}: ${query}\n\nNote: No specific documents uploaded yet. Provide general analysis based on your knowledge of Ghanaian markets.`;

  const prompt = `${systemPrompt}\n\n${userPrompt}`;

  const { text, provider } = await generate(prompt);
  console.log(`🤖 ragQuery answered by: ${provider}`);

  return {
    answer: text,
    provider,
    sources: chunks.map((c) => ({ source: c.source, year: c.year, score: c.score?.toFixed(3) })),
    usedContext: chunks.length > 0,
  };
}

async function analyzeStock(stockData) {
  const prompt = `You are a senior Ghana Stock Exchange analyst. Analyze this stock and provide a comprehensive investment report.

Stock Data:
- Company: ${stockData.name} (${stockData.ticker})
- Sector: ${stockData.sector}
- Current Price: GHS ${stockData.currentPrice}
- Previous Close: GHS ${stockData.prevClose}
- Change: ${stockData.changePct}%
- Market Cap: GHS ${stockData.marketCap ? (stockData.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
- P/E Ratio: ${stockData.peRatio || 'N/A'}
- EPS: ${stockData.eps || 'N/A'}
- Dividend Yield: ${stockData.dividendYield ? stockData.dividendYield + '%' : 'N/A'}
- 52-Week High: ${stockData.fiftyTwoWeekHigh || 'N/A'}
- 52-Week Low: ${stockData.fiftyTwoWeekLow || 'N/A'}

Provide:
1. **Executive Summary** – 2-3 sentence overview
2. **Technical Analysis** – Price momentum, support/resistance levels
3. **Fundamental Analysis** – Valuation assessment, sector positioning
4. **Ghana Market Context** – Macro factors (GHS exchange rate, inflation, BoG policy)
5. **Key Risks** – Company-specific and market-wide risks
6. **Investment Recommendation** – Buy/Hold/Sell with 12-month price target
7. **Catalysts to Watch** – What could move this stock significantly

Format with clear headers and bullet points.`;

  const { text, provider } = await generate(prompt);
  console.log(`🤖 analyzeStock answered by: ${provider}`);
  return text;
}

async function analyzePDFContent(pdfText, ticker, year) {
  const truncated = pdfText.substring(0, 15000);

  const prompt = `You are analyzing the ${year || ''} Annual Report / Financial Statement for ${ticker || 'a GSE-listed company'}.

Document Content:
${truncated}

Please extract and analyze:
1. **Revenue & Profit Trends** – YoY growth rates
2. **Balance Sheet Health** – Debt levels, liquidity ratios, equity
3. **Cash Flow Analysis** – Operating, investing, financing cash flows
4. **Key Financial Ratios** – ROE, ROA, ROCE, current ratio, debt/equity
5. **Management Commentary** – Key strategic priorities and outlook
6. **Dividend History** – Payout ratios, dividend growth
7. **Red Flags** – Any accounting concerns, rising costs, or risks
8. **DCF Inputs** – Suggested FCF, growth rate, and WACC for DCF modeling

Present findings in a structured analyst report format.`;

  const { text, provider } = await generate(prompt);
  console.log(`🤖 analyzePDFContent answered by: ${provider}`);
  return text;
}

module.exports = { ragQuery, analyzeStock, analyzePDFContent, storeDocumentChunks, embedText };

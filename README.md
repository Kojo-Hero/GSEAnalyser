# GSE Analyser 🇬🇭📈

**AI-Powered Ghana Stock Exchange Analyst Platform**

A full-stack web application for analysing Ghana Stock Exchange (GSE) listed companies using real market data, Google Gemini AI, TradingView charts, DCF modelling, and RAG-powered document Q&A.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Live Market Data** | Scrapes GSE equities in real-time (auto-refreshes every 30min during trading hours) |
| 🤖 **Gemini AI Analysis** | Per-stock AI analyst reports powered by Google Gemini 1.5 Pro |
| 📄 **PDF RAG Pipeline** | Upload annual reports → AI answers questions using the actual document content |
| 📉 **DCF Valuation** | Multi-stage DCF model with sensitivity analysis, Ghana-specific sector defaults |
| 📈 **TradingView Charts** | Embedded TradingView widgets + custom Recharts price charts from scraped data |
| 💼 **Portfolio Tracker** | Track holdings, live P&L, allocation pie chart, watchlist |
| 📑 **PDF Reports** | Generate & download professional analyst PDF reports |
| 🔐 **JWT Auth** | Email/password registration & login with persistent sessions |

---

## 🗂️ Project Structure

```
GSEAnalyser/
├── client/                    # React frontend (Tailwind CSS)
│   ├── src/
│   │   ├── components/        # Navbar, Sidebar, StockTable, PriceChart, TradingViewWidget, PDFAnalyzer
│   │   ├── pages/             # Dashboard, StockDetail, Portfolio, Valuation, Reports, AIAssistant, Login, Register
│   │   ├── context/           # AuthContext (JWT state)
│   │   └── services/          # Axios API client
│   └── tailwind.config.js
│
├── server/                    # Node.js / Express backend
│   ├── src/
│   │   ├── routes/            # stocks, portfolio, ai, valuation, reports, auth
│   │   ├── models/            # Stock, Portfolio, User, Report, DocumentChunk (Mongoose)
│   │   ├── services/          # aiService (Gemini + RAG), dcfService, reportService, uploadService
│   │   ├── scrapers/          # gseScraper (axios + cheerio)
│   │   ├── middleware/        # JWT auth middleware
│   │   └── index.js           # Express app entry point
│   └── uploads/               # PDF uploads + generated reports
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **MongoDB** — [Install locally](https://www.mongodb.com/docs/manual/installation/) or use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier)
- **Google Gemini API Key** — Get free at [aistudio.google.com](https://aistudio.google.com)

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd GSEAnalyser

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```dotenv
PORT=5000
NODE_ENV=development

# MongoDB (local or Atlas connection string)
MONGODB_URI=mongodb://localhost:27017/gse_analyser

# JWT Secret (change this in production!)
JWT_SECRET=your_very_secret_key_here_min_32_chars

# Google Gemini API Key (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIza...your_key_here

# React app URL
CLIENT_URL=http://localhost:3000
```

### 3. Start MongoDB (if running locally)

```bash
# macOS with Homebrew
brew services start mongodb-community

# Or run manually
mongod --dbpath /usr/local/var/mongodb
```

### 4. Run the App

**Option A — Two terminals:**

```bash
# Terminal 1 – Backend
cd server && npm run dev

# Terminal 2 – Frontend
cd client && npm start
```

**Option B — Root (concurrent):**

```bash
# From root GSEAnalyser/
npm install  # installs concurrently
npm run dev
```

App will be available at: **http://localhost:3000**

API running at: **http://localhost:5000**

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stocks` | List all GSE stocks (supports `?search=&sector=&page=`) |
| GET | `/api/stocks/market-summary` | Top gainers, losers, market stats |
| GET | `/api/stocks/:ticker` | Single stock detail |
| GET | `/api/stocks/:ticker/history` | Price history (`?days=60`) |
| GET | `/api/stocks/:ticker/ai-analysis` | Gemini AI stock analysis |
| POST | `/api/stocks/refresh` | Trigger manual GSE scrape |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/portfolio` | Get user portfolio (auth required) |
| POST | `/api/portfolio/holdings` | Add holding (auth required) |
| DELETE | `/api/portfolio/holdings/:ticker` | Remove holding |
| POST | `/api/portfolio/watchlist` | Add to watchlist |
| POST | `/api/ai/query` | RAG AI query |
| POST | `/api/ai/upload` | Upload & ingest PDF annual report |
| GET | `/api/ai/documents` | List indexed documents |
| POST | `/api/valuation/dcf` | Run DCF model |
| GET | `/api/valuation/defaults/:ticker` | Get sector DCF defaults |
| POST | `/api/reports/generate` | Generate PDF analyst report |
| GET | `/api/reports/:id/download` | Download PDF report |

---

## 🤖 Gemini AI Features

### Stock Analysis
Click **"Generate AI Analysis"** on any stock detail page. Gemini will produce:
- Executive Summary
- Technical & Fundamental Analysis
- Ghana macro context (currency, inflation, BoG policy)
- Risk factors
- Buy / Hold / Sell recommendation with target price

### RAG Pipeline (Document Q&A)
1. Go to **AI Assistant → Upload Report**
2. Enter the company ticker and report year
3. Upload a PDF annual report
4. Switch to **Chat** tab and ask questions — Gemini will answer using the actual document

### PDF Analysis
The system automatically:
- Extracts text from PDFs
- Chunks into ~500-word segments
- Embeds with Gemini `embedding-001`
- Retrieves relevant chunks via cosine similarity
- Injects context into Gemini Pro prompt

---

## 📊 DCF Valuation

The DCF engine supports:
- **Two-stage growth model** — high-growth phase + terminal value
- **Ghana-specific sector defaults** (Banking, Telecoms, Oil & Gas, Consumer Goods)
- **Sensitivity analysis table** — matrix of intrinsic values across WACC × terminal growth rate ranges

Input your FCF from the annual report, adjust assumptions, and compare intrinsic value per share vs. current market price.

---

## 📈 Chart Options

Each stock detail page has two chart modes:
1. **Custom Chart** — Recharts area chart built from scraped price history data
2. **TradingView** — Embedded TradingView widget (best for globally traded tickers; GSE coverage may be limited)

---

## ⚠️ Important Notes

### GSE Scraper
- The scraper targets `gse.com.gh/market-data/equities`. If the site changes structure, parsing may fail.
- When live scraping fails, the app automatically **seeds 12 realistic sample stocks** for demonstration.
- In production, consider combining with a paid data provider.

### Gemini API Quotas
- Free tier: 60 requests/minute, 1,500 requests/day
- AI analysis, PDF processing, and RAG queries each consume 1–3 Gemini API calls
- For high usage, upgrade to a paid Gemini API plan

### TradingView Coverage
- GSE tickers (e.g. `GSE:GCB`) have limited coverage on TradingView
- The custom Recharts chart (from scraped data) is more reliable for GSE-specific price history

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS 3, React Router v6 |
| Charts | Recharts, TradingView Widget |
| AI | Google Gemini 1.5 Pro + Embedding-001 |
| Backend | Node.js, Express 4 |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| PDF | pdf-parse (extraction), PDFKit (generation) |
| Scraping | Axios + Cheerio |
| Scheduling | node-cron |

---

## 🧪 Development Tips

```bash
# Seed sample stock data without scraping
curl -X POST http://localhost:5000/api/stocks/refresh

# Test AI analysis (requires GEMINI_API_KEY)
curl http://localhost:5000/api/stocks/GCB/ai-analysis

# Test DCF
curl -X POST http://localhost:5000/api/valuation/dcf \
  -H "Content-Type: application/json" \
  -d '{"freeCashFlow":150,"wacc":0.18,"growthRateStage1":0.12,"growthRateStage2":0.04,"sharesOutstanding":300}'
```

---

## 📄 License

MIT — Free to use, modify, and distribute.

---

*Built for Ghana 🇬🇭 investors and analysts. Not financial advice.*

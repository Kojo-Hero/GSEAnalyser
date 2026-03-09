import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';

const FAQS = [
  {
    category: 'About the GSE',
    items: [
      {
        q: 'What is the Ghana Stock Exchange (GSE)?',
        a: 'The Ghana Stock Exchange (GSE) is the principal stock exchange of Ghana, located in Accra. Founded in 1990 and commencing trading in 1991, it provides a regulated marketplace where shares of publicly listed Ghanaian companies are bought and sold. It is regulated by the Securities and Exchange Commission (SEC) of Ghana.',
      },
      {
        q: 'What are the trading hours of the GSE?',
        a: 'The GSE operates Monday to Friday. Trading sessions run from 9:30 AM to 3:00 PM GMT. The exchange is closed on Ghanaian public holidays. Settlement of trades follows a T+3 cycle, meaning transactions are settled three business days after the trade date.',
      },
      {
        q: 'How many companies are listed on the GSE?',
        a: 'The GSE currently has approximately 23–25 listed equities across sectors including Banking, Insurance, Manufacturing, Consumer Goods, Oil & Gas, Telecoms, and Agriculture. The number fluctuates as companies list or delist. The exchange also lists government bonds and corporate bonds.',
      },
      {
        q: 'What indices does the GSE publish?',
        a: 'The GSE publishes two main indices: the GSE Composite Index (GSE-CI), which tracks all listed equities and is the primary benchmark for overall market performance, and the GSE Financial Stocks Index (GSE-FSI), which tracks only financial sector stocks like banks and insurance companies.',
      },
      {
        q: 'What currency are GSE stocks traded in?',
        a: 'All GSE stocks are traded and quoted in Ghanaian Cedis (GHS). Foreign investors can participate but must convert their home currency to GHS to invest, and back when repatriating profits. Currency risk (GHS depreciation against USD or GBP) is a key consideration for foreign investors.',
      },
    ],
  },
  {
    category: 'Investing on the GSE',
    items: [
      {
        q: 'How do I buy shares on the Ghana Stock Exchange?',
        a: 'To buy shares on the GSE you must: (1) Open a CSD (Central Securities Depository) account through a licensed broker-dealer. (2) Fund your brokerage account in GHS. (3) Place a buy order with your broker specifying the stock ticker and quantity. (4) Your broker executes the trade on the exchange floor or electronically. Settlement occurs T+3. Licensed brokers include databank, CDH, NTHC, SIC, and others.',
      },
      {
        q: 'Can foreigners invest on the GSE?',
        a: 'Yes. Foreign investors can invest on the GSE but must comply with foreign exchange regulations. They need to open a Securities Account with a licensed Ghanaian broker and use an External Investor Account (EIA) at a local bank for foreign currency transactions. Dividends and capital gains can be repatriated subject to Bank of Ghana regulations.',
      },
      {
        q: 'What are the costs involved in trading on the GSE?',
        a: 'Trading costs on the GSE include: Broker commission (typically 1–2% of transaction value), SEC levy (0.3% of transaction value), GSE fee (0.1%), CSD fee (0.1%), and stamp duty on certain transactions. Total transaction costs typically range from 1.5–2.5% per trade, which is higher than many developed markets.',
      },
      {
        q: 'What is the minimum investment amount on the GSE?',
        a: 'There is no fixed minimum investment amount set by the GSE. However, most brokers have a practical minimum due to transaction costs — investing less than GHS 500–1,000 may not be economical given fixed fees. You can buy as few as 1 share of any listed company, subject to your broker\'s minimum order policy.',
      },
      {
        q: 'How are dividends paid to GSE investors?',
        a: 'Dividends on the GSE are typically paid in cash, credited directly to your bank account linked to your CSD account. Companies announce an "Ex-Dividend Date" — you must own shares before this date to qualify for the dividend. Payment usually follows within 30–60 days after the Annual General Meeting (AGM) approves the dividend.',
      },
    ],
  },
  {
    category: 'Understanding Stock Prices & Data',
    items: [
      {
        q: 'Why do some GSE stocks have very low trading volumes?',
        a: 'The GSE is a frontier market with relatively low liquidity compared to developed markets. Many listed companies have concentrated ownership (large shareholders who rarely trade), a small retail investor base, and limited institutional participation. Low volume means wide bid-ask spreads and difficulty executing large orders without moving the price.',
      },
      {
        q: 'What does the P/E ratio mean for a GSE stock?',
        a: 'The Price-to-Earnings (P/E) ratio compares a stock\'s current price to its earnings per share (EPS). For example, a P/E of 10 means investors are paying GHS 10 for every GHS 1 of annual earnings. On the GSE, average P/E ratios tend to be lower (5–15x) than global markets due to higher risk premiums, but banking stocks often trade at 3–8x earnings.',
      },
      {
        q: 'What is the difference between market price and intrinsic value?',
        a: 'Market price is what a stock is currently trading for on the exchange — driven by supply, demand, and sentiment. Intrinsic value is what the stock is theoretically worth based on the company\'s fundamentals (earnings, cash flows, assets). If intrinsic value > market price, the stock may be undervalued. DCF analysis (available on this platform) helps estimate intrinsic value.',
      },
      {
        q: 'What causes GSE stock prices to move?',
        a: 'GSE stock prices are influenced by: company earnings results and dividend announcements, Bank of Ghana interest rate decisions (affects banking stocks heavily), inflation and GHS exchange rate movements, commodity prices (especially for oil, gold, cocoa producers), political stability and elections, global emerging/frontier market sentiment, and liquidity — any large buy or sell order can move a thinly-traded stock significantly.',
      },
    ],
  },
  {
    category: 'Ghana Economy & Market Context',
    items: [
      {
        q: 'How does Ghana\'s inflation affect GSE investments?',
        a: 'High inflation (Ghana has experienced inflation above 30–50% in recent years) erodes the real value of returns. For GSE investors, it means: (1) Nominal stock prices may rise but real returns could be flat or negative. (2) Bank of Ghana raises interest rates to fight inflation, increasing WACC and reducing stock valuations. (3) Companies with pricing power (consumer goods, banks) can often pass costs to customers, protecting margins better.',
      },
      {
        q: 'What is the impact of GHS depreciation on GSE stocks?',
        a: 'GHS depreciation affects GSE stocks differently by sector: Companies with USD-denominated revenues (oil companies, exporters) benefit as their earnings translate to more GHS. Companies with USD-denominated debt or imports (manufacturers, telecoms) face higher costs. For foreign investors, GHS depreciation means their returns are worth less when converted back to USD or GBP.',
      },
      {
        q: 'Which sectors on the GSE have performed best historically?',
        a: 'Historically, the Banking sector has been the most actively traded and profitable on the GSE, with GCB Bank, Ecobank Ghana, and Stanbic Ghana among the most liquid stocks. The Consumer Goods sector (Fan Milk, PZ Cussons) has also shown resilience. Telecoms (MTN Ghana) has grown significantly since listing in 2018. Mining and oil-related stocks tend to be more volatile.',
      },
      {
        q: 'How does the Bank of Ghana\'s monetary policy affect the GSE?',
        a: 'The Bank of Ghana\'s Monetary Policy Rate (MPR) is the key interest rate benchmark. When the MPR rises: (1) Government bonds become more attractive relative to stocks, pulling capital away from equities. (2) Banks\' cost of borrowing rises, squeezing net interest margins. (3) WACC increases, reducing DCF valuations. When MPR falls, the opposite occurs — stocks typically rally as bonds become less attractive.',
      },
    ],
  },
  {
    category: 'Using This Platform',
    items: [
      {
        q: 'What is the AI Assistant and how accurate is it?',
        a: 'The AI Assistant uses large language models (Google Gemini and Groq\'s Llama) combined with Retrieval-Augmented Generation (RAG) to answer questions about GSE stocks. It can analyse uploaded annual reports and financial statements. While it provides institutional-quality insights, it should be used as a research aid — always verify with primary sources before making investment decisions.',
      },
      {
        q: 'How do I use the DCF Valuation Model effectively?',
        a: 'For the best DCF results: (1) Use the latest audited Free Cash Flow from the company\'s annual report. (2) Look up the ticker to auto-fill the current price and sector defaults. (3) Adjust WACC based on the company\'s specific risk profile — higher for smaller, riskier firms. (4) Use the Sensitivity Analysis table to see how the valuation changes under different assumptions. (5) Cross-check with the stock\'s current P/E and P/B ratios.',
      },
      {
        q: 'How often is the stock price data updated?',
        a: 'Stock prices are scraped from the Ghana Stock Exchange website and African Markets data sources. The data is refreshed automatically via a scheduled task. Due to the GSE\'s lower trading frequency, prices may reflect the last traded price rather than real-time quotes. For the most current data, always verify on the official GSE website (gse.com.gh) or your broker\'s platform.',
      },
    ],
  },
];

export default function FAQ() {
  const [openItem, setOpenItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = FAQS.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        !searchQuery ||
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  const totalMatches = filtered.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-blue-400" />
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          20 common questions about the Ghana Stock Exchange and investing
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          className="input pl-9 w-full"
          placeholder="Search questions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {totalMatches} result{totalMatches !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Categories */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <HelpCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No questions match your search</p>
        </div>
      ) : (
        filtered.map((cat) => (
          <div key={cat.category} className="space-y-2">
            {/* Category header */}
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                {cat.category}
              </h2>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* FAQ items */}
            <div className="space-y-1.5">
              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`;
                const isOpen = openItem === key;
                return (
                  <div
                    key={key}
                    className="border border-gray-700/60 rounded-lg overflow-hidden transition-colors hover:border-gray-600"
                  >
                    <button
                      onClick={() => setOpenItem(isOpen ? null : key)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-800/40 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-100 leading-snug">{item.q}</span>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                      }
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0.5 bg-gray-800/25 border-t border-gray-700/40">
                        <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Footer note */}
      <div className="card bg-blue-900/10 border-blue-700/30 text-center py-4">
        <p className="text-xs text-gray-500">
          Can't find what you're looking for? Ask the{' '}
          <a href="/ai" className="text-blue-400 hover:underline">AI Assistant</a>
          {' '}for specific questions about any GSE stock or the Ghanaian market.
        </p>
      </div>
    </div>
  );
}

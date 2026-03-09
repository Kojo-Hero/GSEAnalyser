import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function ChangeIndicator({ pct }) {
  const val = parseFloat(pct);
  if (val > 0) return (
    <span className="badge-up"><TrendingUp className="w-3 h-3" />{val.toFixed(2)}%</span>
  );
  if (val < 0) return (
    <span className="badge-down"><TrendingDown className="w-3 h-3" />{Math.abs(val).toFixed(2)}%</span>
  );
  return <span className="badge-neutral"><Minus className="w-3 h-3" />0.00%</span>;
}

export default function StockTable({ stocks = [], loading }) {
  if (loading) {
    return (
      <div className="card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-800 last:border-0">
            <div className="skeleton w-16 h-4" />
            <div className="skeleton flex-1 h-4" />
            <div className="skeleton w-20 h-4" />
            <div className="skeleton w-24 h-4" />
          </div>
        ))}
      </div>
    );
  }

  if (!stocks.length) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No stocks found</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticker</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Sector</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Price (GHS)</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Change</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Volume</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Mkt Cap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {stocks.map((stock) => (
              <tr key={stock.ticker} className="hover:bg-gray-800/40 transition-colors group">
                <td className="px-5 py-3.5">
                  <Link to={`/stocks/${stock.ticker}`} className="font-bold text-blue-400 hover:text-blue-300 transition-colors">
                    {stock.ticker}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <Link to={`/stocks/${stock.ticker}`} className="text-gray-200 hover:text-white transition-colors line-clamp-1">
                    {stock.name}
                  </Link>
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{stock.sector}</span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-white">
                  {stock.currentPrice?.toFixed(4)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <ChangeIndicator pct={stock.changePct} />
                </td>
                <td className="px-5 py-3.5 text-right text-gray-400 hidden md:table-cell">
                  {stock.volume?.toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right text-gray-400 hidden lg:table-cell">
                  {stock.marketCap ? `GHS ${(stock.marketCap / 1e9).toFixed(2)}B` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

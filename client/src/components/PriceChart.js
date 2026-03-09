import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">GHS {payload[0]?.value?.toFixed(4)}</p>
      {payload[1] && (
        <p className="text-xs text-blue-400">Vol: {payload[1]?.value?.toLocaleString()}</p>
      )}
    </div>
  );
};

export default function PriceChart({ history = [], ticker, currentPrice }) {
  if (!history.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
        <p className="text-gray-500 text-sm">No price history available</p>
      </div>
    );
  }

  const data = history.map((p) => ({
    date: format(new Date(p.date), 'MMM dd'),
    price: parseFloat(p.price.toFixed(4)),
    volume: p.volume,
  }));

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const isUp = data[data.length - 1]?.price >= data[0]?.price;
  const gradientColor = isUp ? '#10b981' : '#ef4444';
  const strokeColor = isUp ? '#10b981' : '#ef4444';

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`priceGrad_${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(2)}`}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          {currentPrice && (
            <ReferenceLine y={currentPrice} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1} />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#priceGrad_${ticker})`}
            dot={false}
            activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

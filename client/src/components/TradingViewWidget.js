import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.dataKey === 'price' ? `GHS ${p.value?.toFixed(4)}` : p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function TradingViewWidget({ ticker, history = [], height = 420 }) {
  if (!history || history.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-gray-800/50 rounded-xl border border-gray-700 border-dashed gap-3"
        style={{ height }}
      >
        <p className="text-gray-500 text-sm">No historical data available for {ticker}</p>
        <p className="text-gray-600 text-xs">Try a different time range or click Live Update</p>
      </div>
    );
  }

  const data = history.map((p) => ({
    date: format(new Date(p.date), 'MMM dd'),
    price: parseFloat(p.price?.toFixed(4)),
    volume: p.volume || 0,
  }));

  const prices = data.map((d) => d.price);
  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#10b981' : '#ef4444';

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          {/* Left axis: volume */}
          <YAxis
            yAxisId="vol"
            orientation="left"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v}
            width={45}
          />
          {/* Right axis: price */}
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(2)}
            width={55}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>}
          />
          {/* Volume bars */}
          <Bar
            yAxisId="vol"
            dataKey="volume"
            name="Volume"
            fill="#3b82f6"
            opacity={0.35}
            radius={[2, 2, 0, 0]}
          />
          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="Price (GHS)"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

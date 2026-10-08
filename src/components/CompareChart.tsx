"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface CompareChartProps {
  data: any[];
  keys: string[]; // names of the politicians
}

const COLORS = ["#0284c7", "#ea580c", "#16a34a", "#9333ea"];

export function CompareChart({ data, keys }: CompareChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" className="text-xs font-bold text-ink-700" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ fontWeight: 'bold' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />

          {keys.map((key, index) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.4}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

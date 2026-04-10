"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Shared tooltip style — matches dark UI palette
// ---------------------------------------------------------------------------
const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#171717",
    border: "1px solid #404040",
    borderRadius: 4,
    fontSize: 12,
    color: "#d4d4d4",
  },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

// ---------------------------------------------------------------------------
// Weekly cases bar chart (vertical bars)
// ---------------------------------------------------------------------------
export function WeeklyBarChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "#737373", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#737373", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Cases" fill="#2563eb" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Category horizontal bar chart
// ---------------------------------------------------------------------------
export function CategoryBarChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fill: "#737373", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#a3a3a3", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Cases" fill="#2563eb" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

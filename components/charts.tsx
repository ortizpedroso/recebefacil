"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, cents } from "@/lib/money";

export function MoneyChart({ rows }: { rows: { month: string; vendido: number; recebido: number }[] }) {
  const data = rows.map((row) => ({
    month: row.month.slice(5),
    vendido: row.vendido / 100,
    recebido: row.recebido / 100,
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip formatter={(value) => formatBRL(cents(Math.round(Number(value) * 100)))} />
          <Bar dataKey="vendido" fill="#2563EB" radius={4} />
          <Bar dataKey="recebido" fill="#10B981" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

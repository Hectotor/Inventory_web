"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type OrderEvolutionChartProps = {
  orders: Array<{ orders_id: string; customer_id: string; status: string; created_at?: { toDate: () => Date } }>;
  selectedAgency?: string;
};

export function OrderEvolutionChart({ orders, selectedAgency }: OrderEvolutionChartProps) {
  // Calculer les données du graphique par mois
  const getChartData = () => {
    const dataMap = new Map<string, number>();

    orders.forEach(order => {
      if (!order.created_at) return;

      const date = order.created_at.toDate();
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      dataMap.set(key, (dataMap.get(key) || 0) + 1);
    });

    const chartData = Array.from(dataMap.entries())
      .map(([key, count]) => ({ name: key, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return chartData;
  };

  const chartData = getChartData();

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Évolution des commandes</h3>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => {
              const parts = value.split('-');
              if (parts.length >= 2) {
                const monthIndex = parseInt(parts[1]) - 1;
                if (monthIndex >= 0 && monthIndex <= 11) {
                  return `${monthNames[monthIndex].substring(0, 3)} ${parts[0]}`;
                }
              }
              return value;
            }}
          />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(value: number | undefined) => [`${value || 0} commandes`, "Nombre"]}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

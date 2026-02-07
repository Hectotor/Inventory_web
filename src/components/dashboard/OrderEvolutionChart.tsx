"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type OrderEvolutionChartProps = {
  orders: Array<{ orders_id: string; customer_id: string; status: string; created_at?: { toDate: () => Date } }>;
  selectedAgency?: string;
};

export function OrderEvolutionChart({ orders, selectedAgency }: OrderEvolutionChartProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Calculer les données du graphique
  const getChartData = () => {
    const dataMap = new Map<string, number>();

    orders.forEach(order => {
      if (!order.created_at) return;

      const date = order.created_at.toDate();
      const year = date.getFullYear();
      const month = date.getMonth();

      // Filtre par année
      if (selectedYear && year !== selectedYear) return;

      // Filtre par mois
      if (selectedMonth !== null && month !== selectedMonth) return;

      const key = selectedMonth
        ? `${year}-${String(month + 1).padStart(2, '0')}-${date.getDate()}`
        : selectedYear
        ? `${year}-${String(month + 1).padStart(2, '0')}`
        : `${year}`;

      dataMap.set(key, (dataMap.get(key) || 0) + 1);
    });

    let chartData = Array.from(dataMap.entries())
      .map(([key, count]) => ({ name: key, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Si une année est sélectionnée, s'assurer que tous les mois sont présents
    if (selectedYear && !selectedMonth) {
      const allMonths = Array.from({ length: 12 }, (_, i) => ({
        name: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
        count: 0,
      }));

      // Fusionner avec les données existantes
      const monthMap = new Map(chartData.map(d => [d.name, d.count]));
      chartData = allMonths.map(month => ({
        name: month.name,
        count: monthMap.get(month.name) || 0,
      }));
    }

    // Si un mois est sélectionné, s'assurer que tous les jours sont présents
    if (selectedYear && selectedMonth !== null) {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const allDays = Array.from({ length: daysInMonth }, (_, i) => ({
        name: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        count: 0,
      }));

      // Fusionner avec les données existantes
      const dayMap = new Map(chartData.map(d => [d.name, d.count]));
      chartData = allDays.map(day => ({
        name: day.name,
        count: dayMap.get(day.name) || 0,
      }));
    }

    return chartData;
  };

  // Obtenir les années disponibles
  const getAvailableYears = () => {
    const years = new Set<number>();
    orders.forEach(order => {
      if (order.created_at) {
        years.add(order.created_at.toDate().getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  // Obtenir les mois disponibles pour l'année sélectionnée
  const getAvailableMonths = () => {
    if (!selectedYear) return [];

    const months = new Set<number>();
    orders.forEach(order => {
      if (order.created_at) {
        const date = order.created_at.toDate();
        if (date.getFullYear() === selectedYear) {
          months.add(date.getMonth());
        }
      }
    });
    return Array.from(months).sort((a, b) => a - b);
  };

  const availableYears = getAvailableYears();
  const availableMonths = getAvailableMonths();
  const chartData = getChartData();

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Évolution des commandes</h3>

        {/* Filtres */}
        <div className="flex items-center gap-2">
          <select
            value={selectedYear ?? ""}
            onChange={(e) => {
              const value = e.target.value === "" ? null : parseInt(e.target.value);
              setSelectedYear(value);
              setSelectedMonth(null);
            }}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none"
          >
            <option value="">Toutes les années</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {selectedYear && (
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => setSelectedMonth(e.target.value === "" ? null : parseInt(e.target.value))}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none"
            >
              <option value="">Tous les mois</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>{monthNames[month]}</option>
              ))}
            </select>
          )}

          {(selectedYear || selectedMonth !== null) && (
            <button
              onClick={() => {
                setSelectedYear(null);
                setSelectedMonth(null);
              }}
              className="h-9 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => {
              // Si un mois est sélectionné, afficher le jour
              if (selectedMonth) {
                return value.split('-')[2] || value;
              }

              // Si une année est sélectionnée, afficher le mois en abrégé
              if (selectedYear) {
                const monthIndex = parseInt(value.split('-')[1] || '0') - 1;
                if (monthIndex >= 0 && monthIndex <= 11) {
                  return monthNames[monthIndex][0]; // Première lettre du mois
                }
              }

              // Sinon afficher l'année
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

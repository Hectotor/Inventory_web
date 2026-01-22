"use client";

import { DashboardPage } from "@/components/dashboard/DashboardPage";

export default function AdminDashboard() {
  return (
    <DashboardPage
      stocksUrl="/admin/stocks?alert=true"
      ordersUrl="/admin/orders"
    />
  );
}

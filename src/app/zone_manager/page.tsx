"use client";

import { DashboardPage } from "@/components/dashboard/DashboardPage";

export default function ZoneManagerDashboard() {
  return (
    <DashboardPage
      stocksUrl="/zone_manager/stocks?alert=true"
      ordersUrl="/zone_manager/orders"
    />
  );
}

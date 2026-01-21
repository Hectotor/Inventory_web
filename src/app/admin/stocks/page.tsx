"use client";

import { StocksPage } from "@/components/stocks/StocksPage";

export default function AdminStocks() {
  return <StocksPage canManageAllAgencies={true} />;
}

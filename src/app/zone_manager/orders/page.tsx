"use client";

import { OrdersPage } from "@/components/orders/OrdersPage";

export default function ZoneManagerOrders() {
  return <OrdersPage ordersUrl="/zone_manager/orders" filterByAgency={true} />;
}

"use client";

import { OrdersPage } from "@/components/orders/OrdersPage";

export default function AdminOrders() {
  return <OrdersPage ordersUrl="/admin/orders" filterByAgency={false} />;
}

"use client";

import { useParams } from "next/navigation";
import { OrderDetailPage } from "@/components/orders/OrderDetailPage";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  return (
    <OrderDetailPage
      orderId={orderId}
      backUrl="/admin"
      backLabel="Retour au dashboard"
    />
  );
}

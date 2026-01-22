"use client";

import { useParams } from "next/navigation";
import { OrderDetailPage } from "@/components/orders/OrderDetailPage";

export default function ZoneManagerOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  return (
    <OrderDetailPage
      orderId={orderId}
      backUrl="/zone_manager"
      backLabel="Retour au dashboard"
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type OrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  price_ht: number;
  tva: number;
  total_ht: number;
  total_ttc: number;
};

type Order = {
  id: string;
  customer_id: string;
  company_id: string;
  items: OrderItem[];
  total_ht: number;
  total_ttc: number;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

const statusLabels: Record<Order["status"], string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const statusColors: Record<Order["status"], string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700",
  ready: "bg-green-100 text-green-700",
  delivered: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setOrders([]);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setOrders([]);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { role?: string };
      if (userData.role !== "customer") {
        setOrders([]);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      setCustomerId(currentUser.uid);
      await loadOrders(currentUser.uid);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadOrders = async (uid: string) => {
    const ordersSnapshot = await getDocs(
      query(collection(db, "orders"), where("customer_id", "==", uid))
    );
    const ordersList = ordersSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const dateA = a.created_at?.toMillis() || 0;
        const dateB = b.created_at?.toMillis() || 0;
        return dateB - dateA;
      }) as Order[];
    setOrders(ordersList);
  };

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-sm text-[#6B7280]">Chargement des commandes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orders.length > 0 && (
        <div className="flex items-center justify-end">
          <span className="text-sm text-[#6B7280]">
            {orders.length} {orders.length === 1 ? "commande" : "commandes"}
          </span>
        </div>
      )}

      {orders.length === 0 ? (
        <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-sm font-medium mb-1">Aucune commande</p>
            <p className="text-xs">Vous n'avez pas encore passé de commande</p>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <section
              key={order.id}
              className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                    Commande #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status]}`}
                  >
                    {statusLabels[order.status]}
                  </span>
                  <p className="text-lg font-semibold mt-2">
                    {order.total_ttc.toFixed(2)} € TTC
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 mt-4">
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-xl border border-zinc-100 bg-[#F8FAFC] p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product_name}</p>
                        <p className="text-xs text-[#6B7280] mt-1">
                          Quantité: {item.quantity} × {item.price_ht.toFixed(2)} € HT
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {item.total_ttc.toFixed(2)} € TTC
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {item.total_ht.toFixed(2)} € HT
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <p className="text-sm text-[#6B7280]">Total HT</p>
                  <p className="text-sm font-medium">{order.total_ht.toFixed(2)} €</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-semibold">Total TTC</p>
                  <p className="text-lg font-semibold">{order.total_ttc.toFixed(2)} €</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

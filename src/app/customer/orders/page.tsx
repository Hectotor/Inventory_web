"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type Order = {
  orders_id: string;
  company_id: string;
  customer_id: string;
  sales_id?: string | null;
  created_by: string;
  status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
  created_at?: Timestamp;
  items_count: number;
  total_ht: number;
  total_ttc: number;
};

const statusLabels: Record<Order["status"], string> = {
  PREPARATION: "En préparation",
  TAKEN: "Pris en charge",
  IN_DELIVERY: "En cours de livraison",
  DELIVERED: "Livrée",
};

const statusColors: Record<Order["status"], string> = {
  PREPARATION: "bg-orange-100 text-orange-700",
  TAKEN: "bg-purple-100 text-purple-700",
  IN_DELIVERY: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
};

export default function CustomerOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
    // Charger les commandes
    const ordersSnapshot = await getDocs(
      query(collection(db, "orders"), where("customer_id", "==", uid))
    );
    
    const ordersData = ordersSnapshot.docs.map((doc) => ({
      orders_id: doc.id,
      ...doc.data(),
    })) as Array<{
      orders_id: string;
      company_id: string;
      customer_id: string;
      sales_id?: string | null;
      created_by: string;
      status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
      created_at?: Timestamp;
    }>;

    // Pour chaque commande, charger seulement le nombre d'items et calculer les totaux
    const ordersWithSummary = await Promise.all(
      ordersData.map(async (orderData) => {
        // Charger les order_items pour compter et calculer les totaux
        const orderItemsSnapshot = await getDocs(
          query(
            collection(db, "order_items"),
            where("order_id", "==", orderData.orders_id)
          )
        );

        const orderItemsData = orderItemsSnapshot.docs.map((doc) => ({
          product_id: doc.data().product_id,
          quantity: doc.data().quantity,
          price_ht: doc.data().price_ht ?? 0,
          tva: doc.data().tva ?? 20, // TVA fixe de 20%
          total_ht: doc.data().total_ht ?? 0,
          total_ttc: doc.data().total_ttc ?? 0,
        }));

        // Utiliser les prix sauvegardés dans order_items
        const total_ht = orderItemsData.reduce((sum, item) => sum + (item.total_ht ?? 0), 0);
        const total_ttc = orderItemsData.reduce((sum, item) => sum + (item.total_ttc ?? 0), 0);

        return {
          orders_id: orderData.orders_id,
          company_id: orderData.company_id,
          customer_id: orderData.customer_id,
          sales_id: orderData.sales_id,
          created_by: orderData.created_by,
          status: orderData.status,
          created_at: orderData.created_at,
          items_count: orderItemsData.reduce((sum, item) => sum + item.quantity, 0),
          total_ht,
          total_ttc,
        } as Order;
      })
    );

    // Trier par date de création (plus récent en premier)
    ordersWithSummary.sort((a, b) => {
      const dateA = a.created_at?.toMillis() || 0;
      const dateB = b.created_at?.toMillis() || 0;
      return dateB - dateA;
    });

    setOrders(ordersWithSummary);
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

  // Filtrer les commandes selon la recherche
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orderId = order.orders_id.slice(0, 8).toUpperCase();
    const status = statusLabels[order.status].toLowerCase();
    const date = formatDate(order.created_at).toLowerCase();
    return (
      orderId.includes(query) ||
      status.includes(query) ||
      date.includes(query)
    );
  });

  return (
    <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
            Commandes
          </p>
          <h1 className="text-2xl font-semibold mt-1">
            Mes commandes ({orders.length})
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#6B7280]">Total commandes</p>
          <p className="text-lg font-semibold">
            {orders.reduce((total, order) => total + order.total_ht, 0).toFixed(2)} € HT
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-[#6B7280]">
          <div className="text-4xl mb-4">📦</div>
          <p className="text-sm font-medium mb-1">Aucune commande</p>
          <p className="text-xs">Vous n'avez pas encore passé de commande</p>
        </div>
      ) : (
        <>
          {/* Barre de recherche */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher une commande..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-2xl border border-zinc-200 bg-white px-4 pl-11 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]">
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-[#6B7280]">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-sm font-medium mb-1">Aucune commande trouvée</p>
              <p className="text-xs">Essayez avec d'autres mots-clés</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.orders_id}
                  onClick={() => router.push(`/customer/orders/${order.orders_id}`)}
                  className="rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-sm font-semibold text-[#111827]">
                          Commande #{order.orders_id.slice(0, 8).toUpperCase()}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status]}`}
                        >
                          {statusLabels[order.status]}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] mb-1">
                        {formatDate(order.created_at)}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {order.items_count} {order.items_count === 1 ? "produit" : "produits"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-[#111827]">
                        {order.total_ht.toFixed(2)} € HT
                      </p>
                      <p className="text-xs text-[#6B7280] mt-1">
                        {order.total_ttc.toFixed(2)} € TTC
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

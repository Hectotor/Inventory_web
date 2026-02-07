"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Order = {
  orders_id: string;
  customer_id: string;
  status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
  created_at?: Timestamp;
  customer_name?: string;
};

type OrdersPageProps = {
  ordersUrl: string; // URL pour les détails de commande (ex: /admin/orders ou /zone_manager/orders)
  filterByAgency?: boolean; // Si true, filtre automatiquement par l'agence de l'utilisateur
};

export function OrdersPage({ ordersUrl, filterByAgency = false }: OrdersPageProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED">("ALL");
  const [dateFilter, setDateFilter] = useState<{ month: number | null; year: number | null }>({ month: null, year: null });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string; agencies_id?: string; role?: string };
      if (!userData.company_id) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      // Pour les zone managers, filtrer par agencies_id
      const isZoneManager = userData.role === "area manager";
      const userAgencyId = userData.agencies_id;

      // Charger les commandes
      const ordersSnapshot = await getDocs(
        query(collection(db, "orders"), where("company_id", "==", userData.company_id))
      );

      let ordersList = ordersSnapshot.docs.map((doc) => ({
        orders_id: doc.data().orders_id || doc.id,
        customer_id: doc.data().customer_id || "",
        status: (doc.data().status || "PREPARATION") as Order["status"],
        created_at: doc.data().created_at,
      })) as Order[];

      // Filtrer les commandes par agence pour les zone managers
      if (isZoneManager && userAgencyId && filterByAgency) {
        const customersSnapshot = await getDocs(
          query(
            collection(db, "users"),
            where("company_id", "==", userData.company_id),
            where("agencies_id", "==", userAgencyId)
          )
        );
        const agencyCustomerIds = new Set(customersSnapshot.docs.map((doc) => doc.id));
        ordersList = ordersList.filter((order) => agencyCustomerIds.has(order.customer_id));
      }

      // Charger les noms des clients
      const ordersWithCustomers = await Promise.all(
        ordersList.map(async (order) => {
          try {
            const customerSnapshot = await getDoc(doc(db, "users", order.customer_id));
            if (customerSnapshot.exists()) {
              const customerData = customerSnapshot.data();
              return {
                ...order,
                customer_name: customerData.first_name && customerData.last_name
                  ? `${customerData.first_name} ${customerData.last_name}`
                  : customerData.email || "Client inconnu",
              };
            }
            return { ...order, customer_name: "Client inconnu" };
          } catch (error) {
            return { ...order, customer_name: "Client inconnu" };
          }
        })
      );

      // Trier par date de création (plus récent en premier)
      ordersWithCustomers.sort((a, b) => {
        const dateA = a.created_at?.toMillis() || 0;
        const dateB = b.created_at?.toMillis() || 0;
        return dateB - dateA;
      });

      setAllOrders(ordersWithCustomers);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [filterByAgency]);

  // Filtrage des commandes
  useEffect(() => {
    let filtered = allOrders;

    // Filtrer par date (mois/année)
    if (dateFilter.month !== null && dateFilter.year !== null) {
      filtered = filtered.filter((order) => {
        if (!order.created_at) return false;
        const date = order.created_at.toDate();
        return date.getMonth() === dateFilter.month && date.getFullYear() === dateFilter.year;
      });
    }

    // Filtrer par statut
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Filtrer par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.orders_id.toLowerCase().includes(query) ||
          order.customer_name?.toLowerCase().includes(query) ||
          false
      );
    }

    setOrders(filtered);
  }, [statusFilter, searchQuery, allOrders, dateFilter]);

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Aujourd'hui · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Hier · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const getStatusLabel = (status: Order["status"]) => {
    const labels: Record<Order["status"], string> = {
      PREPARATION: "En préparation",
      TAKEN: "Pris en charge",
      IN_DELIVERY: "En livraison",
      DELIVERED: "Livrée",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: Order["status"]) => {
    const colors: Record<Order["status"], string> = {
      PREPARATION: "bg-orange-100 text-orange-700",
      TAKEN: "bg-purple-100 text-purple-700",
      IN_DELIVERY: "bg-blue-100 text-blue-700",
      DELIVERED: "bg-green-100 text-green-700",
    };
    return colors[status] || "bg-zinc-100 text-zinc-700";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="space-y-4 w-full max-w-md">
          <div className="h-8 w-48 rounded-full bg-slate-200/80 animate-pulse" />
          <div className="h-64 rounded-[32px] bg-slate-200/80 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="mt-0">
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
                Gestion des commandes
              </p>
              <h1 className="text-2xl font-semibold mt-1">Commandes</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#6B7280]">
                {orders.length} / {allOrders.length}{" "}
                {allOrders.length === 1 ? "commande" : "commandes"}
              </span>
            </div>
          </div>

          {/* Barre de recherche et filtres */}
          <div className="mb-6 space-y-4">
            {/* Barre de recherche */}
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

            {/* Filtres par statut */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  statusFilter === "ALL"
                    ? "bg-[#111827] text-white"
                    : "bg-zinc-100 text-[#6B7280] hover:bg-zinc-200"
                }`}
              >
                Toutes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PREPARATION")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  statusFilter === "PREPARATION"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-zinc-100 text-[#6B7280] hover:bg-zinc-200"
                }`}
              >
                En préparation
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("IN_DELIVERY")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  statusFilter === "IN_DELIVERY"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-zinc-100 text-[#6B7280] hover:bg-zinc-200"
                }`}
              >
                En livraison
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("DELIVERED")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  statusFilter === "DELIVERED"
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-[#6B7280] hover:bg-zinc-200"
                }`}
              >
                Livrées
              </button>
            </div>

            {/* Filtre par calendrier */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={dateFilter.year ?? ""}
                onChange={(e) => setDateFilter({ ...dateFilter, year: e.target.value === "" ? null : parseInt(e.target.value) })}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              >
                <option value="">Toutes les années</option>
                {Array.from(new Set(allOrders.map(order => order.created_at?.toDate().getFullYear()).filter((year): year is number => year !== undefined))).sort((a, b) => b - a).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={dateFilter.month ?? ""}
                onChange={(e) => setDateFilter({ ...dateFilter, month: e.target.value === "" ? null : parseInt(e.target.value) })}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              >
                <option value="">Tous les mois</option>
                <option value="0">Janvier</option>
                <option value="1">Février</option>
                <option value="2">Mars</option>
                <option value="3">Avril</option>
                <option value="4">Mai</option>
                <option value="5">Juin</option>
                <option value="6">Juillet</option>
                <option value="7">Août</option>
                <option value="8">Septembre</option>
                <option value="9">Octobre</option>
                <option value="10">Novembre</option>
                <option value="11">Décembre</option>
              </select>
              {(dateFilter.month !== null || dateFilter.year !== null) && (
                <button
                  type="button"
                  onClick={() => setDateFilter({ month: null, year: null })}
                  className="h-11 px-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-16 text-[#6B7280]">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-sm font-medium mb-1">
                {allOrders.length === 0
                  ? "Aucune commande pour le moment"
                  : "Aucune commande ne correspond aux filtres"}
              </p>
              <p className="text-xs">
                {allOrders.length === 0
                  ? "Aucune commande enregistrée"
                  : "Essayez de modifier les filtres"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.orders_id}
                  onClick={() => router.push(`${ordersUrl}/${order.orders_id}`)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-sm font-semibold text-[#111827]">
                        Commande #{order.orders_id.slice(0, 8).toUpperCase()}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">{order.customer_name}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg">→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

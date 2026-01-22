"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Stock = {
  id: string;
  product_id: string;
  agencies_id?: string;
  quantity: number;
  alert_threshold?: number;
};

type Product = {
  id: string;
  name: string;
  sub_name?: string;
};

type AlertProduct = {
  productId: string;
  productName: string;
  totalStock: number;
  alertThreshold: number;
};

type Order = {
  orders_id: string;
  customer_id: string;
  status: "PREPARATION" | "IN_DELIVERY" | "DELIVERED";
  created_at?: Timestamp;
  customer_name?: string;
};

type DashboardPageProps = {
  stocksUrl: string;
  ordersUrl: string;
};

export function DashboardPage({ stocksUrl, ordersUrl }: DashboardPageProps) {
  const router = useRouter();
  const [alertProducts, setAlertProducts] = useState<AlertProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersInPreparation: 0,
    ordersInDelivery: 0,
    ordersDelivered: 0,
    totalOrders: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PREPARATION" | "IN_DELIVERY" | "DELIVERED">("ALL");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setAlertProducts([]);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setAlertProducts([]);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string; agencies_id?: string; role?: string };
      if (!userData.company_id) {
        setAlertProducts([]);
        setIsLoading(false);
        return;
      }

      // Pour les zone managers, filtrer par agencies_id
      const isZoneManager = userData.role === "area manager";
      const userAgencyId = userData.agencies_id;

      // Charger les stocks (filtrés par agencies_id si zone manager)
      let stocksQuery = query(collection(db, "stocks"), where("company_id", "==", userData.company_id));
      if (isZoneManager && userAgencyId) {
        stocksQuery = query(
          collection(db, "stocks"),
          where("company_id", "==", userData.company_id),
          where("agencies_id", "==", userAgencyId)
        );
      }

      // Charger les stocks, produits et commandes
      const [stocksSnapshot, productsSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(stocksQuery),
        getDocs(query(collection(db, "products"), where("company_id", "==", userData.company_id))),
        getDocs(query(collection(db, "orders"), where("company_id", "==", userData.company_id))),
      ]);

      const stocks = stocksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Stock[];

      const products = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];

      // Calculer le total de stock par produit
      const productTotals = new Map<string, number>();
      stocks.forEach((stock) => {
        const current = productTotals.get(stock.product_id) || 0;
        productTotals.set(stock.product_id, current + stock.quantity);
      });

      // Trouver les produits en alerte
      const alerts: AlertProduct[] = [];
      const processedProducts = new Set<string>();

      stocks.forEach((stock) => {
        if (stock.alert_threshold && !processedProducts.has(stock.product_id)) {
          const totalStock = productTotals.get(stock.product_id) || 0;
          if (totalStock <= stock.alert_threshold) {
            const product = products.find((p) => p.id === stock.product_id);
            if (product) {
              alerts.push({
                productId: stock.product_id,
                productName: product.sub_name ? `${product.name} - ${product.sub_name}` : product.name,
                totalStock,
                alertThreshold: stock.alert_threshold,
              });
              processedProducts.add(stock.product_id);
            }
          }
        }
      });

      setAlertProducts(alerts);

      // Calculer les statistiques des commandes
      let orders = ordersSnapshot.docs.map((doc) => doc.data());
      
      // Pour les zone managers, filtrer les commandes par agencies_id du client
      if (isZoneManager && userAgencyId) {
        const ordersWithCustomers = await Promise.all(
          orders.map(async (order) => {
            try {
              const customerDoc = await getDoc(doc(db, "users", order.customer_id));
              if (customerDoc.exists()) {
                const customerData = customerDoc.data();
                // Filtrer seulement les commandes des clients de cette agence
                if (customerData.agencies_id === userAgencyId) {
                  return order;
                }
              }
            } catch (error) {
              console.error("Error loading customer:", error);
            }
            return null;
          })
        );
        orders = ordersWithCustomers.filter((order): order is typeof orders[0] => order !== null);
      }

      const ordersInPreparation = orders.filter((order) => order.status === "PREPARATION").length;
      const ordersInDelivery = orders.filter((order) => order.status === "IN_DELIVERY").length;
      const ordersDelivered = orders.filter((order) => order.status === "DELIVERED").length;
      const totalOrders = orders.length;

      setStats({
        ordersInPreparation,
        ordersInDelivery,
        ordersDelivered,
        totalOrders,
      });

      // Charger les commandes avec les noms des clients
      const ordersWithCustomers = await Promise.all(
        orders.map(async (order) => {
          let customerName = "Client inconnu";
          try {
            const customerDoc = await getDoc(doc(db, "users", order.customer_id));
            if (customerDoc.exists()) {
              const customerData = customerDoc.data();
              customerName = customerData.first_name && customerData.last_name
                ? `${customerData.first_name} ${customerData.last_name}`
                : customerData.email || "Client inconnu";
            }
          } catch (error) {
            console.error("Error loading customer:", error);
          }
          return {
            ...order,
            customer_name: customerName,
          } as Order;
        })
      );

      // Trier par date de création (plus récent en premier)
      ordersWithCustomers.sort((a, b) => {
        const dateA = a.created_at?.toMillis() || 0;
        const dateB = b.created_at?.toMillis() || 0;
        return dateB - dateA;
      });

      setOrders(ordersWithCustomers);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {/* Warning Stock Bas */}
      {!isLoading && alertProducts.length > 0 && (
        <section className="mb-6">
          <div className="rounded-[28px] border-2 border-red-200 bg-red-50/80 p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <h2 className="text-lg font-semibold text-red-900">
                  Alertes Stock ({alertProducts.length})
                </h2>
              </div>
              <button
                onClick={() => router.push(stocksUrl)}
                className="text-sm font-medium text-red-700 transition hover:text-red-900"
              >
                Voir les stocks →
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alertProducts.slice(0, 6).map((alert) => (
                <div
                  key={alert.productId}
                  className="rounded-xl border border-red-200 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-[#111827] mb-1">{alert.productName}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#6B7280]">Stock actuel:</span>
                    <span className="text-sm font-bold text-red-600">{alert.totalStock}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[#6B7280]">Seuil d'alerte:</span>
                    <span className="text-sm font-medium text-red-500">{alert.alertThreshold}</span>
                  </div>
                </div>
              ))}
            </div>
            {alertProducts.length > 6 && (
              <p className="mt-4 text-xs text-center text-red-700">
                +{alertProducts.length - 6} autre{alertProducts.length - 6 > 1 ? "s" : ""} produit{alertProducts.length - 6 > 1 ? "s" : ""} en alerte
              </p>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "En préparation", value: stats.ordersInPreparation, icon: "📦" },
          { label: "En cours de livraison", value: stats.ordersInDelivery, icon: "🛵" },
          { label: "Livrées", value: stats.ordersDelivered, icon: "✅" },
          { label: "Total commandes", value: stats.totalOrders, icon: "📊" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B7280]">{stat.label}</p>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Commandes récentes</h2>
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
          </div>

          {/* Liste des commandes */}
          <div className="space-y-4">
            {(() => {
              const statusLabels: Record<string, string> = {
                PREPARATION: "En préparation",
                IN_DELIVERY: "En cours de livraison",
                DELIVERED: "Livrée",
              };

              const statusColors: Record<string, string> = {
                PREPARATION: "bg-orange-100 text-orange-700",
                IN_DELIVERY: "bg-blue-100 text-blue-700",
                DELIVERED: "bg-green-100 text-green-700",
              };

              const formatDate = (timestamp?: Timestamp) => {
                if (!timestamp) return "—";
                const date = timestamp.toDate();
                const now = new Date();
                const diffTime = now.getTime() - date.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                  return `Aujourd'hui · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
                } else if (diffDays === 1) {
                  return `Hier · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
                } else {
                  return new Intl.DateTimeFormat("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(date);
                }
              };

              // Filtrer les commandes
              const filteredOrders = orders.filter((order) => {
                // Filtre par statut
                if (statusFilter !== "ALL" && order.status !== statusFilter) {
                  return false;
                }

                // Filtre par recherche
                if (searchQuery.trim()) {
                  const query = searchQuery.toLowerCase();
                  const orderId = order.orders_id.slice(0, 8).toUpperCase();
                  const customerName = order.customer_name?.toLowerCase() || "";
                  const status = statusLabels[order.status]?.toLowerCase() || "";
                  return (
                    orderId.includes(query) ||
                    customerName.includes(query) ||
                    status.includes(query)
                  );
                }

                return true;
              });

              if (filteredOrders.length === 0) {
                return (
                  <div className="text-center py-12 text-[#6B7280]">
                    <div className="text-4xl mb-4">📦</div>
                    <p className="text-sm font-medium mb-1">Aucune commande trouvée</p>
                    <p className="text-xs">
                      {searchQuery || statusFilter !== "ALL"
                        ? "Essayez avec d'autres critères"
                        : "Aucune commande pour le moment"}
                    </p>
                  </div>
                );
              }

              return filteredOrders.slice(0, 10).map((order) => (
                <div
                  key={order.orders_id}
                  onClick={() => router.push(`${ordersUrl}/${order.orders_id}`)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      Commande #{order.orders_id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {order.customer_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status]}`}
                    >
                      {statusLabels[order.status]}
                    </span>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </section>
    </>
  );
}

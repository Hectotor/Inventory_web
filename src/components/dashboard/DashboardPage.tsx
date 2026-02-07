"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { OrderEvolutionChart } from "./OrderEvolutionChart";
import { TopProductsChart } from "./TopProductsChart";
import { TopAgenciesChart } from "./TopAgenciesChart";
import {
  filterOrdersByAgency,
  filterStocksByAgency,
  calculateOrderStats,
  calculateStockAlerts,
} from "@/lib/agencyFilter";

type Stock = {
  id: string;
  product_id: string;
  agencies_id?: string;
  location_id?: string;
  location_type?: "ENTREPOT" | "USER";
  quantity: number;
  alert_threshold?: number;
};

type Product = {
  id: string;
  name: string;
  sub_name?: string;
};

type Agency = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string;
  agencies_id: string;
};

type StockLocation = {
  stockId: string;
  quantity: number;
  agencyName?: string;
  locationName?: string;
};

type AlertProduct = {
  productId: string;
  productName: string;
  totalStock: number;
  alertThreshold: number;
  stockLocations: StockLocation[];
};

type Order = {
  orders_id: string;
  customer_id: string;
  status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
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
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; agencies_id?: string }>>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED">("ALL");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<string>("ALL");
  const [userRole, setUserRole] = useState<string>("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [analyticsData, setAnalyticsData] = useState({
    topProducts: [] as { name: string; quantity: number }[],
    ordersByMonth: [] as { month: string; count: number }[],
    ordersByStatus: [] as { name: string; value: number; color: string }[],
  });

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

      // Stocker le rôle de l'utilisateur
      setUserRole(userData.role || "");

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

      // Charger les stocks, produits, commandes, agences, entrepôts et utilisateurs
      let ordersQuery = query(collection(db, "orders"), where("company_id", "==", userData.company_id));
      
      // Pour les zone managers, filtrer les commandes par agence du client
      let ordersList: Order[] = [];
      if (isZoneManager && userAgencyId) {
        // Récupérer les clients de cette agence
        const customersSnapshot = await getDocs(
          query(
            collection(db, "users"),
            where("company_id", "==", userData.company_id),
            where("agencies_id", "==", userAgencyId)
          )
        );
        const agencyCustomerIds = new Set(customersSnapshot.docs.map((doc) => doc.id));
        
        // Charger toutes les commandes et filtrer ensuite
        const allOrdersSnapshot = await getDocs(
          query(collection(db, "orders"), where("company_id", "==", userData.company_id))
        );
        ordersList = allOrdersSnapshot.docs.map((doc) => ({
          orders_id: doc.data().orders_id || doc.id,
          customer_id: doc.data().customer_id || "",
          status: (doc.data().status || "PREPARATION") as Order["status"],
          created_at: doc.data().created_at,
        })).filter((order) => agencyCustomerIds.has(order.customer_id));
      }

      const [stocksSnapshot, productsSnapshot, ordersSnapshot, agenciesSnapshot, warehousesSnapshot, usersSnapshot] = await Promise.all([
        getDocs(stocksQuery),
        getDocs(query(collection(db, "products"), where("company_id", "==", userData.company_id))),
        isZoneManager && userAgencyId ? Promise.resolve({ docs: [] }) : getDocs(ordersQuery),
        getDocs(query(collection(db, "agencies"), where("company_id", "==", userData.company_id))),
        getDocs(query(collection(db, "warehouses"), where("company_id", "==", userData.company_id))),
        getDocs(query(collection(db, "users"), where("company_id", "==", userData.company_id))),
      ]);

      const stocks = stocksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Stock[];
      setAllStocks(stocks);

      const products = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(products);

      const agenciesList = agenciesSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "",
      })) as Agency[];
      setAgencies(agenciesList);

      const warehousesList = warehousesSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "",
        agencies_id: doc.data().agencies_id || "",
      })) as Warehouse[];
      setWarehouses(warehousesList);

      // Stocker tous les utilisateurs
      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        agencies_id: doc.data().agencies_id,
      }));
      setAllUsers(users);

      // Calculer le total de stock par produit
      const productTotals = new Map<string, number>();
      stocks.forEach((stock) => {
        const current = productTotals.get(stock.product_id) || 0;
        productTotals.set(stock.product_id, current + stock.quantity);
      });

      // Trouver les produits en alerte
      const alerts: AlertProduct[] = [];
      const processedProducts = new Set<string>();

      const getAgencyName = (agencyId?: string) => {
        if (!agencyId) return "—";
        return agenciesList.find((a) => a.id === agencyId)?.name || "—";
      };

      const getWarehouseName = (warehouseId?: string) => {
        if (!warehouseId) return "—";
        return warehousesList.find((w) => w.id === warehouseId)?.name || "—";
      };

      stocks.forEach((stock) => {
        if (stock.alert_threshold && !processedProducts.has(stock.product_id)) {
          const totalStock = productTotals.get(stock.product_id) || 0;
          if (totalStock <= stock.alert_threshold) {
            const product = products.find((p) => p.id === stock.product_id);
            if (product) {
              // Collecter tous les stocks de ce produit
              const productStocks = stocks.filter((s) => s.product_id === stock.product_id);
              const stockLocations: StockLocation[] = productStocks.map((s) => ({
                stockId: s.id,
                quantity: s.quantity,
                agencyName: getAgencyName(s.agencies_id),
                locationName: s.location_type === "ENTREPOT" && s.location_id
                  ? getWarehouseName(s.location_id)
                  : s.location_type === "USER" && s.location_id
                  ? `Utilisateur ${s.location_id.slice(0, 8)}`
                  : "—",
              }));

              alerts.push({
                productId: stock.product_id,
                productName: product.sub_name ? `${product.name} - ${product.sub_name}` : product.name,
                totalStock,
                alertThreshold: stock.alert_threshold,
                stockLocations,
              });
              processedProducts.add(stock.product_id);
            }
          }
        }
      });

      setAlertProducts(alerts);

      // Calculer les statistiques des commandes
      let orders: any[];
      
      // Pour les zone managers, utiliser les commandes filtrées
      if (isZoneManager && userAgencyId) {
        orders = ordersList;
      } else {
        // Pour les admins, utiliser toutes les commandes
        orders = ordersSnapshot.docs.map((doc) => doc.data());
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
      setAllOrders(ordersWithCustomers);
      setIsLoading(false);

      // Calculer les données d'analyse
      calculateAnalytics(ordersWithCustomers, products);
    });

    return () => unsubscribe();
  }, []);

  // Filtrer les commandes quand l'agence sélectionnée change
  useEffect(() => {
    if (allOrders.length > 0 && allUsers.length > 0) {
      const filteredOrders = filterOrdersByAgency(allOrders, allUsers, selectedAgency);
      setOrders(filteredOrders);
      const stats = calculateOrderStats(filteredOrders);
      setStats(stats);
    }
  }, [selectedAgency, allOrders, allUsers]);

  // Filtrer les stocks et recalculer les alertes quand l'agence sélectionnée change
  useEffect(() => {
    if (allStocks.length > 0 && products.length > 0) {
      const filteredStocks = filterStocksByAgency(allStocks, selectedAgency);
      const alerts = calculateStockAlerts(filteredStocks, products, agencies, warehouses);
      setAlertProducts(alerts);
    }
  }, [selectedAgency, allStocks, products, agencies, warehouses]);

  const calculateAnalytics = (ordersList: Order[], productsList: Product[]) => {
    // Calculer les produits les plus vendus
    const productSales = new Map<string, number>();
    ordersList.forEach(order => {
      if (order.status === "DELIVERED") {
        // Pour l'instant, on suppose que chaque commande contient 1 produit
        // À améliorer quand on aura les items de commande
        const productId = order.orders_id; // Temporaire
        productSales.set(productId, (productSales.get(productId) || 0) + 1);
      }
    });

    const topProducts = Array.from(productSales.entries())
      .map(([id, quantity]) => {
        const product = productsList.find(p => p.id === id);
        return {
          name: product ? (product.sub_name ? `${product.name} - ${product.sub_name}` : product.name) : `Produit ${id.slice(0, 8)}`,
          quantity,
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Calculer les commandes par mois
    const ordersByMonthMap = new Map<string, number>();
    ordersList.forEach(order => {
      if (order.created_at) {
        const date = order.created_at.toDate();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        ordersByMonthMap.set(monthKey, (ordersByMonthMap.get(monthKey) || 0) + 1);
      }
    });

    const ordersByMonth = Array.from(ordersByMonthMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Derniers 6 mois

    // Calculer les commandes par statut
    const statusCounts = {
      PREPARATION: ordersList.filter(o => o.status === "PREPARATION").length,
      TAKEN: ordersList.filter(o => o.status === "TAKEN").length,
      IN_DELIVERY: ordersList.filter(o => o.status === "IN_DELIVERY").length,
      DELIVERED: ordersList.filter(o => o.status === "DELIVERED").length,
    };

    const ordersByStatus = [
      { name: "En préparation", value: statusCounts.PREPARATION, color: "#f97316" },
      { name: "Pris en charge", value: statusCounts.TAKEN, color: "#a855f7" },
      { name: "En livraison", value: statusCounts.IN_DELIVERY, color: "#3b82f6" },
      { name: "Livrées", value: statusCounts.DELIVERED, color: "#22c55e" },
    ].filter(s => s.value > 0);

    setAnalyticsData({
      topProducts,
      ordersByMonth,
      ordersByStatus,
    });
  };

  return (
    <>
      <section>
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
                Analyse des données
              </p>
              <h1 className="text-2xl font-semibold mt-1">Tableau de bord</h1>
            </div>
            {/* Sélecteur d'agence - visible seulement pour les admins */}
            {agencies.length > 0 && userRole !== "area manager" && (
              <div className="relative">
                <select
                  value={selectedAgency}
                  onChange={(e) => setSelectedAgency(e.target.value)}
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 pr-10 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="ALL">Toutes les agences</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cartes de statistiques */}
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
            {[
              { label: "En préparation", value: stats.ordersInPreparation, icon: "📦" },
              { label: "En cours de livraison", value: stats.ordersInDelivery, icon: "🛵" },
              { label: "Livrées", value: stats.ordersDelivered, icon: "✅" },
              { label: "Total commandes", value: stats.totalOrders, icon: "📊" },
              { label: "Alertes Stock", value: alertProducts.length, icon: "⚠️", isAlert: true },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur ${stat.isAlert && stat.value > 0 ? 'border-red-200 bg-red-50/80' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6B7280]">{stat.label}</p>
                  <span className="text-xl">{stat.icon}</span>
                </div>
                <p className={`mt-3 text-3xl font-semibold ${stat.isAlert && stat.value > 0 ? 'text-red-600' : ''}`}>{stat.value}</p>
              </div>
            ))}
          </section>

          {/* Graphiques d'analyse */}
          <OrderEvolutionChart orders={orders} selectedAgency={selectedAgency} />
          <TopProductsChart orders={orders} products={products} selectedAgency={selectedAgency} />
          {userRole !== "area manager" && selectedAgency === "ALL" && <TopAgenciesChart orders={orders} agencies={agencies} selectedAgency={selectedAgency} />}
        </div>
      </section>
    </>
  );
}

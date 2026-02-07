import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

type Order = {
  orders_id: string;
  customer_id: string;
  status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
  created_at?: Timestamp;
};

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
};

type User = {
  id: string;
  agencies_id?: string;
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

/**
 * Filtre les commandes par agence sélectionnée
 * @param allOrders - Toutes les commandes chargées
 * @param allUsers - Tous les utilisateurs chargés
 * @param selectedAgency - ID de l'agence sélectionnée ou "ALL"
 * @returns Commandes filtrées
 */
export function filterOrdersByAgency(
  allOrders: Order[],
  allUsers: User[],
  selectedAgency: string
): Order[] {
  if (selectedAgency === "ALL") {
    return allOrders;
  }

  const agencyCustomerIds = new Set(
    allUsers
      .filter((user) => user.agencies_id === selectedAgency)
      .map((user) => user.id)
  );

  return allOrders.filter((order) => agencyCustomerIds.has(order.customer_id));
}

/**
 * Filtre les stocks par agence sélectionnée
 * @param allStocks - Tous les stocks chargés
 * @param selectedAgency - ID de l'agence sélectionnée ou "ALL"
 * @returns Stocks filtrés
 */
export function filterStocksByAgency(
  allStocks: Stock[],
  selectedAgency: string
): Stock[] {
  if (selectedAgency === "ALL") {
    return allStocks;
  }

  return allStocks.filter((stock) => stock.agencies_id === selectedAgency);
}

/**
 * Calcule les statistiques des commandes
 * @param orders - Commandes à analyser
 * @returns Statistiques des commandes
 */
export function calculateOrderStats(orders: Order[]) {
  const ordersInPreparation = orders.filter((order) => order.status === "PREPARATION").length;
  const ordersInDelivery = orders.filter((order) => order.status === "IN_DELIVERY").length;
  const ordersDelivered = orders.filter((order) => order.status === "DELIVERED").length;
  const totalOrders = orders.length;

  return {
    ordersInPreparation,
    ordersInDelivery,
    ordersDelivered,
    totalOrders,
  };
}

/**
 * Calcule les alertes de stock
 * @param stocks - Stocks filtrés par agence
 * @param products - Liste des produits
 * @param agencies - Liste des agences
 * @param warehouses - Liste des entrepôts
 * @returns Alertes de stock
 */
export function calculateStockAlerts(
  stocks: Stock[],
  products: Product[],
  agencies: Agency[],
  warehouses: Warehouse[]
): AlertProduct[] {
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
    return agencies.find((a) => a.id === agencyId)?.name || "—";
  };

  const getWarehouseName = (warehouseId?: string) => {
    if (!warehouseId) return "—";
    return warehouses.find((w) => w.id === warehouseId)?.name || "—";
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

  return alerts;
}

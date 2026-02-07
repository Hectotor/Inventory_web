import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

type OrderItem = {
  order_items_id: string;
  order_id: string;
  product_id: string;
  quantity: number;
};

type Order = {
  orders_id: string;
  customer_id: string;
  status: string;
  created_at?: { toDate: () => Date };
};

type User = {
  uid: string;
  company_id?: string;
  agencies_id?: string;
  role?: string;
};

/**
 * Charge les order_items filtrés en fonction du rôle de l'utilisateur
 * - Admin : Tous les order_items de la company (ou de l'agence sélectionnée)
 * - Zone Manager : Seulement les order_items des clients de son agence
 */
export async function loadFilteredOrderItems(
  user: User,
  orders: Order[]
): Promise<OrderItem[]> {
  if (!user.company_id) {
    return [];
  }

  const isZoneManager = user.role === "area manager";
  const userAgencyId = user.agencies_id;

  // Pour les admins, charger tous les order_items de la company
  if (!isZoneManager || !userAgencyId) {
    const deliveredOrders = orders.filter((o) => o.status === "DELIVERED");
    const orderIds = deliveredOrders.map((o) => o.orders_id);

    if (orderIds.length === 0) {
      return [];
    }

    const orderItemsSnapshot = await getDocs(
      query(collection(db, "order_items"), where("order_id", "in", orderIds))
    );

    let orderItems = orderItemsSnapshot.docs.map((doc) => ({
      order_items_id: doc.id,
      order_id: doc.data().order_id,
      product_id: doc.data().product_id,
      quantity: doc.data().quantity,
    }));

    // Si une agence est spécifiée (pour les admins), filtrer par agence
    if (user.agencies_id && user.agencies_id !== "ALL") {
      // Récupérer les customers de cette agence
      const customersSnapshot = await getDocs(
        query(
          collection(db, "users"),
          where("company_id", "==", user.company_id),
          where("agencies_id", "==", user.agencies_id)
        )
      );
      const agencyCustomerIds = new Set(customersSnapshot.docs.map((doc) => doc.id));

      // Filtrer les order_items pour ne garder que ceux des commandes des clients de l'agence
      const agencyOrderIds = new Set(deliveredOrders
        .filter((order) => agencyCustomerIds.has(order.customer_id))
        .map((order) => order.orders_id));

      orderItems = orderItems.filter((item) => agencyOrderIds.has(item.order_id));
    }

    return orderItems;
  }

  // Pour les zone managers, charger les order_items filtrés par agence
  const deliveredOrders = orders.filter(
    (o) => o.status === "DELIVERED"
  );

  if (deliveredOrders.length === 0) {
    return [];
  }

  // Récupérer les customers de cette agence
  const customersSnapshot = await getDocs(
    query(
      collection(db, "users"),
      where("company_id", "==", user.company_id),
      where("agencies_id", "==", userAgencyId)
    )
  );
  const agencyCustomerIds = new Set(
    customersSnapshot.docs.map((doc) => doc.id)
  );

  // Filtrer les commandes pour ne garder que celles des clients de l'agence
  const filteredOrders = deliveredOrders.filter((order) =>
    agencyCustomerIds.has(order.customer_id)
  );

  if (filteredOrders.length === 0) {
    return [];
  }

  const orderIds = filteredOrders.map((o) => o.orders_id);

  const orderItemsSnapshot = await getDocs(
    query(collection(db, "order_items"), where("order_id", "in", orderIds))
  );

  return orderItemsSnapshot.docs.map((doc) => ({
    order_items_id: doc.id,
    order_id: doc.data().order_id,
    product_id: doc.data().product_id,
    quantity: doc.data().quantity,
  }));
}

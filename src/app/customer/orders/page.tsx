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

type OrderItemData = {
  order_items_id: string;
  order_id: string;
  product_id: string;
  quantity: number;
};

type Product = {
  id: string;
  name: string;
  price_ht: number;
  tva: number;
};

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
  orders_id: string;
  company_id: string;
  customer_id: string;
  sales_id?: string | null;
  created_by: string;
  status: "PREPARATION" | "IN_DELIVERY" | "DELIVERED";
  created_at?: Timestamp;
  items: OrderItem[];
  total_ht: number;
  total_ttc: number;
};

const statusLabels: Record<Order["status"], string> = {
  PREPARATION: "En préparation",
  IN_DELIVERY: "En cours de livraison",
  DELIVERED: "Livrée",
};

const statusColors: Record<Order["status"], string> = {
  PREPARATION: "bg-orange-100 text-orange-700",
  IN_DELIVERY: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
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
      status: "PREPARATION" | "IN_DELIVERY" | "DELIVERED";
      created_at?: Timestamp;
    }>;

    // Pour chaque commande, charger les order_items et les produits
    const ordersWithItems = await Promise.all(
      ordersData.map(async (orderData) => {
        // Charger les order_items pour cette commande
        const orderItemsSnapshot = await getDocs(
          query(
            collection(db, "order_items"),
            where("order_id", "==", orderData.orders_id)
          )
        );

        const orderItemsData = orderItemsSnapshot.docs.map((doc) => ({
          order_items_id: doc.id,
          ...doc.data(),
        })) as OrderItemData[];

        // Charger les produits pour calculer les prix
        const items = await Promise.all(
          orderItemsData.map(async (itemData) => {
            const productDoc = await getDoc(doc(db, "products", itemData.product_id));
            if (!productDoc.exists()) {
              return null;
            }
            const product = { id: productDoc.id, ...productDoc.data() } as Product;
            
            const price_ht = product.price_ht;
            const tva = product.tva;
            const total_ht = price_ht * itemData.quantity;
            const total_ttc = price_ht * (1 + tva / 100) * itemData.quantity;

            return {
              product_id: itemData.product_id,
              product_name: product.name,
              quantity: itemData.quantity,
              price_ht,
              tva,
              total_ht,
              total_ttc,
            } as OrderItem;
          })
        );

        // Filtrer les null (produits supprimés)
        const validItems = items.filter((item): item is OrderItem => item !== null);

        // Calculer les totaux
        const total_ht = validItems.reduce((sum, item) => sum + item.total_ht, 0);
        const total_ttc = validItems.reduce((sum, item) => sum + item.total_ttc, 0);

        return {
          orders_id: orderData.orders_id,
          company_id: orderData.company_id,
          customer_id: orderData.customer_id,
          sales_id: orderData.sales_id,
          created_by: orderData.created_by,
          status: orderData.status,
          created_at: orderData.created_at,
          items: validItems,
          total_ht,
          total_ttc,
        } as Order;
      })
    );

    // Trier par date de création (plus récent en premier)
    ordersWithItems.sort((a, b) => {
      const dateA = a.created_at?.toMillis() || 0;
      const dateB = b.created_at?.toMillis() || 0;
      return dateB - dateA;
    });

    setOrders(ordersWithItems);
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
              key={order.orders_id}
              className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                    Commande #{order.orders_id.slice(0, 8)}
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
                    {order.total_ht.toFixed(2)} € HT
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">
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
                          {item.total_ht.toFixed(2)} € HT
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {item.total_ttc.toFixed(2)} € TTC
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <p className="text-base font-semibold">Total HT</p>
                  <p className="text-lg font-semibold">{order.total_ht.toFixed(2)} € HT</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-[#6B7280]">Total TTC</p>
                  <p className="text-sm text-[#6B7280]">{order.total_ttc.toFixed(2)} € TTC</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

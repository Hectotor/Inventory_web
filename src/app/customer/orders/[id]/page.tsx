"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  price_ht?: number;
  tva?: number;
  total_ht?: number;
  total_ttc?: number;
};

type Product = {
  id: string;
  name: string;
  sub_name?: string;
  price_ht: number;
  tva: number;
  image_url?: string;
  image_urls?: string[];
};

type OrderItem = {
  product_id: string;
  product_name: string;
  product_sub_name?: string;
  product_image?: string;
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
  status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
  created_at?: Timestamp;
  items: OrderItem[];
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

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/connexion");
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setError("Utilisateur non trouvé");
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { role?: string };
      if (userData.role !== "customer") {
        setError("Accès non autorisé");
        setIsLoading(false);
        return;
      }

      await loadOrder(orderId, currentUser.uid);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [orderId, router]);

  const loadOrder = async (orderId: string, customerId: string) => {
    try {
      // Charger la commande
      const orderDoc = await getDoc(doc(db, "orders", orderId));
      
      if (!orderDoc.exists()) {
        setError("Commande non trouvée");
        return;
      }

      const orderData = {
        orders_id: orderDoc.id,
        ...orderDoc.data(),
      } as {
        orders_id: string;
        company_id: string;
        customer_id: string;
        sales_id?: string | null;
        created_by: string;
        status: "PREPARATION" | "TAKEN" | "IN_DELIVERY" | "DELIVERED";
        created_at?: Timestamp;
      };

      // Vérifier que la commande appartient au client
      if (orderData.customer_id !== customerId) {
        setError("Accès non autorisé");
        return;
      }

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

      // Charger les produits pour obtenir les noms et images, mais utiliser les prix depuis order_items
      const items = await Promise.all(
        orderItemsData.map(async (itemData) => {
          // Utiliser les prix sauvegardés dans order_items
          const price_ht = itemData.price_ht ?? 0;
          const TVA_RATE = 20; // TVA fixe de 20%
          const tva = itemData.tva ?? TVA_RATE;
          const total_ht = itemData.total_ht ?? 0;
          const total_ttc = itemData.total_ttc ?? 0;

          // Charger le produit uniquement pour obtenir le nom et l'image
          const productDoc = await getDoc(doc(db, "products", itemData.product_id));
          if (!productDoc.exists()) {
            // Si le produit n'existe plus, utiliser les données de base depuis order_items
            return {
              product_id: itemData.product_id,
              product_name: "Produit supprimé",
              product_sub_name: undefined,
              product_image: undefined,
              quantity: itemData.quantity,
              price_ht,
              tva,
              total_ht,
              total_ttc,
            } as OrderItem;
          }
          
          const product = { id: productDoc.id, ...productDoc.data() } as Product;
          const images = product.image_urls || (product.image_url ? [product.image_url] : []);
          const firstImage = images[0];

          return {
            product_id: itemData.product_id,
            product_name: product.name,
            product_sub_name: product.sub_name,
            product_image: firstImage,
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

      setOrder({
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
      });
    } catch (error) {
      console.error("Error loading order:", error);
      setError("Erreur lors du chargement de la commande");
    }
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
          <p className="text-sm text-[#6B7280]">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => router.push("/customer/orders")}
          className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827]"
        >
          ← Retour aux commandes
        </button>
        <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-sm font-medium mb-1">
              {error || "Commande non trouvée"}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/customer/orders")}
        className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827]"
      >
        ← Retour aux commandes
      </button>

      <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Commande #{order.orders_id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-sm text-[#6B7280] mt-1">
              {formatDate(order.created_at)}
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status]}`}
          >
            {statusLabels[order.status]}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          {order.items.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-xl border border-zinc-100 bg-[#F8FAFC] p-4"
            >
              {item.product_image ? (
                <img
                  src={item.product_image}
                  alt={item.product_name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-zinc-200 flex items-center justify-center flex-shrink-0">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111827] mb-1">
                  {item.product_name}
                </p>
                {item.product_sub_name && (
                  <p className="text-xs text-[#6B7280] mb-2">
                    {item.product_sub_name}
                  </p>
                )}
                <p className="text-xs text-[#6B7280] mb-2">
                  Quantité: {item.quantity} × {item.price_ht.toFixed(2)} € HT
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                  <span className="text-xs text-[#6B7280]">Sous-total HT:</span>
                  <span className="text-sm font-semibold text-[#111827]">
                    {item.total_ht.toFixed(2)} € HT
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[#6B7280]">
                    TVA (20%):
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    {(Math.round((item.total_ttc - item.total_ht) * 100) / 100).toFixed(2)} €
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
                  <span className="text-sm font-semibold text-[#111827]">
                    Total TTC:
                  </span>
                  <span className="text-sm font-semibold text-[#111827]">
                    {item.total_ttc.toFixed(2)} € TTC
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-200 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-base text-[#6B7280]">Total HT:</span>
            <span className="text-base font-semibold text-[#111827]">
              {order.total_ht.toFixed(2)} € HT
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-base text-[#6B7280]">Total TVA:</span>
            <span className="text-base text-[#6B7280]">
              {(Math.round((order.total_ttc - order.total_ht) * 100) / 100).toFixed(2)} €
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t-2 border-zinc-300">
            <span className="text-xl font-semibold text-[#111827]">Total TTC:</span>
            <span className="text-xl font-semibold text-[#111827]">
              {order.total_ttc.toFixed(2)} € TTC
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadFilteredOrderItems } from "@/lib/orderItemsFilter";

type TopProductsChartProps = {
  orders: Array<{ orders_id: string; customer_id: string; status: string; created_at?: { toDate: () => Date } }>;
  products: Array<{ id: string; name: string; sub_name?: string; image_urls?: string[]; image_url?: string }>;
  selectedAgency?: string;
};

export function TopProductsChart({ orders, products, selectedAgency }: TopProductsChartProps) {
  const [orderItems, setOrderItems] = useState<Array<{ product_id: string; quantity: number }>>([]);

  // Charger les order_items au montage et quand l'agence change
  useEffect(() => {
    const loadOrderItems = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
        if (!userSnapshot.exists()) return;

        const userData = userSnapshot.data() as { company_id?: string; agencies_id?: string; role?: string };
        if (!userData.company_id) return;

        // Utiliser la fonction de filtre pour charger les order_items
        const filteredOrderItems = await loadFilteredOrderItems(
          {
            uid: currentUser.uid,
            company_id: userData.company_id,
            // Si une agence est sélectionnée et l'utilisateur est admin, utiliser cette agence
            agencies_id: selectedAgency && selectedAgency !== "ALL" ? selectedAgency : userData.agencies_id,
            role: userData.role,
          },
          orders
        );

        setOrderItems(filteredOrderItems);
      } catch (error) {
        console.error("Error loading order items:", error);
      }
    };

    loadOrderItems();
  }, [orders, selectedAgency]);

  // Calculer les produits les plus vendus
  const getTopProducts = () => {
    const productSales = new Map<string, number>();

    // Utiliser order_items pour calculer les ventes réelles
    orderItems.forEach(item => {
      const productId = item.product_id;
      productSales.set(productId, (productSales.get(productId) || 0) + item.quantity);
    });

    return Array.from(productSales.entries())
      .map(([id, quantity]) => {
        const product = products.find(p => p.id === id);
        return {
          id,
          name: product ? (product.sub_name ? `${product.name} - ${product.sub_name}` : product.name) : `Produit ${id.slice(0, 8)}`,
          imageUrl: product?.image_urls?.[0] || product?.image_url || null,
          quantity,
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  };

  const topProducts = getTopProducts();

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6">
      <h3 className="text-sm font-semibold mb-4">Top 5 Produits les plus vendus</h3>
      <div className="flex gap-4 overflow-x-auto">
        {topProducts.map((product, index) => (
          <div
            key={product.id}
            className="flex-shrink-0 w-48 p-3 rounded-xl border border-zinc-100 bg-[#F8FAFC] hover:bg-zinc-50 transition"
          >
            {/* Image du produit */}
            <div className="w-full h-32 rounded-xl bg-zinc-200 flex-shrink-0 overflow-hidden mb-3">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-2xl">
                  📦
                </div>
              )}
            </div>

            {/* Nom et quantité */}
            <div className="text-center">
              <p className="text-xs font-medium text-[#111827] truncate">{product.name}</p>
              <p className="text-xs text-[#6B7280] mt-1">{product.quantity} ventes</p>
            </div>

            {/* Classement */}
            <div className="flex items-center justify-center mx-auto mt-2 w-8 h-8 rounded-full bg-[#111827] text-white text-sm font-bold">
              {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

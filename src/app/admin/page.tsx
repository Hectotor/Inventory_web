"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Stock = {
  id: string;
  product_id: string;
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

export default function AdminDashboard() {
  const router = useRouter();
  const [alertProducts, setAlertProducts] = useState<AlertProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      const userData = userSnapshot.data() as { company_id?: string };
      if (!userData.company_id) {
        setAlertProducts([]);
        setIsLoading(false);
        return;
      }

      // Charger les stocks et produits
      const [stocksSnapshot, productsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "stocks"), where("company_id", "==", userData.company_id))),
        getDocs(query(collection(db, "products"), where("company_id", "==", userData.company_id))),
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
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {/* Warning Stock Bas */}
      {!isLoading && alertProducts.length > 0 && (
        <section className="mb-6">
          <div className="rounded-[28px] border-2 border-red-200 bg-red-50/80 p-6 shadow-[0_18px_50px_rgba(239,68,68,0.15)] backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <h2 className="text-lg font-semibold text-red-900">
                  Alertes Stock ({alertProducts.length})
                </h2>
              </div>
              <button
                onClick={() => router.push("/admin/stocks?alert=true")}
                className="text-sm font-medium text-red-700 transition hover:text-red-900"
              >
                Voir les stocks →
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alertProducts.slice(0, 6).map((alert) => (
                <div
                  key={alert.productId}
                  className="rounded-xl border border-red-200 bg-white p-4 shadow-sm"
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

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Commandes en cours", value: "128", icon: "📦" },
          { label: "Livraisons aujourd’hui", value: "42", icon: "🛵" },
          { label: "Agences actives", value: "8", icon: "🧭" },
          { label: "Équipes terrain", value: "24", icon: "🤝" },
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Commandes récentes</h2>
            <button className="text-sm font-medium text-[#6B7280] transition hover:text-[#111827]">
              Voir tout
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {[
              {
                id: "CMD-1082",
                client: "Pharma Nord",
                statut: "En préparation",
                date: "Aujourd'hui · 09:10",
              },
              {
                id: "CMD-1079",
                client: "Boutique Lys",
                statut: "En livraison",
                date: "Hier · 18:42",
              },
              {
                id: "CMD-1073",
                client: "Market Express",
                statut: "Livrée",
                date: "Hier · 14:20",
              },
            ].map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{order.id}</p>
                  <p className="text-xs text-[#6B7280]">{order.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{order.statut}</p>
                  <p className="text-xs text-[#6B7280]">{order.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

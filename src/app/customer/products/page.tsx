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
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  sub_name?: string;
  description?: string;
  price_ht: number;
  tva: number;
  barcode: string;
  is_active: boolean;
  company_id: string;
  image_url?: string; // Pour compatibilité avec les anciens produits
  image_urls?: string[]; // Nouveau : tableau d'images (max 3)
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

type CartItem = {
  product: Product;
  quantity: number;
};

export default function CustomerProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setProducts([]);
        setCompanyId(null);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setProducts([]);
        setCompanyId(null);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string; role?: string };
      if (!userData.company_id || userData.role !== "customer") {
        setProducts([]);
        setCompanyId(null);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      setCompanyId(userData.company_id);
      setCustomerId(currentUser.uid);
      await loadProducts(userData.company_id);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadProducts = async (cid: string) => {
    const productsSnapshot = await getDocs(
      query(
        collection(db, "products"),
        where("company_id", "==", cid),
        where("is_active", "==", true)
      )
    );
    const productsList = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
    setProducts(productsList);
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id);
      if (existingItem) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 2000);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const priceTTC = item.product.price_ht * (1 + item.product.tva / 100);
      // Arrondir le prix unitaire TTC à 2 décimales
      const roundedPriceTTC = Math.round(priceTTC * 100) / 100;
      // Calculer le total pour ce produit et l'arrondir à 2 décimales
      const productTotal = roundedPriceTTC * item.quantity;
      const roundedProductTotal = Math.round(productTotal * 100) / 100;
      return total + roundedProductTotal;
    }, 0);
  };

  const getCartTotalHT = () => {
    return cart.reduce((total, item) => {
      return total + item.product.price_ht * item.quantity;
    }, 0);
  };

  const handlePlaceOrderClick = () => {
    if (!companyId || !customerId || cart.length === 0) return;
    setShowOrderSummary(true);
  };

  const handlePlaceOrder = async () => {
    if (!companyId || !customerId || cart.length === 0) return;

    setShowOrderSummary(false);
    setIsPlacingOrder(true);
    try {
      const orderItems = cart.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        price_ht: item.product.price_ht,
        tva: item.product.tva,
        total_ht: item.product.price_ht * item.quantity,
        total_ttc: item.product.price_ht * (1 + item.product.tva / 100) * item.quantity,
      }));

      const total_ht = cart.reduce(
        (sum, item) => sum + item.product.price_ht * item.quantity,
        0
      );
      const total_ttc = getCartTotal();

      await addDoc(collection(db, "orders"), {
        customer_id: customerId,
        company_id: companyId,
        items: orderItems,
        total_ht,
        total_ttc,
        status: "pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setCart([]);
      setNotification({
        message: "Commande passée avec succès !",
        type: "success",
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Erreur lors de la création de la commande:", error);
      setNotification({
        message: "Erreur lors de la création de la commande",
        type: "error",
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-sm text-[#6B7280]">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cart.length > 0 && (
        <div className="flex items-center justify-end gap-4">
          <div className="text-right">
            <p className="text-xs text-[#6B7280]">Total panier</p>
            <p className="text-lg font-semibold">
              {getCartTotalHT().toFixed(2)} € HT
            </p>
          </div>
          <button
            type="button"
            onClick={handlePlaceOrderClick}
            disabled={isPlacingOrder}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPlacingOrder ? "En cours..." : "Passer la commande"}
          </button>
        </div>
      )}

      {notification && (
        <div
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition-all ${
            notification.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === "success" ? "✓" : "✗"}</span>
            <p>{notification.message}</p>
          </div>
        </div>
      )}

      {/* Modal de récapitulatif */}
      {showOrderSummary && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowOrderSummary(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-[32px] border border-white/60 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-[#111827]">
                  Récapitulatif de la commande
                </h2>
                <button
                  type="button"
                  onClick={() => setShowOrderSummary(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {cart.map((item) => {
                  const priceTTC = item.product.price_ht * (1 + item.product.tva / 100);
                  // Arrondir le prix TTC à 2 décimales
                  const roundedPriceTTC = Math.round(priceTTC * 100) / 100;
                  const totalHT = Math.round(item.product.price_ht * item.quantity * 100) / 100;
                  const totalTTC = Math.round(roundedPriceTTC * item.quantity * 100) / 100;
                  return (
                    <div
                      key={item.product.id}
                      className="flex items-start gap-4 rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
                    >
                      {(() => {
                        const images = item.product.image_urls || (item.product.image_url ? [item.product.image_url] : []);
                        const firstImage = images[0];
                        return firstImage ? (
                          <img
                            src={firstImage}
                            alt={item.product.name}
                            className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-zinc-200 flex items-center justify-center flex-shrink-0">
                            📦
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-[#111827] mb-1">
                          {item.product.name}
                        </p>
                        {item.product.sub_name && (
                          <p className="text-xs text-[#6B7280] mb-2">
                            {item.product.sub_name}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-[#6B7280]">Quantité:</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-[#111827] transition hover:bg-zinc-50"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-[#111827]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-[#111827] transition hover:bg-zinc-50"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[#6B7280]">
                            Prix unitaire: <span className="font-semibold text-[#111827]">{item.product.price_ht.toFixed(2)} € HT</span>
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[#6B7280]">Sous-total HT:</span>
                            <span className="text-sm font-semibold text-[#111827]">
                              {totalHT.toFixed(2)} € HT
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-[#6B7280]">
                              TVA ({item.product.tva}%):
                            </span>
                            <span className="text-sm text-[#6B7280]">
                              {(Math.round((totalTTC - totalHT) * 100) / 100).toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
                            <span className="text-base font-semibold text-[#111827]">
                              Total TTC:
                            </span>
                            <span className="text-base font-semibold text-[#111827]">
                              {totalTTC.toFixed(2)} € TTC
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-zinc-200 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-base text-[#6B7280]">Total HT:</span>
                  <span className="text-base font-semibold text-[#111827]">
                    {(Math.round(getCartTotalHT() * 100) / 100).toFixed(2)} € HT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base text-[#6B7280]">Total TVA:</span>
                  <span className="text-base text-[#6B7280]">
                    {(Math.round((getCartTotal() - getCartTotalHT()) * 100) / 100).toFixed(2)} €
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t-2 border-zinc-300">
                  <span className="text-xl font-semibold text-[#111827]">Total TTC:</span>
                  <span className="text-xl font-semibold text-[#111827]">
                    {(Math.round(getCartTotal() * 100) / 100).toFixed(2)} € TTC
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOrderSummary(false)}
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#111827] transition hover:bg-zinc-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder}
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPlacingOrder ? "En cours..." : "Confirmer la commande"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {cart.length > 0 && (
        <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
          <h2 className="text-lg font-semibold mb-4">Panier ({cart.length})</h2>
          <div className="space-y-3">
            {cart.map((item) => {
              const priceTTC = item.product.price_ht * (1 + item.product.tva / 100);
              return (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {(() => {
                      const images = item.product.image_urls || (item.product.image_url ? [item.product.image_url] : []);
                      const firstImage = images[0];
                      return firstImage ? (
                        <img
                          src={firstImage}
                          alt={item.product.name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ) : null;
                    })()}
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{item.product.name}</p>
                      {item.product.sub_name && (
                        <p className="text-xs text-[#6B7280]">{item.product.sub_name}</p>
                      )}
                      <div className="mt-1">
                        <p className="text-sm font-semibold text-[#111827]">
                          {item.product.price_ht.toFixed(2)} € HT
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {priceTTC.toFixed(2)} € TTC
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-[#111827] transition hover:bg-zinc-50"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-[#111827] transition hover:bg-zinc-50"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="ml-2 text-red-600 hover:text-red-700"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
        <h2 className="text-lg font-semibold mb-6">Catalogue produits</h2>
        {products.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-sm font-medium mb-1">Aucun produit disponible</p>
            <p className="text-xs">Les produits seront bientôt disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const priceTTC = product.price_ht * (1 + product.tva / 100);
              const cartItem = cart.find((item) => item.product.id === product.id);
              return (
                <div
                  key={product.id}
                  className="group relative rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] hover:-translate-y-1"
                >
                  {(() => {
                      const images = product.image_urls || (product.image_url ? [product.image_url] : []);
                      const firstImage = images[0];
                      return firstImage ? (
                        <div className="mb-4 aspect-square overflow-hidden rounded-xl bg-zinc-100">
                          <img
                            src={firstImage}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null;
                    })()}
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-[#111827] mb-1">
                      {product.name}
                    </h3>
                    {product.sub_name && (
                      <p className="text-xs text-[#6B7280] mb-2">{product.sub_name}</p>
                    )}
                    {product.description && (
                      <p className="text-xs text-[#6B7280] line-clamp-2 mb-3">
                        {product.description}
                      </p>
                    )}
                    <div>
                      <p className="text-lg font-semibold text-[#111827]">
                        {product.price_ht.toFixed(2)} € HT
                      </p>
                      <p className="text-xs text-[#6B7280] mt-1">
                        {priceTTC.toFixed(2)} € TTC (TVA {product.tva}%)
                      </p>
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="w-full inline-flex h-10 items-center justify-center rounded-xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      {cartItem ? `Ajouté (${cartItem.quantity})` : "Ajouter au panier"}
                    </button>
                    {addedProductId === product.id && (
                      <p className="mt-2 text-xs text-center text-green-600 font-medium">
                        ✓ Produit ajouté au panier
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

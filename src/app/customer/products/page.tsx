"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

// TVA fixe de 20%
const TVA_RATE = 20;

type Product = {
  id: string;
  name: string;
  sub_name?: string;
  description?: string;
  price_ht: number;
  tva?: number; // Optionnel, TVA fixe de 20% utilisée par défaut
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
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
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
      
      // Charger le panier depuis localStorage
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        try {
          const cartData = JSON.parse(savedCart);
          // Filtrer les éléments invalides
          const validCart = cartData.filter((item: any) => item && item.product && item.product.id);
          setCart(validCart);
          // Sauvegarder le panier nettoyé
          if (validCart.length !== cartData.length) {
            localStorage.setItem("cart", JSON.stringify(validCart));
          }
        } catch (error) {
          console.error("Error loading cart from localStorage:", error);
          localStorage.removeItem("cart");
        }
      }
      
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
      let newCart;
      if (existingItem) {
        newCart = prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newCart = [...prev, { product, quantity: 1 }];
      }
      // Sauvegarder dans localStorage
      localStorage.setItem("cart", JSON.stringify(newCart));
      return newCart;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) => {
      const newCart = prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
      localStorage.setItem("cart", JSON.stringify(newCart));
      return newCart;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const newCart = prev.filter((item) => item.product.id !== productId);
      localStorage.setItem("cart", JSON.stringify(newCart));
      return newCart;
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const TVA_RATE = 20; // TVA fixe de 20%
      const priceTTC = item.product.price_ht * (1 + TVA_RATE / 100);
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

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
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
      // Récupérer la TVA du client depuis son document users
      const customerDoc = await getDoc(doc(db, "users", customerId));
      let customerTva = 20; // TVA par défaut
      if (customerDoc.exists()) {
        const customerData = customerDoc.data();
        if (customerData.non_assujetti_tva === true) {
          customerTva = 0; // Pas de TVA si non assujetti
        } else {
          customerTva = customerData.tva ?? 20; // Utiliser la TVA du client ou 20% par défaut
        }
      }
      
      // Créer une référence de document avec un ID généré
      const orderRef = doc(collection(db, "orders"));
      
      // Créer le document order avec orders_id directement
      await setDoc(orderRef, {
        orders_id: orderRef.id,
        company_id: companyId,
        customer_id: customerId,
        sales_id: null, // nullable
        created_by: customerId,
        status: "PREPARATION",
        created_at: serverTimestamp(),
      });

      // Créer les documents order_items avec order_items_id directement et les prix
      const orderItemsPromises = cart.map(async (item) => {
        const orderItemRef = doc(collection(db, "order_items"));
        const price_ht = item.product.price_ht;
        const tva = customerTva; // Utiliser la TVA du client
        const total_ht = price_ht * item.quantity;
        const total_ttc = price_ht * (1 + tva / 100) * item.quantity;
        
        await setDoc(orderItemRef, {
          order_items_id: orderItemRef.id,
          order_id: orderRef.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price_ht: price_ht,
          tva: tva,
          total_ht: total_ht,
          total_ttc: total_ttc,
        });
      });

      await Promise.all(orderItemsPromises);

      // Vider le panier
      setCart([]);
      localStorage.removeItem("cart");
      
      setShowSuccessModal(true);
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
      {/* Icône panier en haut à droite */}
      {cart.length > 0 && (
        <div className="fixed top-24 right-6 z-40 lg:block hidden">
          <button
            type="button"
            onClick={() => router.push("/customer/cart")}
            className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#111827] text-white shadow-lg hover:bg-black transition-all hover:scale-110"
            aria-label="Voir le panier"
          >
            <span className="text-2xl">🛒</span>
            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {getCartItemCount()}
            </span>
          </button>
        </div>
      )}
      {/* Icône panier mobile */}
      {cart.length > 0 && (
        <div className="fixed top-20 right-4 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => router.push("/customer/cart")}
            className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#111827] text-white shadow-lg hover:bg-black transition-all"
            aria-label="Voir le panier"
          >
            <span className="text-xl">🛒</span>
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {getCartItemCount()}
            </span>
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
                  const TVA_RATE = 20; // TVA fixe de 20%
      const priceTTC = item.product.price_ht * (1 + TVA_RATE / 100);
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
                              TVA (20%):
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

      {/* Modal de succès */}
      {showSuccessModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <span className="text-3xl text-green-600">✓</span>
                </div>
                <h2 className="text-2xl font-semibold text-[#111827] mb-2">
                  Commande confirmée
                </h2>
                <p className="text-base text-[#6B7280] mb-6">
                  Votre commande a bien été passée avec succès
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/customer/orders")}
                  className="w-full inline-flex h-11 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}


      <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
        <h2 className="text-lg font-semibold mb-6">Catalogue produits</h2>
        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un produit..."
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
        </div>
        {products.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-sm font-medium mb-1">Aucun produit disponible</p>
            <p className="text-xs">Les produits seront bientôt disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products
              .filter((product) => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                return (
                  product.name.toLowerCase().includes(query) ||
                  product.sub_name?.toLowerCase().includes(query) ||
                  product.barcode.toLowerCase().includes(query) ||
                  product.description?.toLowerCase().includes(query)
                );
              })
              .map((product) => {
              const priceTTC = product.price_ht * (1 + TVA_RATE / 100);
              const cartItem = cart.find((item) => item?.product?.id === product.id);
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
                        {priceTTC.toFixed(2)} € TTC (TVA 20%)
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

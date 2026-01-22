"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
  image_url?: string;
  image_urls?: string[];
};

type CartItem = {
  product: Product;
  quantity: number;
};

export default function CustomerCart() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setCart([]);
        setCompanyId(null);
        setCustomerId(null);
        setIsLoading(false);
        router.push("/connexion");
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setCart([]);
        setCompanyId(null);
        setCustomerId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string; role?: string };
      if (!userData.company_id || userData.role !== "customer") {
        setCart([]);
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
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

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
      const roundedPriceTTC = Math.round(priceTTC * 100) / 100;
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

  const handlePlaceOrder = async () => {
    if (!companyId || !customerId || cart.length === 0) return;

    setIsPlacingOrder(true);
    try {
      const { collection, serverTimestamp, doc: firestoreDoc, setDoc: firestoreSetDoc, getDoc } = await import("firebase/firestore");
      
      // Récupérer la TVA du client depuis son document users
      const customerDoc = await getDoc(firestoreDoc(db, "users", customerId));
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
      const orderRef = firestoreDoc(collection(db, "orders"));
      
      // Créer le document order avec orders_id directement
      await firestoreSetDoc(orderRef, {
        orders_id: orderRef.id,
        company_id: companyId,
        customer_id: customerId,
        sales_id: null,
        created_by: customerId,
        status: "PREPARATION",
        created_at: serverTimestamp(),
      });

      // Créer les documents order_items avec order_items_id directement et les prix
      const orderItemsPromises = cart.map(async (item) => {
        const orderItemRef = firestoreDoc(collection(db, "order_items"));
        const price_ht = item.product.price_ht;
        const tva = customerTva; // Utiliser la TVA du client
        const total_ht = Math.round((price_ht * item.quantity) * 100) / 100; // Arrondi à 2 décimales
        const total_ttc = Math.round((price_ht * (1 + tva / 100) * item.quantity) * 100) / 100; // Arrondi à 2 décimales
        
        await firestoreSetDoc(orderItemRef, {
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
      
      // Rediriger vers la page des commandes
      router.push("/customer/orders");
    } catch (error) {
      console.error("Erreur lors de la création de la commande:", error);
      setIsPlacingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-sm text-[#6B7280]">Chargement du panier...</p>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 text-[#6B7280]">
          <div className="text-4xl mb-4">🛒</div>
          <p className="text-sm font-medium mb-1">Votre panier est vide</p>
          <p className="text-xs mb-4">Ajoutez des produits pour commencer</p>
          <button
            type="button"
            onClick={() => router.push("/customer/products")}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
          >
            Voir les produits
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
            Panier
          </p>
          <h1 className="text-2xl font-semibold mt-1">
            Panier ({getCartItemCount()})
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#6B7280]">Total panier</p>
          <p className="text-lg font-semibold">
            {getCartTotalHT().toFixed(2)} € HT
          </p>
        </div>
      </div>


      <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="space-y-3">
          {cart.map((item) => {
            const TVA_RATE = 20; // TVA fixe de 20%
      const priceTTC = item.product.price_ht * (1 + TVA_RATE / 100);
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
        <div className="mt-6 pt-6 border-t border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold">Total HT</span>
            <span className="text-lg font-semibold">
              {(Math.round(getCartTotalHT() * 100) / 100).toFixed(2)} € HT
            </span>
          </div>
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-[#6B7280]">Total TTC</span>
            <span className="text-sm text-[#6B7280]">
              {(Math.round(getCartTotal() * 100) / 100).toFixed(2)} € TTC
            </span>
          </div>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="w-full inline-flex h-11 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPlacingOrder ? "En cours..." : "Passer la commande"}
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { auth, db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { ChangeEvent } from "react";

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
  image_url?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
    productId: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sub_name: "",
    description: "",
    price_ht: "",
    tva: "",
    barcode: "",
    is_active: true,
    image_url: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setProducts([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setProducts([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string };
      if (!userData.company_id) {
        setProducts([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      setCompanyId(userData.company_id);
      await loadProducts(userData.company_id);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadProducts = async (cid: string) => {
    const productsSnapshot = await getDocs(
      query(collection(db, "products"), where("company_id", "==", cid)),
    );
    const productsList = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
    setProducts(productsList);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setIsSaving(true);
    try {
      const productData: {
        name: string;
        sub_name?: string;
        description?: string;
        price_ht: number;
        tva: number;
        barcode: string;
        is_active: boolean;
        company_id: string;
        image_url?: string;
      } = {
        name: formData.name.trim(),
        price_ht: parseFloat(formData.price_ht) || 0,
        tva: parseFloat(formData.tva) || 0,
        barcode: formData.barcode.trim(),
        is_active: formData.is_active,
        company_id: companyId,
      };

      if (formData.sub_name.trim()) {
        productData.sub_name = formData.sub_name.trim();
      }

      if (formData.description.trim()) {
        productData.description = formData.description.trim();
      }

      if (formData.image_url) {
        productData.image_url = formData.image_url;
      }

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), {
          ...productData,
          updated_at: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      await loadProducts(companyId);
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sub_name: product.sub_name || "",
      description: product.description || "",
      price_ht: product.price_ht.toString(),
      tva: product.tva.toString(),
      barcode: product.barcode || "",
      is_active: product.is_active,
      image_url: product.image_url || "",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    try {
      await deleteDoc(doc(db, "products", productId));
      if (companyId) {
        await loadProducts(companyId);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const newStatus = !product.is_active;
      await updateDoc(doc(db, "products", product.id), {
        is_active: newStatus,
        updated_at: serverTimestamp(),
      });
      if (companyId) {
        await loadProducts(companyId);
      }
      
      // Afficher le message de notification
      setNotification({
        message: newStatus
          ? `"${product.name}" a été activé`
          : `"${product.name}" a été désactivé`,
        type: "success",
        productId: product.id,
      });

      // Masquer le message après 3 secondes
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error updating product:", error);
      setNotification({
        message: "Erreur lors de la modification du statut",
        type: "error",
        productId: product.id,
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) {
      return;
    }

    setIsUploadingImage(true);
    try {
      const imageRef = ref(
        storage,
        `companies/${companyId}/products/${Date.now()}_${file.name}`,
      );
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);
      setFormData((prev) => ({ ...prev, image_url: imageUrl }));
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sub_name: "",
      description: "",
      price_ht: "",
      tva: "",
      barcode: "",
      is_active: true,
      image_url: "",
    });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="space-y-4 w-full max-w-md">
          <div className="h-8 w-48 rounded-full bg-slate-200/80 animate-pulse" />
          <div className="h-64 rounded-[32px] bg-slate-200/80 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAddForm && (
        <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">
              {editingProduct ? "Modifier le produit" : "Nouveau produit"}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-[#6B7280] hover:text-[#111827]"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Nom
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Sous nom
              </label>
              <input
                type="text"
                value={formData.sub_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sub_name: e.target.value,
                  }))
                }
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              />
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-gradient-to-r from-[#F8FAFC] to-white px-4 py-3">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt="Image produit"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[#6B7280]">
                    IMAGE
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#111827]">
                  Image du produit
                </p>
                <p className="text-xs text-[#6B7280]">
                  PNG ou JPG · 5MB max recommandé
                </p>
              </div>
              <label
                htmlFor="productImage"
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-[#111827] transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUploadingImage ? "Upload..." : "Ajouter"}
              </label>
              <input
                id="productImage"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isLoading || isUploadingImage}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Prix HT (EUR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_ht}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      price_ht: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  TVA (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tva}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tva: e.target.value }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={4}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 resize-none"
                placeholder="Description du produit..."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Code-barres
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    barcode: e.target.value,
                  }))
                }
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-zinc-300 text-[#111827] focus:ring-2 focus:ring-zinc-100"
              />
              <label
                htmlFor="is_active"
                className="text-sm text-[#6B7280] cursor-pointer"
              >
                Produit actif
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving
                  ? "Enregistrement..."
                  : editingProduct
                    ? "Modifier"
                    : "Ajouter"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#111827] transition hover:bg-zinc-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
              Gestion des produits
            </p>
            <h1 className="text-2xl font-semibold mt-1">Produits</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              {products.length} {products.length === 1 ? "produit" : "produits"}
            </span>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              + Ajouter un produit
            </button>
          </div>
        </div>
        {products.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-sm font-medium mb-1">Aucun produit pour le moment</p>
            <p className="text-xs">
              Cliquez sur &quot;Ajouter un produit&quot; pour commencer
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const priceTTC =
                product.price_ht * (1 + product.tva / 100);
              return (
                <div
                  key={product.id}
                  className="group relative rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] hover:-translate-y-1"
                >
                  {/* Image */}
                  <div className="mb-4">
                    {product.image_url ? (
                      <div className="h-40 w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="h-40 w-full rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center">
                        <span className="text-4xl text-zinc-300">📦</span>
                      </div>
                    )}
                  </div>

                  {/* Header */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base font-semibold text-[#111827] line-clamp-1">
                        {product.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                          product.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {product.is_active ? "✓" : "✗"}
                      </span>
                    </div>
                    {product.sub_name && (
                      <p className="text-xs text-[#6B7280] line-clamp-1">
                        {product.sub_name}
                      </p>
                    )}
                    {product.description && (
                      <p className="text-xs text-[#6B7280] line-clamp-2 mt-1.5">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Prix */}
                  <div className="mb-4 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#6B7280]">Prix HT</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {product.price_ht.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#6B7280]">TVA ({product.tva}%)</span>
                      <span className="text-xs text-[#6B7280]">
                        +{(priceTTC - product.price_ht).toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1.5 border-t border-zinc-100">
                      <span className="text-xs font-medium text-[#111827]">Prix TTC</span>
                      <span className="text-base font-semibold text-[#111827]">
                        {priceTTC.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* Infos supplémentaires */}
                  {(product.barcode || product.created_at) && (
                    <div className="mb-4 space-y-1.5 text-xs text-[#6B7280]">
                      {product.barcode && (
                        <div className="flex items-center gap-1.5">
                          <span>🏷️</span>
                          <span className="truncate">{product.barcode}</span>
                        </div>
                      )}
                      {product.created_at && (
                        <div className="flex items-center gap-1.5">
                          <span>📅</span>
                          <span>{formatDate(product.created_at)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-3 border-t border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        className="flex-1 inline-flex h-9 items-center justify-center rounded-xl bg-[#111827] px-3 text-xs font-semibold text-white transition hover:bg-black"
                        title="Modifier"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(product)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                          product.is_active
                            ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                            : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                        title={product.is_active ? "Désactiver" : "Activer"}
                      >
                        {product.is_active ? "⏸" : "▶"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                    {/* Notification pour ce produit */}
                    {notification && notification.productId === product.id && (
                      <div
                        className={`rounded-xl border px-3 py-2 text-xs animate-[slideIn_0.3s_ease-out] ${
                          notification.type === "success"
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                        style={{ animation: "slideIn 0.3s ease-out" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>
                            {notification.type === "success" ? "✓" : "✗"}
                          </span>
                          <span className="font-medium">
                            {notification.message}
                          </span>
                        </div>
                      </div>
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

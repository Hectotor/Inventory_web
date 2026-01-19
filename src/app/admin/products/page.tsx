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
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  price_ht: number;
  tva: number;
  Barcode: string;
  is_active: boolean;
  company_id: string;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price_ht: "",
    tva: "",
    Barcode: "",
    is_active: true,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setIsSaving(true);
    try {
      const productData = {
        name: formData.name.trim(),
        price_ht: parseFloat(formData.price_ht) || 0,
        tva: parseFloat(formData.tva) || 0,
        Barcode: formData.Barcode.trim(),
        is_active: formData.is_active,
        company_id: companyId,
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), productData);
      } else {
        await addDoc(collection(db, "products"), productData);
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
      price_ht: product.price_ht.toString(),
      tva: product.tva.toString(),
      Barcode: product.Barcode,
      is_active: product.is_active,
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
      await updateDoc(doc(db, "products", product.id), {
        is_active: !product.is_active,
      });
      if (companyId) {
        await loadProducts(companyId);
      }
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price_ht: "",
      tva: "",
      Barcode: "",
      is_active: true,
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
            Gestion des produits
          </p>
          <h1 className="text-2xl font-semibold mt-1">Produits</h1>
        </div>
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
                Code-barres
              </label>
              <input
                type="text"
                value={formData.Barcode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    Barcode: e.target.value,
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
        <h2 className="text-lg font-semibold mb-6">Liste des produits</h2>
        {products.length === 0 ? (
          <div className="text-center py-12 text-[#6B7280]">
            <p className="text-sm">Aucun produit pour le moment</p>
            <p className="text-xs mt-2">
              Cliquez sur &quot;Ajouter un produit&quot; pour commencer
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const priceTTC =
                product.price_ht * (1 + product.tva / 100);
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4 hover:bg-white transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-[#111827]">
                        {product.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {product.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-[#6B7280] sm:grid-cols-4">
                      <div>
                        <span className="font-medium">Prix HT:</span>{" "}
                        {product.price_ht.toFixed(2)} €
                      </div>
                      <div>
                        <span className="font-medium">TVA:</span>{" "}
                        {product.tva}%
                      </div>
                      <div>
                        <span className="font-medium">Prix TTC:</span>{" "}
                        {priceTTC.toFixed(2)} €
                      </div>
                      {product.Barcode && (
                        <div>
                          <span className="font-medium">Code-barres:</span>{" "}
                          {product.Barcode}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(product)}
                      className="inline-flex h-8 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-[#111827] transition hover:bg-zinc-50"
                    >
                      {product.is_active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                      className="inline-flex h-8 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-[#111827] transition hover:bg-zinc-50"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      className="inline-flex h-8 items-center justify-center rounded-xl border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Supprimer
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

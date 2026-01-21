"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

import { auth, db } from "@/lib/firebase";

type Stock = {
  id: string;
  agencies_id: string;
  product_id: string;
  location_type: "ENTREPOT" | "CAMION";
  location_id: string;
  quantity: number;
  company_id: string;
  alert_threshold?: number;
  updated_at?: Timestamp;
};

type Product = {
  id: string;
  name: string;
  sub_name?: string;
  image_url?: string;
};

type Agency = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string;
  agencies_id: string;
};

type User = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
};

type StocksPageProps = {
  canManageAllAgencies?: boolean;
  currentUserAgencyId?: string | null;
};

export function StocksPage({ 
  canManageAllAgencies = false,
  currentUserAgencyId = null 
}: StocksPageProps) {
  const searchParams = useSearchParams();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
    stockId: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    agencies_id: currentUserAgencyId || "",
    product_id: "",
    location_type: "ENTREPOT" as "ENTREPOT" | "CAMION",
    location_id: "",
    quantity: "",
    alert_threshold: "",
  });
  const [filters, setFilters] = useState({
    agency: "all",
    product: "all",
    locationType: "all",
    showAlertOnly: searchParams?.get("alert") === "true",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setStocks([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setStocks([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string; agencies_id?: string };
      if (!userData.company_id) {
        setStocks([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      setCompanyId(userData.company_id);
      
      // Si le zone manager a une agence, définir automatiquement l'agence dans le formulaire
      const agencyId = currentUserAgencyId || userData.agencies_id || null;
      if (agencyId && !canManageAllAgencies) {
        setFormData((prev) => ({
          ...prev,
          agencies_id: agencyId,
        }));
      }

      await Promise.all([
        loadStocks(userData.company_id, agencyId),
        loadProducts(userData.company_id),
        loadAgencies(userData.company_id),
        loadWarehouses(userData.company_id),
        loadUsers(userData.company_id),
      ]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [canManageAllAgencies, currentUserAgencyId]);

  const loadStocks = async (cid: string, agencyId: string | null) => {
    const stocksSnapshot = await getDocs(
      query(collection(db, "stocks"), where("company_id", "==", cid))
    );
    const allStocks = stocksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Stock[];
    
    // Si admin, montrer tous les stocks
    if (canManageAllAgencies) {
      setStocks(allStocks);
      return;
    }
    
    // Si zone manager, filtrer : stocks de son agence OU entrepôts des autres agences
    if (agencyId) {
      const filteredStocks = allStocks.filter((stock) => {
        // Si le stock est de son agence, on le montre
        if (stock.agencies_id === agencyId) return true;
        // Si c'est un entrepôt d'une autre agence, on le montre aussi
        if (stock.location_type === "ENTREPOT" && stock.agencies_id !== agencyId) return true;
        // Sinon, on ne le montre pas
        return false;
      });
      setStocks(filteredStocks);
    } else {
      // Si pas d'agence assignée, montrer tous les entrepôts
      setStocks(allStocks.filter((stock) => stock.location_type === "ENTREPOT"));
    }
  };

  const loadProducts = async (cid: string) => {
    const productsSnapshot = await getDocs(
      query(collection(db, "products"), where("company_id", "==", cid))
    );
    const productsList = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "",
      sub_name: doc.data().sub_name || "",
      image_url: doc.data().image_urls?.[0] || doc.data().image_url,
    })) as Product[];
    setProducts(productsList);
  };

  const loadAgencies = async (cid: string) => {
    const agenciesSnapshot = await getDocs(
      query(collection(db, "agencies"), where("company_id", "==", cid))
    );
    const agenciesList = agenciesSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "",
    })) as Agency[];
    setAgencies(agenciesList);
  };

  const loadWarehouses = async (cid: string) => {
    const warehousesSnapshot = await getDocs(
      query(collection(db, "warehouses"), where("company_id", "==", cid))
    );
    const warehousesList = warehousesSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "",
      agencies_id: doc.data().agencies_id || "",
    })) as Warehouse[];
    setWarehouses(warehousesList);
  };

  const loadUsers = async (cid: string) => {
    const usersSnapshot = await getDocs(
      query(collection(db, "users"), where("company_id", "==", cid))
    );
    const usersList = usersSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        first_name: doc.data().first_name || "",
        last_name: doc.data().last_name || "",
        role: doc.data().role || "",
      }))
      .filter((user) => user.role === "sales") as User[];
    setUsers(usersList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    // Validation pour zone manager
    if (!canManageAllAgencies && currentUserAgencyId) {
      if (formData.agencies_id !== currentUserAgencyId) {
        setNotification({
          message: "Vous ne pouvez gérer que les stocks de votre agence",
          type: "error",
          stockId: editingStock?.id || "",
        });
        setTimeout(() => {
          setNotification(null);
        }, 3000);
        return;
      }
    }

    setIsSaving(true);
    try {
      const stockData: {
        agencies_id: string;
        product_id: string;
        location_type: "ENTREPOT" | "CAMION";
        location_id: string;
        quantity: number;
        company_id: string;
        alert_threshold?: number | null;
      } = {
        agencies_id: formData.agencies_id,
        product_id: formData.product_id,
        location_type: formData.location_type,
        location_id: formData.location_id,
        quantity: parseFloat(formData.quantity) || 0,
        company_id: companyId,
      };

      // Ajouter le seuil d'alerte au stock si défini
      if (formData.alert_threshold && !isNaN(parseFloat(formData.alert_threshold))) {
        stockData.alert_threshold = parseFloat(formData.alert_threshold);
      } else {
        stockData.alert_threshold = null;
      }

      if (editingStock) {
        await updateDoc(doc(db, "stocks", editingStock.id), {
          ...stockData,
          updated_at: serverTimestamp(),
        });
        setNotification({
          message: "Stock modifié avec succès",
          type: "success",
          stockId: editingStock.id,
        });
      } else {
        const docRef = await addDoc(collection(db, "stocks"), {
          ...stockData,
          updated_at: serverTimestamp(),
        });
        setNotification({
          message: "Stock ajouté avec succès",
          type: "success",
          stockId: docRef.id,
        });
      }

      const agencyId = currentUserAgencyId || null;
      await loadStocks(companyId, agencyId);
      resetForm();

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving stock:", error);
      setNotification({
        message: "Erreur lors de l'enregistrement",
        type: "error",
        stockId: editingStock?.id || "",
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (stock: Stock) => {
    // Validation pour zone manager
    if (!canManageAllAgencies && currentUserAgencyId) {
      if (stock.agencies_id !== currentUserAgencyId) {
        setNotification({
          message: "Vous ne pouvez modifier que les stocks de votre agence",
          type: "error",
          stockId: stock.id,
        });
        setTimeout(() => {
          setNotification(null);
        }, 3000);
        return;
      }
    }

    setEditingStock(stock);
    setFormData({
      agencies_id: stock.agencies_id,
      product_id: stock.product_id,
      location_type: stock.location_type,
      location_id: stock.location_id,
      quantity: stock.quantity.toString(),
      alert_threshold: stock.alert_threshold?.toString() || "",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (stockId: string, stockAgencyId: string) => {
    // Validation pour zone manager
    if (!canManageAllAgencies && currentUserAgencyId) {
      if (stockAgencyId !== currentUserAgencyId) {
        setNotification({
          message: "Vous ne pouvez supprimer que les stocks de votre agence",
          type: "error",
          stockId: stockId,
        });
        setTimeout(() => {
          setNotification(null);
        }, 3000);
        return;
      }
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce stock ?")) return;

    try {
      await deleteDoc(doc(db, "stocks", stockId));
      if (companyId) {
        const agencyId = currentUserAgencyId || null;
        await loadStocks(companyId, agencyId);
      }
    } catch (error) {
      console.error("Error deleting stock:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      agencies_id: currentUserAgencyId || "",
      product_id: "",
      location_type: "ENTREPOT",
      location_id: "",
      quantity: "",
      alert_threshold: "",
    });
    setEditingStock(null);
    setShowAddForm(false);
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? `${product.name}${product.sub_name ? ` - ${product.sub_name}` : ""}` : "—";
  };

  const getProductImage = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.image_url || null;
  };

  const getAgencyName = (agencyId: string) => {
    return agencies.find((a) => a.id === agencyId)?.name || "—";
  };

  const getLocationName = (stock: Stock) => {
    if (stock.location_type === "ENTREPOT") {
      const warehouse = warehouses.find((w) => w.id === stock.location_id);
      return warehouse ? warehouse.name : "—";
    } else {
      const user = users.find((u) => u.id === stock.location_id);
      return user ? `${user.first_name} ${user.last_name}` : "—";
    }
  };

  // Calculer le stock total par produit
  const getTotalStockForProduct = (productId: string) => {
    return stocks
      .filter((stock) => stock.product_id === productId)
      .reduce((total, stock) => total + stock.quantity, 0);
  };

  // Vérifier si le stock est en alerte
  const isStockAlert = (stock: Stock) => {
    if (!stock.alert_threshold) return false;
    const totalStock = getTotalStockForProduct(stock.product_id);
    return totalStock <= stock.alert_threshold;
  };

  // Compter les produits uniques en alerte
  const getAlertProductsCount = () => {
    const alertProductIds = new Set<string>();
    stocks.forEach((stock) => {
      if (isStockAlert(stock)) {
        alertProductIds.add(stock.product_id);
      }
    });
    return alertProductIds.size;
  };

  const filteredStocks = stocks.filter((stock) => {
    if (filters.agency !== "all" && stock.agencies_id !== filters.agency) return false;
    if (filters.product !== "all" && stock.product_id !== filters.product) return false;
    if (filters.locationType !== "all" && stock.location_type !== filters.locationType) return false;
    if (filters.showAlertOnly && !isStockAlert(stock)) return false;
    return true;
  });

  const availableWarehouses = formData.agencies_id
    ? warehouses.filter((w) => w.agencies_id === formData.agencies_id)
    : [];

  // Agences disponibles dans le formulaire (pour zone manager, seulement son agence)
  const availableAgencies = canManageAllAgencies
    ? agencies
    : agencies.filter((a) => !currentUserAgencyId || a.id === currentUserAgencyId);

  // Filtrer les produits en fonction de l'agence, type de localisation et entrepôt/commercial
  const getFilteredProducts = () => {
    // Si tous les critères sont remplis (agence, type, location), filtrer par stocks existants
    if (formData.agencies_id && formData.location_type && formData.location_id) {
      // Trouver les produits qui ont déjà des stocks à cet endroit
      const productIdsWithStock = new Set<string>();
      stocks.forEach((stock) => {
        if (
          stock.agencies_id === formData.agencies_id &&
          stock.location_type === formData.location_type &&
          stock.location_id === formData.location_id
        ) {
          productIdsWithStock.add(stock.product_id);
        }
      });
      
      // Retourner les produits avec stock en premier, puis les autres
      const productsWithStock = products.filter((product) => productIdsWithStock.has(product.id));
      const productsWithoutStock = products.filter((product) => !productIdsWithStock.has(product.id));
      
      return [...productsWithStock, ...productsWithoutStock];
    }
    
    // Sinon, retourner tous les produits
    return products;
  };

  const filteredProducts = getFilteredProducts();
  
  // Vérifier si un produit a déjà un stock à cet endroit
  const hasStockAtLocation = (productId: string) => {
    if (!formData.agencies_id || !formData.location_type || !formData.location_id) return false;
    return stocks.some(
      (stock) =>
        stock.product_id === productId &&
        stock.agencies_id === formData.agencies_id &&
        stock.location_type === formData.location_type &&
        stock.location_id === formData.location_id
    );
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
              {editingStock ? "Modifier le stock" : "Nouveau stock"}
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
                Agence *
              </label>
              <select
                value={formData.agencies_id}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    agencies_id: e.target.value,
                    location_id: "",
                  }));
                }}
                required
                disabled={!!currentUserAgencyId && !canManageAllAgencies}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed"
              >
                <option value="">Sélectionner une agence</option>
                {availableAgencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
              {currentUserAgencyId && !canManageAllAgencies && (
                <p className="text-xs text-[#6B7280]">
                  Vous ne pouvez gérer que les stocks de votre agence
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Type de localisation *
              </label>
              <select
                value={formData.location_type}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    location_type: e.target.value as "ENTREPOT" | "CAMION",
                    location_id: "",
                  }));
                }}
                required
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              >
                <option value="ENTREPOT">Entrepôt</option>
                <option value="CAMION">Camion (Commercial)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                {formData.location_type === "ENTREPOT" ? "Entrepôt *" : "Commercial *"}
              </label>
              {formData.location_type === "ENTREPOT" ? (
                <select
                  value={formData.location_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location_id: e.target.value,
                    }))
                  }
                  required
                  disabled={!formData.agencies_id}
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {formData.agencies_id
                      ? "Sélectionner un entrepôt"
                      : "Sélectionnez d'abord une agence"}
                  </option>
                  {availableWarehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={formData.location_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location_id: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="">Sélectionner un commercial</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Produit *
              </label>
              <select
                value={formData.product_id}
                onChange={(e) => {
                  // Si on modifie un stock existant, garder le seuil d'alerte du stock
                  if (editingStock && e.target.value === editingStock.product_id) {
                    setFormData((prev) => ({
                      ...prev,
                      product_id: e.target.value,
                      alert_threshold: editingStock.alert_threshold?.toString() || "",
                    }));
                  } else {
                    // Sinon, vérifier s'il existe déjà un stock pour ce produit à cet endroit
                    const existingStock = stocks.find(
                      (s) =>
                        s.product_id === e.target.value &&
                        s.agencies_id === formData.agencies_id &&
                        s.location_type === formData.location_type &&
                        s.location_id === formData.location_id
                    );
                    setFormData((prev) => ({
                      ...prev,
                      product_id: e.target.value,
                      alert_threshold: existingStock?.alert_threshold?.toString() || "",
                    }));
                  }
                }}
                required
                disabled={!formData.agencies_id || !formData.location_type || !formData.location_id}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!formData.agencies_id || !formData.location_type || !formData.location_id
                    ? "Sélectionnez d'abord l'agence, le type et la localisation"
                    : "Sélectionner un produit"}
                </option>
                {formData.agencies_id && formData.location_type && formData.location_id ? (
                  <>
                    {filteredProducts.filter((p) => hasStockAtLocation(p.id)).length > 0 && (
                      <optgroup label="Produits avec stock à cet endroit">
                        {filteredProducts
                          .filter((p) => hasStockAtLocation(p.id))
                          .map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.sub_name ? ` - ${product.sub_name}` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {filteredProducts.filter((p) => !hasStockAtLocation(p.id)).length > 0 && (
                      <optgroup label="Autres produits">
                        {filteredProducts
                          .filter((p) => !hasStockAtLocation(p.id))
                          .map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.sub_name ? ` - ${product.sub_name}` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.sub_name ? ` - ${product.sub_name}` : ""}
                    </option>
                  ))
                )}
              </select>
              {formData.agencies_id && formData.location_type && formData.location_id && (
                <p className="text-xs text-[#6B7280]">
                  {filteredProducts.filter((p) => hasStockAtLocation(p.id)).length > 0
                    ? `${filteredProducts.filter((p) => hasStockAtLocation(p.id)).length} produit${filteredProducts.filter((p) => hasStockAtLocation(p.id)).length > 1 ? "s" : ""} avec stock à cet endroit`
                    : "Aucun produit n'a encore de stock à cet endroit"}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Quantité *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
                required
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                placeholder="0"
              />
            </div>
            {formData.product_id && (
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Seuil d'alerte
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.alert_threshold}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      alert_threshold: e.target.value,
                    }))
                  }
                  placeholder="Ex: 10"
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
                    <p className="text-xs text-[#6B7280]">
                      Une alerte s'affichera pour ce stock si la quantité totale du produit est inférieure ou égale à ce seuil
                    </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving
                  ? "Enregistrement..."
                  : editingStock
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
              Gestion des stocks
            </p>
            <h1 className="text-2xl font-semibold mt-1">Stocks</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              {filteredStocks.length} / {stocks.length}{" "}
              {stocks.length === 1 ? "stock" : "stocks"}
            </span>
            {(canManageAllAgencies || currentUserAgencyId) && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
              >
                + Ajouter un stock
              </button>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Agence
            </label>
            <select
              value={filters.agency}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, agency: e.target.value }))
              }
              disabled={!canManageAllAgencies && !!currentUserAgencyId}
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              <option value="all">Toutes les agences</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Produit
            </label>
            <select
              value={filters.product}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, product: e.target.value }))
              }
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
            >
              <option value="all">Tous les produits</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Type
            </label>
            <select
              value={filters.locationType}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, locationType: e.target.value }))
              }
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
            >
              <option value="all">Tous les types</option>
              <option value="ENTREPOT">Entrepôt</option>
              <option value="CAMION">Camion</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, showAlertOnly: !prev.showAlertOnly }))
              }
              className={`w-full h-10 rounded-xl border flex items-center justify-center gap-2 px-3 text-sm font-medium transition ${
                filters.showAlertOnly
                  ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-zinc-200 bg-white text-[#111827] hover:bg-zinc-50"
              }`}
              title="Afficher uniquement les stocks en alerte"
            >
              <span>⚠️</span>
              <span>Alerte stock</span>
              {getAlertProductsCount() > 0 && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  filters.showAlertOnly
                    ? "bg-red-200 text-red-800"
                    : "bg-red-100 text-red-700"
                }`}>
                  {getAlertProductsCount()}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilters({
                  agency: "all",
                  product: "all",
                  locationType: "all",
                  showAlertOnly: false,
                });
              }}
              className="h-10 w-10 rounded-xl border border-zinc-200 bg-white flex items-center justify-center text-[#111827] transition hover:bg-zinc-50"
              title="Réinitialiser les filtres"
            >
              ↺
            </button>
          </div>
        </div>

        {filteredStocks.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-sm font-medium mb-1">
              {stocks.length === 0
                ? "Aucun stock pour le moment"
                : "Aucun stock ne correspond aux filtres"}
            </p>
            <p className="text-xs">
              {stocks.length === 0
                ? 'Cliquez sur "Ajouter un stock" pour commencer'
                : "Essayez de modifier les filtres"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStocks.map((stock) => {
              const canEdit = canManageAllAgencies || stock.agencies_id === currentUserAgencyId;
              const product = products.find((p) => p.id === stock.product_id);
              const totalStock = getTotalStockForProduct(stock.product_id);
              const isAlert = isStockAlert(stock);
              return (
                <div
                  key={stock.id}
                  className="group relative rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] hover:-translate-y-1"
                >
                  {/* Image */}
                  <div className="mb-4">
                    {getProductImage(stock.product_id) ? (
                      <div className="h-40 w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100">
                        <img
                          src={getProductImage(stock.product_id)!}
                          alt={getProductName(stock.product_id)}
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
                        {getProductName(stock.product_id)}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                          stock.location_type === "ENTREPOT"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {stock.location_type === "ENTREPOT" ? "🏭" : "🚚"}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] line-clamp-1">
                      {getAgencyName(stock.agencies_id)}
                      {!canManageAllAgencies && stock.agencies_id !== currentUserAgencyId && (
                        <span className="ml-2 text-orange-600">(Autre agence)</span>
                      )}
                    </p>
                  </div>

                  {/* Stock Info */}
                  <div className="mb-4 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#6B7280]">Quantité locale</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {stock.quantity}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#6B7280]">Stock total</span>
                      <span className={`text-sm font-semibold ${
                        isAlert ? "text-red-600" : "text-[#111827]"
                      }`}>
                        {totalStock}
                      </span>
                    </div>
                    {stock.alert_threshold && (
                      <div className="flex items-baseline justify-between pt-1.5 border-t border-zinc-100">
                        <span className="text-xs font-medium text-[#111827]">Seuil d'alerte</span>
                        <span className={`text-base font-semibold ${
                          isAlert ? "text-red-600" : "text-[#111827]"
                        }`}>
                          {stock.alert_threshold}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Infos supplémentaires */}
                  <div className="mb-4 space-y-1.5 text-xs text-[#6B7280]">
                    <div className="flex items-center gap-1.5">
                      <span>
                        {stock.location_type === "ENTREPOT" ? "🏭" : "🚚"}
                      </span>
                      <span className="truncate">{getLocationName(stock)}</span>
                    </div>
                    {stock.updated_at && (
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>
                          {new Intl.DateTimeFormat("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(stock.updated_at.toDate())}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Alerte */}
                  {isAlert && (
                    <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-700 mb-0.5">
                            ALERTE STOCK FAIBLE
                          </p>
                          <p className="text-xs text-red-600">
                            Stock total: <span className="font-semibold">{totalStock}</span> / Seuil: <span className="font-semibold">{stock.alert_threshold}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {canEdit && (
                    <div className="pt-3 border-t border-zinc-100">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(stock)}
                          className="flex-1 inline-flex h-9 items-center justify-center rounded-xl bg-[#111827] px-3 text-xs font-semibold text-white transition hover:bg-black"
                          title="Modifier"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(stock.id, stock.agencies_id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                      {/* Notification pour ce stock */}
                      {notification && notification.stockId === stock.id && (
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
                            <span className="font-medium">{notification.message}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {!canEdit && (
                    <div className="pt-3 border-t border-zinc-100">
                      <p className="text-xs text-[#6B7280] italic text-center">
                        Lecture seule (autre agence)
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

type Client = {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  agencies_id?: string;
  company_id: string;
  is_active: boolean;
  company_name?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  tva?: number; // TVA applicable au client (en %)
  non_assujetti_tva?: boolean; // Non assujetti à la TVA
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

type Agency = {
  id: string;
  name: string;
};

type ClientsPageProps = {
  filterByAgency?: boolean; // Si true, filtre automatiquement par l'agence de l'utilisateur
};

export function ClientsPage({ filterByAgency = false }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userAgencyId, setUserAgencyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
    clientId: string;
  } | null>(null);
  
  // Filtres
  const [filterAgency, setFilterAgency] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [formData, setFormData] = useState({
    agencies_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    is_active: true,
    company_name: "",
    street_address: "",
    postal_code: "",
    city: "",
    country: "",
    tva: "20", // TVA par défaut à 20%
    non_assujetti_tva: false, // Non assujetti à la TVA
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setClients([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setClients([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string; agencies_id?: string };
      if (!userData.company_id) {
        setClients([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      setCompanyId(userData.company_id);
      setUserAgencyId(userData.agencies_id || null);
      
      // Si filterByAgency est true, utiliser l'agence de l'utilisateur par défaut
      if (filterByAgency && userData.agencies_id) {
        setFilterAgency(userData.agencies_id);
      }
      
      await Promise.all([
        loadClients(userData.company_id),
        loadAgencies(userData.company_id),
      ]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [filterByAgency]);

  const loadClients = async (cid: string) => {
    const clientsSnapshot = await getDocs(
      query(
        collection(db, "users"),
        where("company_id", "==", cid),
        where("role", "==", "customer")
      )
    );
    
    const clientsList = clientsSnapshot.docs.map((doc) => ({
      id: doc.id,
      first_name: doc.data().first_name || "",
      last_name: doc.data().last_name || "",
      email: doc.data().email || "",
      phone: doc.data().phone || "",
      agencies_id: doc.data().agencies_id || "",
      company_id: doc.data().company_id || "",
      is_active: doc.data().is_active ?? true,
      company_name: doc.data().company_name || "",
      street_address: doc.data().street_address || "",
      postal_code: doc.data().postal_code || "",
      city: doc.data().city || "",
      country: doc.data().country || "",
      tva: doc.data().tva ?? 20,
      non_assujetti_tva: doc.data().non_assujetti_tva ?? false,
      created_at: doc.data().created_at,
      updated_at: doc.data().updated_at,
    })) as Client[];
    
    setAllClients(clientsList);
  };

  const loadAgencies = async (cid: string) => {
    const agenciesSnapshot = await getDocs(
      query(collection(db, "agencies"), where("company_id", "==", cid))
    );
    
    const agenciesList = agenciesSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
    })) as Agency[];
    
    setAgencies(agenciesList);
  };

  // Filtrage
  const filteredClients = allClients.filter((client) => {
    if (filterAgency !== "all" && client.agencies_id !== filterAgency)
      return false;
    if (filterStatus !== "all") {
      if (filterStatus === "active" && !client.is_active) return false;
      if (filterStatus === "inactive" && client.is_active) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
      const email = client.email.toLowerCase();
      const companyName = client.company_name?.toLowerCase() || "";
      if (
        !fullName.includes(query) &&
        !email.includes(query) &&
        !client.phone?.toLowerCase().includes(query) &&
        !companyName.includes(query)
      )
        return false;
    }
    return true;
  });

  useEffect(() => {
    setClients(filteredClients);
  }, [filterAgency, filterStatus, searchQuery, allClients]);

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

  const getAgencyName = (agencyId?: string) => {
    if (!agencyId) return "—";
    return agencies.find((a) => a.id === agencyId)?.name || "—";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    // Vérifier que les mots de passe correspondent
    if (!editingClient && formData.password !== formData.confirmPassword) {
      setNotification({
        message: "Les mots de passe ne correspondent pas",
        type: "error",
        clientId: "",
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      return;
    }

    setIsSaving(true);
    try {
      const clientData: {
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        is_active: boolean;
        company_id: string;
        agencies_id?: string;
        company_name?: string;
        street_address?: string;
        postal_code?: string;
        city?: string;
        country?: string;
        tva?: number;
        non_assujetti_tva?: boolean;
      } = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        is_active: formData.is_active,
        company_id: companyId,
      };

      if (formData.phone.trim()) {
        clientData.phone = formData.phone.trim();
      }

      if (formData.agencies_id) {
        clientData.agencies_id = formData.agencies_id;
      }

      // Champs spécifiques aux clients
      if (formData.company_name.trim()) {
        clientData.company_name = formData.company_name.trim();
      }
      if (formData.street_address.trim()) {
        clientData.street_address = formData.street_address.trim();
      }
      if (formData.postal_code.trim()) {
        clientData.postal_code = formData.postal_code.trim();
      }
      if (formData.city.trim()) {
        clientData.city = formData.city.trim();
      }
      if (formData.country.trim()) {
        clientData.country = formData.country.trim().toUpperCase();
      }
      if (formData.tva.trim() && !formData.non_assujetti_tva) {
        clientData.tva = parseFloat(formData.tva) || 20;
      } else if (formData.non_assujetti_tva) {
        clientData.tva = 0; // Pas de TVA si non assujetti
      }
      clientData.non_assujetti_tva = formData.non_assujetti_tva;

      if (editingClient) {
        const updateData: any = {
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          email: clientData.email,
          phone: clientData.phone || null,
          is_active: clientData.is_active,
          agencies_id: clientData.agencies_id || null,
          company_name: clientData.company_name || null,
          street_address: clientData.street_address || null,
          postal_code: clientData.postal_code || null,
          city: clientData.city || null,
          country: clientData.country || null,
          tva: clientData.tva ?? 20,
          non_assujetti_tva: clientData.non_assujetti_tva ?? false,
          updated_at: serverTimestamp(),
        };

        await updateDoc(doc(db, "users", editingClient.id), updateData);
        setNotification({
          message: `"${clientData.first_name} ${clientData.last_name}" a été modifié`,
          type: "success",
          clientId: editingClient.id,
        });
      } else {
        // Créer le compte via Cloud Function
        if (!formData.password.trim() || formData.password.trim().length < 6) {
          throw new Error("Le mot de passe est requis et doit contenir au moins 6 caractères");
        }

        const createTeamMember = httpsCallable(functions, "createTeamMember");
        const createData: any = {
          email: clientData.email,
          password: formData.password.trim(),
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          phone: clientData.phone || null,
          role: "customer",
          company_id: companyId,
          agencies_id: clientData.agencies_id || null,
          is_active: clientData.is_active,
        };

        // Ajouter les champs spécifiques aux clients
        if (clientData.company_name) {
          createData.company_name = clientData.company_name;
        }
        if (clientData.street_address) {
          createData.street_address = clientData.street_address;
        }
        if (clientData.postal_code) {
          createData.postal_code = clientData.postal_code;
        }
        if (clientData.city) {
          createData.city = clientData.city;
        }
        if (clientData.country) {
          createData.country = clientData.country;
        }
        if (clientData.tva !== undefined) {
          createData.tva = clientData.tva;
        }
        if (clientData.non_assujetti_tva !== undefined) {
          createData.non_assujetti_tva = clientData.non_assujetti_tva;
        }

        const result = await createTeamMember(createData);

        const response = result.data as { userId: string; message: string };
        setNotification({
          message: `"${clientData.first_name} ${clientData.last_name}" a été ajouté avec un compte de connexion`,
          type: "success",
          clientId: response.userId,
        });
      }

      await loadClients(companyId);
      resetForm();

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving client:", error);
      setNotification({
        message: "Erreur lors de l'enregistrement",
        type: "error",
        clientId: editingClient?.id || "",
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
      setFormData({
      agencies_id: client.agencies_id || "",
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      email: client.email,
      phone: client.phone || "",
      password: "",
      confirmPassword: "",
      is_active: client.is_active,
      company_name: client.company_name || "",
      street_address: client.street_address || "",
      postal_code: client.postal_code || "",
      city: client.city || "",
      country: client.country || "",
      tva: client.tva?.toString() || "20",
      non_assujetti_tva: client.non_assujetti_tva ?? false,
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
      setFormData({
      agencies_id: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      is_active: true,
      tva: "20",
      non_assujetti_tva: false,
      company_name: "",
      street_address: "",
      postal_code: "",
      city: "",
      country: "",
    });
    setEditingClient(null);
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
              {editingClient ? "Modifier le client" : "Nouveau client"}
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
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    agencies_id: e.target.value,
                  }))
                }
                required
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              >
                <option value="">Sélectionner une agence</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Nom de la société *
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    company_name: e.target.value.toUpperCase(),
                  }))
                }
                required
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                placeholder="Nom de la société"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      first_name: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      last_name: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
            </div>
            {!editingClient && (
              <>
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    required
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="Minimum 6 caractères"
                    minLength={6}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                    Confirmer le mot de passe *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    required
                    className={`h-11 rounded-2xl border bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:outline-none focus:ring-2 ${
                      formData.confirmPassword &&
                      formData.password !== formData.confirmPassword
                        ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                        : "border-zinc-200 focus:border-zinc-300 focus:ring-zinc-100"
                    }`}
                    placeholder="Répétez le mot de passe"
                    minLength={6}
                  />
                  {formData.confirmPassword &&
                    formData.password !== formData.confirmPassword && (
                      <p className="text-xs text-red-600">
                        Les mots de passe ne correspondent pas
                      </p>
                    )}
                </div>
                <p className="text-xs text-[#6B7280]">
                  Un compte de connexion sera créé. Donnez ce mot de passe au
                  client pour qu&apos;il puisse se connecter.
                </p>
              </>
            )}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Adresse *
                </label>
                <input
                  type="text"
                  value={formData.street_address}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      street_address: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                  placeholder="Rue et numéro"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                    Code postal *
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        postal_code: e.target.value,
                      }))
                    }
                    required
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="Code postal"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                    Ville *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    required
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="Ville"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Pays *
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      country: e.target.value.toUpperCase(),
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                  placeholder="Pays"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                TVA (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tva}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tva: e.target.value }))
                  }
                  disabled={formData.non_assujetti_tva}
                  required={!formData.non_assujetti_tva}
                  className="flex-1 h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="20"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="non_assujetti_tva"
                    checked={formData.non_assujetti_tva}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        non_assujetti_tva: e.target.checked,
                        tva: e.target.checked ? "0" : prev.tva || "20",
                      }))
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-[#111827] focus:ring-2 focus:ring-zinc-100"
                  />
                  <label
                    htmlFor="non_assujetti_tva"
                    className="text-xs text-[#6B7280] cursor-pointer whitespace-nowrap"
                  >
                    Non assujetti à la TVA
                  </label>
                </div>
              </div>
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
                Client actif
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
                  : editingClient
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
              Gestion des clients
            </p>
            <h1 className="text-2xl font-semibold mt-1">Clients</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              {filteredClients.length} / {allClients.length}{" "}
              {allClients.length === 1 ? "client" : "clients"}
            </span>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              + Ajouter un client
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Recherche
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, email, téléphone, société..."
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Agence
            </label>
            <select
              value={filterAgency}
              onChange={(e) => setFilterAgency(e.target.value)}
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
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
              Statut
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
            >
              <option value="all">Tous</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilterAgency("all");
                setFilterStatus("all");
                setSearchQuery("");
              }}
              className="h-10 w-10 rounded-xl border border-zinc-200 bg-white flex items-center justify-center text-[#111827] transition hover:bg-zinc-50"
              title="Réinitialiser les filtres"
            >
              ↺
            </button>
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-sm font-medium mb-1">
              {allClients.length === 0
                ? "Aucun client pour le moment"
                : "Aucun client ne correspond aux filtres"}
            </p>
            <p className="text-xs">
              {allClients.length === 0
                ? "Aucun client enregistré"
                : "Essayez de modifier les filtres"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="group relative rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] hover:-translate-y-1"
              >
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-[#111827]">
                        {client.first_name && client.last_name
                          ? `${client.first_name} ${client.last_name}`
                          : client.email}
                      </h3>
                      {client.company_name && (
                        <p className="text-xs text-[#6B7280] mt-0.5">
                          {client.company_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                        client.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {client.is_active ? "✓" : "✗"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-[#6B7280]">
                    <div className="flex items-center gap-1.5">
                      <span>📧</span>
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <span>📞</span>
                        <span>{client.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>{getAgencyName(client.agencies_id)}</span>
                    </div>
                  </div>
                </div>

                {/* Infos supplémentaires */}
                {client.created_at && (
                  <div className="mb-4 space-y-1.5 text-xs text-[#6B7280]">
                    <div className="flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Inscrit: {formatDate(client.created_at)}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(client)}
                      className="flex-1 inline-flex h-9 items-center justify-center rounded-xl bg-[#111827] px-3 text-xs font-semibold text-white transition hover:bg-black"
                      title="Modifier"
                    >
                      ✏️ Modifier
                    </button>
                  </div>
                  {/* Notification pour ce client */}
                  {notification && notification.clientId === client.id && (
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

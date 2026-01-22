"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userAgencyId, setUserAgencyId] = useState<string | null>(null);
  
  // Filtres
  const [filterAgency, setFilterAgency] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

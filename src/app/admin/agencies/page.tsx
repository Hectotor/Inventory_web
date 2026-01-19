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

import { auth, db } from "@/lib/firebase";

type Agency = {
  id: string;
  name: string;
  street_address: string;
  postal_code: string;
  city: string;
  country: string;
  is_active: boolean;
  company_id: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export default function AdminAgencies() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
    agencyId: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    street_address: "",
    postal_code: "",
    city: "",
    country: "",
    is_active: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setAgencies([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setAgencies([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string };
      if (!userData.company_id) {
        setAgencies([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      setCompanyId(userData.company_id);
      await loadAgencies(userData.company_id);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadAgencies = async (cid: string) => {
    const agenciesSnapshot = await getDocs(
      query(collection(db, "agencies"), where("company_id", "==", cid)),
    );
    const agenciesList = agenciesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Agency[];
    setAgencies(agenciesList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setIsSaving(true);
    try {
      const agencyData: {
        name: string;
        street_address: string;
        postal_code: string;
        city: string;
        country: string;
        is_active: boolean;
        company_id: string;
      } = {
        name: formData.name.trim(),
        street_address: formData.street_address.trim(),
        postal_code: formData.postal_code.trim(),
        city: formData.city.trim(),
        country: formData.country.trim().toUpperCase(),
        is_active: formData.is_active,
        company_id: companyId,
      };

      if (editingAgency) {
        await updateDoc(doc(db, "agencies", editingAgency.id), {
          ...agencyData,
          updated_at: serverTimestamp(),
        });
        setNotification({
          message: `"${agencyData.name}" a été modifiée`,
          type: "success",
          agencyId: editingAgency.id,
        });
      } else {
        const docRef = await addDoc(collection(db, "agencies"), {
          ...agencyData,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        setNotification({
          message: `"${agencyData.name}" a été ajoutée`,
          type: "success",
          agencyId: docRef.id,
        });
      }

      await loadAgencies(companyId);
      resetForm();

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving agency:", error);
      setNotification({
        message: "Erreur lors de l'enregistrement",
        type: "error",
        agencyId: editingAgency?.id || "",
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (agency: Agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      street_address: agency.street_address || "",
      postal_code: agency.postal_code || "",
      city: agency.city || "",
      country: agency.country || "",
      is_active: agency.is_active,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (agencyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette agence ?")) return;

    try {
      await deleteDoc(doc(db, "agencies", agencyId));
      if (companyId) {
        await loadAgencies(companyId);
      }
    } catch (error) {
      console.error("Error deleting agency:", error);
    }
  };

  const handleToggleActive = async (agency: Agency) => {
    try {
      const newStatus = !agency.is_active;
      await updateDoc(doc(db, "agencies", agency.id), {
        is_active: newStatus,
        updated_at: serverTimestamp(),
      });
      if (companyId) {
        await loadAgencies(companyId);
      }

      setNotification({
        message: newStatus
          ? `"${agency.name}" a été activée`
          : `"${agency.name}" a été désactivée`,
        type: "success",
        agencyId: agency.id,
      });

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error updating agency:", error);
      setNotification({
        message: "Erreur lors de la modification du statut",
        type: "error",
        agencyId: agency.id,
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      street_address: "",
      postal_code: "",
      city: "",
      country: "",
      is_active: true,
    });
    setEditingAgency(null);
    setShowAddForm(false);
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
              {editingAgency ? "Modifier l'agence" : "Nouvelle agence"}
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
                placeholder="Paris, Lyon, Marseille..."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Adresse
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
                placeholder="123 Rue de la République"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Code postal
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
                  placeholder="75001"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Ville
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
                  placeholder="Paris"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Pays
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
                placeholder="FRANCE"
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
                Agence active
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
                  : editingAgency
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
              Gestion des agences
            </p>
            <h1 className="text-2xl font-semibold mt-1">Agences</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              {agencies.length} {agencies.length === 1 ? "agence" : "agences"}
            </span>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              + Ajouter une agence
            </button>
          </div>
        </div>
        {agencies.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">🧭</div>
            <p className="text-sm font-medium mb-1">
              Aucune agence pour le moment
            </p>
            <p className="text-xs">
              Cliquez sur &quot;Ajouter une agence&quot; pour commencer
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agencies.map((agency) => {
              const fullAddress = [
                agency.street_address,
                agency.postal_code,
                agency.city,
                agency.country,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <div
                  key={agency.id}
                  className="group relative rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] hover:-translate-y-1"
                >
                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-[#111827] line-clamp-1">
                          {agency.name}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                          agency.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {agency.is_active ? "✓" : "✗"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                      <span>📍</span>
                      <span className="line-clamp-2">{fullAddress}</span>
                    </div>
                  </div>

                  {/* Infos supplémentaires */}
                  {agency.created_at && (
                    <div className="mb-4 space-y-1.5 text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>Ajoutée: {formatDate(agency.created_at)}</span>
                      </div>
                      {agency.updated_at && (
                        <div className="flex items-center gap-1.5">
                          <span>🔄</span>
                          <span>Modifiée: {formatDate(agency.updated_at)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-3 border-t border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(agency)}
                        className="flex-1 inline-flex h-9 items-center justify-center rounded-xl bg-[#111827] px-3 text-xs font-semibold text-white transition hover:bg-black"
                        title="Modifier"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(agency)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                          agency.is_active
                            ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                            : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                        title={agency.is_active ? "Désactiver" : "Activer"}
                      >
                        {agency.is_active ? "⏸" : "▶"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(agency.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                    {/* Notification pour cette agence */}
                    {notification && notification.agencyId === agency.id && (
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

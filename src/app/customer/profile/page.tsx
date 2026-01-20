"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type UserProfile = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
};

export default function CustomerProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    street_address: "",
    postal_code: "",
    city: "",
    country: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as UserProfile;
      setUser(userData);
      setFormData({
        first_name: userData.first_name ?? "",
        last_name: userData.last_name ?? "",
        email: userData.email ?? "",
        phone: userData.phone ?? "",
        company_name: userData.company_name ?? "",
        street_address: userData.street_address ?? "",
        postal_code: userData.postal_code ?? "",
        city: userData.city ?? "",
        country: userData.country ?? "",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !user) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
        company_name: formData.company_name.trim().toUpperCase() || null,
        street_address: formData.street_address.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        city: formData.city.trim() || null,
        country: formData.country.trim().toUpperCase() || null,
        updated_at: serverTimestamp(),
      });

      setNotification({
        message: "Profil mis à jour avec succès",
        type: "success",
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error);
      setNotification({
        message: "Erreur lors de la mise à jour du profil",
        type: "error",
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-sm text-[#6B7280]">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111827] text-lg text-white">
              👤
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
                Informations personnelles
              </p>
              <h2 className="text-xl font-semibold">Profil</h2>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
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
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSaving}
            >
              {isSaving ? "Enregistrement..." : "Mettre à jour"}
            </button>
          </div>
        </div>

        <form className="grid gap-4">
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
                disabled
                className="h-11 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-[#6B7280] shadow-sm cursor-not-allowed"
              />
              <p className="text-xs text-[#6B7280]">
                L&apos;email ne peut pas être modifié
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Téléphone
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
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-6 mt-4">
            <h3 className="text-sm font-semibold mb-4">Adresse de livraison</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Nom de la société
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
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                  placeholder="Nom de la société"
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
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                  placeholder="Rue et numéro"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
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
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="Code postal"
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
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="Ville"
                  />
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
                    className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                    placeholder="Pays"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

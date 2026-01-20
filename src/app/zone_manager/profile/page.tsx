"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "@/lib/firebase";

type CompanyProfile = {
  name: string;
  phone: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  is_active: boolean;
  logo_url?: string;
  head_office_siret?: string;
  vat_number?: string;
  legal_form?: string;
  capital_eur?: number;
};

type UserProfile = {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company_id: string;
  is_active: boolean;
  agencies_id?: string;
};

type Agency = {
  id: string;
  name: string;
  street_address: string;
  postal_code: string;
  city: string;
  country: string;
};

export default function ZoneManagerProfile() {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    phone: "",
    street: "",
    postal_code: "",
    city: "",
    country: "",
    logo_url: "",
    siren: "",
    head_office_siret: "",
    vat_number: "",
    legal_form: "",
    capital_eur: "",
  });
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setCompany(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setUser(null);
        setCompany(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as UserProfile;
      setUser(userData);
      setProfileForm({
        first_name: userData.first_name ?? "",
        last_name: userData.last_name ?? "",
        email: userData.email ?? "",
      });

      if (userData.company_id) {
        const companySnapshot = await getDoc(
          doc(db, "companies", userData.company_id),
        );
        if (companySnapshot.exists()) {
          const companyData = companySnapshot.data() as CompanyProfile;
          setCompany(companyData);
          setCompanyForm({
            name: companyData.name ?? "",
            phone: companyData.phone ?? "",
            street: companyData.street ?? "",
            postal_code: companyData.postal_code ?? "",
            city: companyData.city ?? "",
            country: companyData.country ?? "",
            logo_url: companyData.logo_url ?? "",
            head_office_siret: companyData.head_office_siret ?? "",
            vat_number: companyData.vat_number ?? "",
            legal_form: companyData.legal_form ?? "",
            capital_eur:
              typeof companyData.capital_eur === "number"
                ? companyData.capital_eur.toString()
                : "",
          });
        } else {
          setCompany(null);
        }
      } else {
        setCompany(null);
      }

      // Charger l'agence du zone_manager
      if (userData.agencies_id) {
        const agencySnapshot = await getDoc(
          doc(db, "agencies", userData.agencies_id),
        );
        if (agencySnapshot.exists()) {
          const agencyData = agencySnapshot.data() as Agency;
          setAgency({
            id: agencySnapshot.id,
            ...agencyData,
          });
        } else {
          setAgency(null);
        }
      } else {
        setAgency(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const companyAddress = company
    ? [company.street, company.postal_code, company.city, company.country]
        .filter(Boolean)
        .join(", ")
    : "—";

  const handleCompanySave = async () => {
    if (!user?.company_id) {
      return;
    }
    setIsSavingCompany(true);
    const capitalValue = companyForm.capital_eur.trim();
    await updateDoc(doc(db, "companies", user.company_id), {
      name: companyForm.name.trim(),
      phone: companyForm.phone.trim(),
      street: companyForm.street.trim(),
      postal_code: companyForm.postal_code.trim(),
      city: companyForm.city.trim(),
      country: companyForm.country.trim(),
      head_office_siret: companyForm.head_office_siret.trim(),
      vat_number: companyForm.vat_number.trim(),
      legal_form: companyForm.legal_form.trim(),
      capital_eur: capitalValue ? Number(capitalValue) : 0,
    });
    setCompany((prev) =>
      prev
        ? {
            ...prev,
            name: companyForm.name.trim(),
            phone: companyForm.phone.trim(),
            street: companyForm.street.trim(),
            postal_code: companyForm.postal_code.trim(),
            city: companyForm.city.trim(),
            country: companyForm.country.trim(),
            head_office_siret: companyForm.head_office_siret.trim(),
            vat_number: companyForm.vat_number.trim(),
            legal_form: companyForm.legal_form.trim(),
            capital_eur: capitalValue ? Number(capitalValue) : 0,
          }
        : prev,
    );
    setIsSavingCompany(false);
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.company_id) {
      return;
    }

    setIsUploadingLogo(true);
    const logoRef = ref(storage, `companies/${user.company_id}/branding/logo`);
    await uploadBytes(logoRef, file);
    const logoUrl = await getDownloadURL(logoRef);
    await updateDoc(doc(db, "companies", user.company_id), {
      logo_url: logoUrl,
    });
    setCompanyForm((prev) => ({ ...prev, logo_url: logoUrl }));
    setCompany((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev));
    setIsUploadingLogo(false);
  };

  const handleProfileSave = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }
    setIsSavingProfile(true);
    await updateDoc(doc(db, "users", currentUser.uid), {
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      email: profileForm.email.trim(),
    });
    setUser((prev) =>
      prev
        ? {
            ...prev,
            first_name: profileForm.first_name.trim(),
            last_name: profileForm.last_name.trim(),
            email: profileForm.email.trim(),
          }
        : prev,
    );
    setIsSavingProfile(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="group rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111827] text-lg text-white">
              🏢
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
                Section entreprise
              </p>
              <h2 className="text-xl font-semibold">Entreprise</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCompanySave}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isLoading || isSavingCompany}
          >
            {isSavingCompany ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
        <div className="mt-6 grid gap-4 text-sm text-[#6B7280] md:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-gradient-to-r from-[#F8FAFC] to-white px-4 py-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              {companyForm.logo_url ? (
                <img
                  src={companyForm.logo_url}
                  alt="Logo entreprise"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[#6B7280]">
                  LOGO
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#111827]">
                Logo de l&apos;entreprise
              </p>
              <p className="text-xs text-[#6B7280]">
                PNG ou JPG · 2MB max recommandé
              </p>
            </div>
            <label
              htmlFor="companyLogo"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-[#111827] transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              {isUploadingLogo ? "Upload..." : "Ajouter"}
            </label>
            <input
              id="companyLogo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              disabled={isLoading || isUploadingLogo}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">Nom</label>
            <input
              value={companyForm.name}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  name: event.target.value.toUpperCase(),
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              SIRET du siège social
            </label>
            <input
              value={companyForm.head_office_siret}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  head_office_siret: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
              placeholder="815 400 460 00011"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              Numéro de TVA
            </label>
            <input
              value={companyForm.vat_number}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  vat_number: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
              placeholder="FR05815400460"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              Forme juridique
            </label>
            <input
              value={companyForm.legal_form}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  legal_form: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
              placeholder="SAS (simplified joint-stock company)"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              Capital (EUR)
            </label>
            <input
              value={companyForm.capital_eur}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  capital_eur: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
              placeholder="5000.00"
              type="number"
              step="0.01"
              min="0"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              Téléphone
            </label>
            <input
              value={companyForm.phone}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">Rue</label>
            <input
              value={companyForm.street}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  street: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              Code postal
            </label>
            <input
              value={companyForm.postal_code}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  postal_code: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">Ville</label>
            <input
              value={companyForm.city}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  city: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">Pays</label>
            <input
              value={companyForm.country}
              onChange={(event) =>
                setCompanyForm((prev) => ({
                  ...prev,
                  country: event.target.value.toUpperCase(),
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
        </div>
      </section>

      <section className="group rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111827] text-lg text-white">
              👤
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
                Section profil
              </p>
              <h2 className="text-xl font-semibold">Profil</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleProfileSave}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isLoading || isSavingProfile}
          >
            {isSavingProfile ? "Enregistrement..." : "Mettre à jour"}
          </button>
        </div>
        <div className="mt-6 grid gap-4 text-sm text-[#6B7280]">
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">
              Prénom
            </label>
            <input
              value={profileForm.first_name}
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  first_name: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">Nom</label>
            <input
              value={profileForm.last_name}
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  last_name: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em]">Email</label>
            <input
              value={profileForm.email}
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] px-4 py-3">
            <span>Rôle</span>
            <span className="font-medium text-[#111827]">
              {isLoading ? "Chargement..." : user?.role || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] px-4 py-3">
            <span>Statut</span>
            <span className="font-medium text-[#111827]">
              {isLoading
                ? "Chargement..."
                : user
                  ? user.is_active
                    ? "Actif"
                    : "Inactif"
                  : "—"}
            </span>
          </div>
          {agency && (
            <div className="rounded-2xl border border-zinc-100 bg-[#F8FAFC] px-4 py-3">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                Agence
              </div>
              <div className="space-y-1">
                <p className="font-medium text-[#111827]">{agency.name}</p>
                <p className="text-sm text-[#6B7280]">
                  {[
                    agency.street_address,
                    agency.postal_code,
                    agency.city,
                    agency.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

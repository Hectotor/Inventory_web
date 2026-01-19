"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
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

import { auth, db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

type TeamMember = {
  id: string;
  agencies_id?: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: "admin" | "area manager" | "warehouse" | "sales" | "driver" | "customer";
  is_active: boolean;
  company_id: string;
  street_address?: string;
  postal_code?: string;
  country?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

type Agency = {
  id: string;
  name: string;
};

export default function AdminTeam() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
    memberId: string;
  } | null>(null);
  
  // Filtres
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterAgency, setFilterAgency] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [formData, setFormData] = useState({
    agencies_id: "",
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "sales" as TeamMember["role"],
    is_active: true,
    street_address: "",
    postal_code: "",
    country: "",
  });

  const roles = [
    { value: "admin", label: "Admin" },
    { value: "area manager", label: "Responsable de zone" },
    { value: "warehouse", label: "Entrepôt" },
    { value: "sales", label: "Commercial" },
    { value: "driver", label: "Livreur" },
    { value: "customer", label: "Client" },
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setTeamMembers([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setTeamMembers([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { company_id?: string };
      if (!userData.company_id) {
        setTeamMembers([]);
        setCompanyId(null);
        setIsLoading(false);
        return;
      }

      setCompanyId(userData.company_id);
      await Promise.all([
        loadTeamMembers(userData.company_id),
        loadAgencies(userData.company_id),
      ]);
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
      name: doc.data().name,
    })) as Agency[];
    setAgencies(agenciesList);
  };

  const loadTeamMembers = async (cid: string) => {
    const membersSnapshot = await getDocs(
      query(collection(db, "users"), where("company_id", "==", cid)),
    );
    const membersList = membersSnapshot.docs.map((doc) => ({
      id: doc.id,
      firstname: doc.data().first_name || "",
      lastname: doc.data().last_name || "",
      email: doc.data().email || "",
      phone: doc.data().phone || "",
      role: (doc.data().role?.toLowerCase() || "sales") as TeamMember["role"],
      is_active: doc.data().is_active ?? true,
      agencies_id: doc.data().agencies_id || "",
      company_id: doc.data().company_id || "",
      street_address: doc.data().street_address || "",
      postal_code: doc.data().postal_code || "",
      country: doc.data().country || "",
      created_at: doc.data().created_at,
      updated_at: doc.data().updated_at,
    })) as TeamMember[];
    setTeamMembers(membersList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    // Vérifier que les mots de passe correspondent
    if (!editingMember && formData.password !== formData.confirmPassword) {
      setNotification({
        message: "Les mots de passe ne correspondent pas",
        type: "error",
        memberId: "",
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      return;
    }

    setIsSaving(true);
    try {
      const memberData: {
        firstname: string;
        lastname: string;
        email: string;
        phone?: string;
        role: TeamMember["role"];
        is_active: boolean;
        company_id: string;
        agencies_id?: string;
        street_address?: string;
        postal_code?: string;
        country?: string;
      } = {
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        is_active: formData.is_active,
        company_id: companyId,
      };

      if (formData.phone.trim()) {
        memberData.phone = formData.phone.trim();
      }

      if (formData.agencies_id) {
        memberData.agencies_id = formData.agencies_id;
      }

      // Ajouter les champs d'adresse uniquement pour les clients
      if (formData.role === "customer") {
        if (formData.street_address.trim()) {
          memberData.street_address = formData.street_address.trim();
        }
        if (formData.postal_code.trim()) {
          memberData.postal_code = formData.postal_code.trim();
        }
        if (formData.country.trim()) {
          memberData.country = formData.country.trim().toUpperCase();
        }
      }

      if (editingMember) {
        const updateData: any = {
          first_name: memberData.firstname,
          last_name: memberData.lastname,
          email: memberData.email,
          phone: memberData.phone || null,
          role: memberData.role,
          is_active: memberData.is_active,
          agencies_id: memberData.agencies_id || null,
          updated_at: serverTimestamp(),
        };

        // Ajouter les champs d'adresse uniquement pour les clients
        if (memberData.role === "customer") {
          updateData.street_address = memberData.street_address || null;
          updateData.postal_code = memberData.postal_code || null;
          updateData.country = memberData.country || null;
        } else {
          // Supprimer les champs d'adresse si le rôle change de "customer" à autre chose
          updateData.street_address = null;
          updateData.postal_code = null;
          updateData.country = null;
        }

        await updateDoc(doc(db, "users", editingMember.id), updateData);
        setNotification({
          message: `"${memberData.firstname} ${memberData.lastname}" a été modifié`,
          type: "success",
          memberId: editingMember.id,
        });
      } else {
        // Créer le compte via Cloud Function
        if (!formData.password.trim() || formData.password.trim().length < 6) {
          throw new Error("Le mot de passe est requis et doit contenir au moins 6 caractères");
        }

        const createTeamMember = httpsCallable(functions, "createTeamMember");
        const createData: any = {
          email: memberData.email,
          password: formData.password.trim(),
          first_name: memberData.firstname,
          last_name: memberData.lastname,
          phone: memberData.phone || null,
          role: memberData.role,
          company_id: companyId,
          agencies_id: memberData.agencies_id || null,
          is_active: memberData.is_active,
        };

        // Ajouter les champs d'adresse uniquement pour les clients
        if (memberData.role === "customer") {
          if (memberData.street_address) {
            createData.street_address = memberData.street_address;
          }
          if (memberData.postal_code) {
            createData.postal_code = memberData.postal_code;
          }
          if (memberData.country) {
            createData.country = memberData.country;
          }
        }

        const result = await createTeamMember(createData);

        const response = result.data as { userId: string; message: string };
        setNotification({
          message: `"${memberData.firstname} ${memberData.lastname}" a été ajouté avec un compte de connexion`,
          type: "success",
          memberId: response.userId,
        });
      }

      await loadTeamMembers(companyId);
      resetForm();

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving team member:", error);
      setNotification({
        message: "Erreur lors de l'enregistrement",
        type: "error",
        memberId: editingMember?.id || "",
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      agencies_id: member.agencies_id || "",
      firstname: member.firstname,
      lastname: member.lastname,
      email: member.email,
      phone: member.phone || "",
      password: "", // Le mot de passe n'est pas modifiable via l'édition
      confirmPassword: "",
      role: member.role,
      is_active: member.is_active,
      street_address: member.street_address || "",
      postal_code: member.postal_code || "",
      country: member.country || "",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce membre ? Cette action supprimera aussi son compte de connexion.")) return;

    try {
      // Note: La suppression du compte Firebase Auth devrait être faite via une Cloud Function
      // pour des raisons de sécurité. Ici on supprime juste le document.
      await deleteDoc(doc(db, "users", memberId));
      if (companyId) {
        await loadTeamMembers(companyId);
      }
    } catch (error) {
      console.error("Error deleting team member:", error);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    try {
      const newStatus = !member.is_active;
      await updateDoc(doc(db, "users", member.id), {
        is_active: newStatus,
        updated_at: serverTimestamp(),
      });
      if (companyId) {
        await loadTeamMembers(companyId);
      }

      setNotification({
        message: newStatus
          ? `"${member.firstname} ${member.lastname}" a été activé`
          : `"${member.firstname} ${member.lastname}" a été désactivé`,
        type: "success",
        memberId: member.id,
      });

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error("Error updating team member:", error);
      setNotification({
        message: "Erreur lors de la modification du statut",
        type: "error",
        memberId: member.id,
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      agencies_id: "",
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: "sales",
      is_active: true,
      street_address: "",
      postal_code: "",
      country: "",
    });
    setEditingMember(null);
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

  const getRoleLabel = (role: TeamMember["role"]) => {
    return roles.find((r) => r.value === role)?.label || role;
  };

  const getAgencyName = (agencyId?: string) => {
    if (!agencyId) return "—";
    return agencies.find((a) => a.id === agencyId)?.name || "—";
  };

  // Filtrage
  const filteredMembers = teamMembers.filter((member) => {
    if (filterRole !== "all" && member.role !== filterRole) return false;
    if (filterAgency !== "all" && member.agencies_id !== filterAgency)
      return false;
    if (filterStatus !== "all") {
      if (filterStatus === "active" && !member.is_active) return false;
      if (filterStatus === "inactive" && member.is_active) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${member.firstname} ${member.lastname}`.toLowerCase();
      const email = member.email.toLowerCase();
      if (
        !fullName.includes(query) &&
        !email.includes(query) &&
        !member.phone?.toLowerCase().includes(query)
      )
        return false;
    }
    return true;
  });

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
              {editingMember ? "Modifier le membre" : "Nouveau membre"}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Prénom
                </label>
                <input
                  type="text"
                  value={formData.firstname}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstname: e.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Nom
                </label>
                <input
                  type="text"
                  value={formData.lastname}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lastname: e.target.value,
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
                  Email
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
                />
              </div>
            </div>
            {!editingMember && (
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
                  Un compte de connexion sera créé. Donnez ce mot de passe à
                  l&apos;utilisateur pour qu&apos;il puisse se connecter.
                </p>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Rôle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as TeamMember["role"],
                    }))
                  }
                  required
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
                  Agence
                </label>
                <select
                  value={formData.agencies_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      agencies_id: e.target.value,
                    }))
                  }
                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="">Aucune agence</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {formData.role === "customer" && (
              <div className="grid gap-4">
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
                      className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                      placeholder="Code postal"
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
                          country: e.target.value,
                        }))
                      }
                      className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                      placeholder="Pays"
                    />
                  </div>
                </div>
              </div>
            )}
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
                Membre actif
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
                  : editingMember
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
              Gestion de l&apos;équipe
            </p>
            <h1 className="text-2xl font-semibold mt-1">Équipe</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              {filteredMembers.length} / {teamMembers.length}{" "}
              {teamMembers.length === 1 ? "membre" : "membres"}
            </span>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              + Ajouter un membre
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Recherche
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, email, téléphone..."
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Rôle
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
            >
              <option value="all">Tous les rôles</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">
              Agence
            </label>
            <select
              value={filterAgency}
              onChange={(e) => setFilterAgency(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
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
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-[#111827] shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100"
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
                setFilterRole("all");
                setFilterAgency("all");
                setFilterStatus("all");
                setSearchQuery("");
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-[#111827] transition hover:bg-zinc-50"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-sm font-medium mb-1">
              {teamMembers.length === 0
                ? "Aucun membre pour le moment"
                : "Aucun membre ne correspond aux filtres"}
            </p>
            <p className="text-xs">
              {teamMembers.length === 0
                ? 'Cliquez sur "Ajouter un membre" pour commencer'
                : "Essayez de modifier les filtres"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="group relative rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] hover:-translate-y-1"
              >
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-[#111827]">
                        {member.firstname} {member.lastname}
                      </h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {getRoleLabel(member.role)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                        member.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {member.is_active ? "✓" : "✗"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-[#6B7280]">
                    <div className="flex items-center gap-1.5">
                      <span>📧</span>
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-1.5">
                        <span>📞</span>
                        <span>{member.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>{getAgencyName(member.agencies_id)}</span>
                    </div>
                  </div>
                </div>

                {/* Infos supplémentaires */}
                {member.created_at && (
                  <div className="mb-4 space-y-1.5 text-xs text-[#6B7280]">
                    <div className="flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Ajouté: {formatDate(member.created_at)}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(member)}
                      className="flex-1 inline-flex h-9 items-center justify-center rounded-xl bg-[#111827] px-3 text-xs font-semibold text-white transition hover:bg-black"
                      title="Modifier"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(member)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        member.is_active
                          ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                          : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                      title={member.is_active ? "Désactiver" : "Activer"}
                    >
                      {member.is_active ? "⏸" : "▶"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                  {/* Notification pour ce membre */}
                  {notification && notification.memberId === member.id && (
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

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { signOutUser } from "@/services/auth";

const menuItems = [
  { label: "Vue d'ensemble", href: "/zone_manager", icon: "✨" },
  { label: "Produits", href: "/zone_manager/products", icon: "🧩" },
  { label: "Stocks", href: "/zone_manager/stocks", icon: "📊" },
  { label: "Clients", href: "/zone_manager/clients", icon: "👥" },
  { label: "Équipe", href: "/zone_manager/team", icon: "🤝" },
  { label: "Profil", href: "/zone_manager/profile", icon: "🪪" },
];

type ZoneManagerLayoutProps = {
  children: ReactNode;
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  "area manager": "Responsable de zone",
  warehouse: "Entrepôt",
  sales: "Commercial",
  driver: "Livreur",
  customer: "Client",
};

export default function ZoneManagerLayout({ children }: ZoneManagerLayoutProps) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingCompanyName, setIsLoadingCompanyName] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOutUser();
    router.push("/connexion");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoadingCompanyName(true);
      if (!currentUser) {
        setCompanyName(null);
        setIsLoadingCompanyName(false);
        return;
      }
      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setCompanyName(null);
        setIsLoadingCompanyName(false);
        return;
      }
      const userData = userSnapshot.data() as { company_id?: string; role?: string };
      if (!userData.company_id) {
        setCompanyName(null);
        setUserRole(null);
        setIsLoadingCompanyName(false);
        return;
      }
      const companySnapshot = await getDoc(
        doc(db, "companies", userData.company_id),
      );
      if (!companySnapshot.exists()) {
        setCompanyName(null);
        setUserRole(null);
        setIsLoadingCompanyName(false);
        return;
      }
      const companyData = companySnapshot.data() as { name?: string; logo_url?: string };
      setCompanyName(companyData.name ?? null);
      setCompanyLogo(companyData.logo_url ?? null);
      setUserRole(userData.role || null);
      setIsLoadingCompanyName(false);
    });

    return () => unsubscribe();
  }, []);

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3">
        {companyLogo ? (
          <div className="h-11 w-11 overflow-hidden rounded-2xl border border-zinc-200 bg-white flex items-center justify-center">
            <img
              src={companyLogo}
              alt={companyName || "Logo"}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#334155] text-sm font-semibold text-white shadow-md">
            🚚
          </div>
        )}
        <div className="flex-1">
          {isLoadingCompanyName ? (
            <div className="space-y-2">
              <div className="h-2 w-20 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="h-3 w-28 rounded-full bg-slate-200/80 animate-pulse" />
            </div>
          ) : (
            <>
              {companyName && (
                <>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#6B7280]">
                    Société
                  </p>
                  <p className="text-sm font-semibold">{companyName}</p>
                </>
              )}
              {userRole && (
                <>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#6B7280] mt-2">
                    Rôle
                  </p>
                  <p className="text-xs font-medium text-[#111827]">
                    {roleLabels[userRole] || userRole}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <nav className="mt-8 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              router.push(item.href);
              setIsMobileMenuOpen(false);
            }}
            className="group flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-left text-sm font-medium text-[#6B7280] transition hover:border-zinc-200 hover:bg-white hover:text-[#111827]"
          >
            <span className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </span>
            <span className="opacity-0 transition group-hover:opacity-100">
              →
            </span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          handleSignOut();
          setIsMobileMenuOpen(false);
        }}
        className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
      >
        Se déconnecter
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%)]" />
      
      {/* Mobile AppBar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-white/60 shadow-sm">
        <div className="flex items-center gap-3">
          {companyLogo ? (
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-200 bg-white flex items-center justify-center">
              <img
                src={companyLogo}
                alt={companyName || "Logo"}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#334155] text-sm font-semibold text-white shadow-md">
              🚚
            </div>
          )}
          <div>
            {isLoadingCompanyName ? (
              <div className="space-y-1.5">
                <div className="h-2 w-24 rounded-full bg-slate-200/80 animate-pulse" />
                <div className="h-1.5 w-16 rounded-full bg-slate-200/80 animate-pulse" />
              </div>
            ) : (
              <>
                {companyName && (
                  <p className="text-sm font-semibold text-[#111827]">{companyName}</p>
                )}
                {userRole && (
                  <p className="text-xs text-[#6B7280]">
                    {roleLabels[userRole] || userRole}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-sm transition hover:bg-zinc-50"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <span className="text-xl">✕</span>
          ) : (
            <span className="text-xl">☰</span>
          )}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-72 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full overflow-y-auto rounded-r-[32px] border-r border-white/60 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur pt-20">
          <div className="lg:hidden">
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className="group flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-[#6B7280] transition hover:border-zinc-200 hover:bg-white hover:text-[#111827]"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="whitespace-nowrap">{item.label}</span>
                  </span>
                  <span className="opacity-0 transition group-hover:opacity-100">
                    →
                  </span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                handleSignOut();
                setIsMobileMenuOpen(false);
              }}
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </aside>

      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-6 py-8 lg:pt-8 pt-20">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 flex-shrink-0 lg:block">
          <div className="sticky top-8 rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
            <SidebarContent />
          </div>
        </aside>

        <div className="flex-1 lg:ml-0 ml-0">
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

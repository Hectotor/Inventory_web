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
  { label: "Équipe", href: "/zone_manager/team", icon: "🤝" },
  { label: "Profil", href: "/zone_manager/profile", icon: "🪪" },
];

type ZoneManagerLayoutProps = {
  children: ReactNode;
};

export default function ZoneManagerLayout({ children }: ZoneManagerLayoutProps) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoadingCompanyName, setIsLoadingCompanyName] = useState(true);

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
      const userData = userSnapshot.data() as { company_id?: string };
      if (!userData.company_id) {
        setCompanyName(null);
        setIsLoadingCompanyName(false);
        return;
      }
      const companySnapshot = await getDoc(
        doc(db, "companies", userData.company_id),
      );
      if (!companySnapshot.exists()) {
        setCompanyName(null);
        setIsLoadingCompanyName(false);
        return;
      }
      const companyData = companySnapshot.data() as { name?: string };
      setCompanyName(companyData.name ?? null);
      setIsLoadingCompanyName(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%)]" />
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-6 py-8">
        <aside className="hidden w-72 flex-shrink-0 lg:block">
          <div className="rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#334155] text-sm font-semibold text-white shadow-md">
                🚚
              </div>
              <div>
                {isLoadingCompanyName ? (
                  <div className="space-y-2">
                    <div className="h-2 w-20 rounded-full bg-slate-200/80 animate-pulse" />
                    <div className="h-3 w-28 rounded-full bg-slate-200/80 animate-pulse" />
                  </div>
                ) : companyName ? (
                  <>
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#6B7280]">
                      Société
                    </p>
                    <p className="text-sm font-semibold">{companyName}</p>
                  </>
                ) : null}
              </div>
            </div>
            <nav className="mt-8 space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.href)}
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
              onClick={handleSignOut}
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              Se déconnecter
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

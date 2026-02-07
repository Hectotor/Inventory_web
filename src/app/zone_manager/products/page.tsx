"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { ProductsPage } from "@/components/products/ProductsPage";

export default function ZoneManagerProducts() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUserRole(null);
        setIsLoading(false);
        router.push("/connexion");
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setUserRole(null);
        setIsLoading(false);
        router.push("/connexion");
        return;
      }

      const userData = userSnapshot.data() as { role?: string };
      const role = userData.role || null;
      setUserRole(role);
      
      // Rediriger les zone managers vers le dashboard
      if (role === "area manager") {
        router.push("/zone_manager");
        return;
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const canManageProducts = () => {
    return userRole === "admin";
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

  // Afficher un message d'accès refusé si ce n'est pas un admin
  if (userRole !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="rounded-[28px] border border-red-200 bg-red-50/80 p-8 text-center">
          <p className="text-lg font-semibold text-red-900 mb-2">Accès refusé</p>
          <p className="text-sm text-red-700">Seuls les administrateurs peuvent accéder à cette page.</p>
        </div>
      </div>
    );
  }

  return <ProductsPage canManageProducts={canManageProducts()} />;
}

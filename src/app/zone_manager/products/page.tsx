"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ProductsPage } from "@/components/products/ProductsPage";

export default function ZoneManagerProducts() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (!userSnapshot.exists()) {
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.data() as { role?: string };
      setUserRole(userData.role || null);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const canManageProducts = () => {
    return userRole === "admin" || userRole === "area manager";
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

  return <ProductsPage canManageProducts={canManageProducts()} />;
}

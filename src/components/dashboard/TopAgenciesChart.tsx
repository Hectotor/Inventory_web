"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type TopAgenciesChartProps = {
  orders: Array<{ orders_id: string; customer_id: string; status: string; created_at?: { toDate: () => Date } }>;
  agencies: Array<{ id: string; name: string }>;
  selectedAgency?: string;
};

export function TopAgenciesChart({ orders, agencies, selectedAgency }: TopAgenciesChartProps) {
  const [agencySales, setAgencySales] = useState<Array<{ id: string; name: string; totalSales: number }>>([]);

  // Calculer les ventes par agence
  useEffect(() => {
    const calculateAgencySales = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));
        if (!userSnapshot.exists()) return;

        const userData = userSnapshot.data() as { company_id?: string; agencies_id?: string; role?: string };
        if (!userData.company_id) return;

        // Récupérer tous les utilisateurs avec leur agence
        const usersSnapshot = await getDocs(
          query(collection(db, "users"), where("company_id", "==", userData.company_id))
        );
        const users = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          agencies_id: doc.data().agencies_id,
        }));

        // Créer une map customer_id -> agencies_id
        const customerAgencyMap = new Map<string, string>();
        users.forEach((user) => {
          if (user.agencies_id) {
            customerAgencyMap.set(user.id, user.agencies_id);
          }
        });

        // Calculer les ventes par agence
        const agencySalesMap = new Map<string, number>();
        orders.forEach((order) => {
          if (order.status === "DELIVERED") {
            const agencyId = customerAgencyMap.get(order.customer_id);
            if (agencyId) {
              agencySalesMap.set(agencyId, (agencySalesMap.get(agencyId) || 0) + 1);
            }
          }
        });

        // Inclure toutes les agences, même celles avec zéro vente
        const sales = agencies.map((agency) => {
          const totalSales = agencySalesMap.get(agency.id) || 0;
          return {
            id: agency.id,
            name: agency.name,
            totalSales,
          };
        }).sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 5);

        setAgencySales(sales);
      } catch (error) {
        console.error("Error calculating agency sales:", error);
      }
    };

    calculateAgencySales();
  }, [orders, agencies]);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6">
      <h3 className="text-sm font-semibold mb-4">Top 5 Agences les plus actives</h3>
      {agencySales.length === 0 ? (
        <div className="text-center text-sm text-[#6B7280] py-8">
          0 ventes
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto">
          {agencySales.map((agency, index) => (
            <div
              key={agency.id}
              className="flex-shrink-0 w-48 p-3 rounded-xl border border-zinc-100 bg-[#F8FAFC] hover:bg-zinc-50 transition"
            >
              {/* Nom de l'agence et ventes */}
              <div className="text-center">
                <p className="text-xs font-medium text-[#111827] truncate">{agency.name}</p>
                <p className="text-xs text-[#6B7280] mt-1">{agency.totalSales} ventes</p>
              </div>

              {/* Classement */}
              <div className="flex items-center justify-center mx-auto mt-2 w-8 h-8 rounded-full bg-[#111827] text-white text-sm font-bold">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

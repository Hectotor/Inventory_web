"use client";

import { useRouter } from "next/navigation";

import { signOutUser } from "@/services/auth";

export default function Dashboard() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOutUser();
    router.push("/connexion");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="mx-auto min-h-screen max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#6B7280]">
              Tableau de bord admin
            </p>
            <h1 className="text-3xl font-semibold">
              Pilotage des commandes, équipes et agences
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
              Suivez les livraisons, l&apos;activité des agences et la
              performance des équipes depuis un seul écran.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-[#111827] transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Déconnecter
          </button>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            { label: "Commandes en cours", value: "128" },
            { label: "Livraisons aujourd’hui", value: "42" },
            { label: "Agences actives", value: "8" },
            { label: "Équipes terrain", value: "24" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-[#6B7280]">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Commandes récentes</h2>
              <button className="text-sm font-medium text-[#6B7280] transition hover:text-[#111827]">
                Voir tout
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {[
                {
                  id: "CMD-1082",
                  client: "Pharma Nord",
                  statut: "En préparation",
                  date: "Aujourd’hui · 09:10",
                },
                {
                  id: "CMD-1079",
                  client: "Boutique Lys",
                  statut: "En livraison",
                  date: "Hier · 18:42",
                },
                {
                  id: "CMD-1073",
                  client: "Market Express",
                  statut: "Livrée",
                  date: "Hier · 14:20",
                },
              ].map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{order.id}</p>
                    <p className="text-xs text-[#6B7280]">{order.client}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{order.statut}</p>
                    <p className="text-xs text-[#6B7280]">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Agences</h2>
            <div className="mt-6 space-y-4 text-sm text-[#6B7280]">
              {[
                { name: "Paris Centre", status: "Opérationnelle" },
                { name: "Lyon Est", status: "En charge" },
                { name: "Marseille Sud", status: "Opérationnelle" },
                { name: "Lille Nord", status: "Audit en cours" },
              ].map((agency) => (
                <div
                  key={agency.name}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
                >
                  <span className="font-medium text-[#111827]">
                    {agency.name}
                  </span>
                  <span>{agency.status}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Produits stratégiques</h2>
            <div className="mt-6 space-y-4 text-sm text-[#6B7280]">
              {[
                { name: "Kits de livraison", stock: "Stock OK" },
                { name: "Conteneurs réfrigérés", stock: "Stock faible" },
                { name: "Étiquettes RFID", stock: "Commande en cours" },
              ].map((product) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
                >
                  <span className="font-medium text-[#111827]">
                    {product.name}
                  </span>
                  <span>{product.stock}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Équipe & planning</h2>
            <div className="mt-6 space-y-4 text-sm text-[#6B7280]">
              {[
                { name: "Camille Dupont", role: "Superviseur", shift: "08:00-16:00" },
                { name: "Ahmed Benali", role: "Dispatch", shift: "10:00-18:00" },
                { name: "Léa Martin", role: "Terrain", shift: "12:00-20:00" },
              ].map((member) => (
                <div
                  key={member.name}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
                >
                  <div>
                    <p className="font-medium text-[#111827]">{member.name}</p>
                    <p className="text-xs">{member.role}</p>
                  </div>
                  <span>{member.shift}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

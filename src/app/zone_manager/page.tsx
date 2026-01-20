export default function ZoneManagerDashboard() {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Commandes en cours", value: "128", icon: "📦" },
          { label: "Livraisons aujourd'hui", value: "42", icon: "🛵" },
          { label: "Agences actives", value: "8", icon: "🧭" },
          { label: "Équipes terrain", value: "24", icon: "🤝" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6B7280]">{stat.label}</p>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur lg:col-span-2">
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
                date: "Aujourd'hui · 09:10",
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
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
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

        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <h2 className="text-lg font-semibold">Agences</h2>
          <div className="mt-6 space-y-4 text-sm text-[#6B7280]">
            {[
              { name: "Paris Centre", status: "Opérationnelle", icon: "🏙️" },
              { name: "Lyon Est", status: "En charge", icon: "🌇" },
              { name: "Marseille Sud", status: "Opérationnelle", icon: "🌊" },
              { name: "Lille Nord", status: "Audit en cours", icon: "🧪" },
            ].map((agency) => (
              <div
                key={agency.name}
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
              >
                <span className="flex items-center gap-2 font-medium text-[#111827]">
                  <span>{agency.icon}</span>
                  {agency.name}
                </span>
                <span>{agency.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <h2 className="text-lg font-semibold">Produits stratégiques</h2>
          <div className="mt-6 space-y-4 text-sm text-[#6B7280]">
            {[
              { name: "Kits de livraison", stock: "Stock OK", icon: "🧰" },
              {
                name: "Conteneurs réfrigérés",
                stock: "Stock faible",
                icon: "🧊",
              },
              { name: "Étiquettes RFID", stock: "Commande en cours", icon: "🏷️" },
            ].map((product) => (
              <div
                key={product.name}
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
              >
                <span className="flex items-center gap-2 font-medium text-[#111827]">
                  <span>{product.icon}</span>
                  {product.name}
                </span>
                <span>{product.stock}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <h2 className="text-lg font-semibold">Équipe & planning</h2>
          <div className="mt-6 space-y-4 text-sm text-[#6B7280]">
            {[
              {
                name: "Camille Dupont",
                role: "Superviseur",
                shift: "08:00-16:00",
                icon: "🧑‍💼",
              },
              {
                name: "Ahmed Benali",
                role: "Dispatch",
                shift: "10:00-18:00",
                icon: "🧭",
              },
              {
                name: "Léa Martin",
                role: "Terrain",
                shift: "12:00-20:00",
                icon: "🚚",
              },
            ].map((member) => (
              <div
                key={member.name}
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-[#F8FAFC] p-4"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium text-[#111827]">
                    <span>{member.icon}</span>
                    {member.name}
                  </p>
                  <p className="text-xs">{member.role}</p>
                </div>
                <span>{member.shift}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

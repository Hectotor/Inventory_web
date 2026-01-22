"use client";

import { ClientsPage } from "@/components/clients/ClientsPage";

export default function AdminClients() {
  return <ClientsPage filterByAgency={false} />;
}

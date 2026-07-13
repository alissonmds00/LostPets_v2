"use client";

import { useState } from "react";
import { Container } from "@/components/container";
import { IconShield } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import { mockReports, type ModerationReport } from "@/lib/mock/reports";
import { ReportRow } from "@/components/moderation/report-row";

// WIP: o módulo moderation ainda não tem backend (só README) — ver
// PLAN.md fase 4. A fila abaixo é 100% estado local a partir de fixtures
// (src/lib/mock/reports.ts); nenhuma ação aqui persiste. Quando os
// endpoints existirem, os handlers abaixo viram chamadas de usecase reais.
export default function AdminReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>(mockReports);

  // Gate de UI apenas — cortesia visual, não segurança. A checagem real
  // (server-side) só existe quando o módulo moderation tiver endpoints.
  if (user?.role !== "ADMIN") {
    return (
      <Container className="flex flex-col items-center gap-3 py-24 text-center">
        <IconShield className="h-10 w-10 text-muted" />
        <h1 className="text-xl font-semibold text-ink">Acesso restrito</h1>
        <p className="max-w-sm text-base text-muted">
          Esta área é reservada para administradores da plataforma. Se você
          acredita que deveria ter acesso, fale com a equipe do Lost Pets.
        </p>
      </Container>
    );
  }

  function handleDismiss(id: string) {
    setReports((current) => current.filter((report) => report.id !== id));
  }

  function handleRemoveListing(id: string) {
    setReports((current) => current.filter((report) => report.id !== id));
  }

  function handleBanUser(id: string) {
    setReports((current) => current.filter((report) => report.id !== id));
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Fila de denúncias</h1>
        <p className="text-base text-muted">
          Revise as denúncias pendentes e decida o que fazer com cada anúncio.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-10 text-center">
          <IconShield className="h-8 w-8 text-muted" />
          <p className="text-base font-medium text-ink">
            Nenhuma denúncia pendente
          </p>
          <p className="text-sm text-muted">
            A fila está em dia — novas denúncias aparecerão aqui assim que
            forem enviadas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onDismiss={handleDismiss}
              onRemoveListing={handleRemoveListing}
              onBanUser={handleBanUser}
            />
          ))}
        </ul>
      )}
    </Container>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/ui/badge";
import type { ModerationReport } from "@/lib/mock/reports";

type ConfirmingAction = "REMOVE_LISTING" | "BAN_USER" | null;

// One row in the admin moderation queue. "Dispensar" is non-destructive and
// applies right away; "Remover anúncio" and "Banir usuário" expand an inline
// progressive confirmation step first (no modal, no browser confirm()) —
// same convention as OwnerListingRow's "cancelar anúncio" flow.
export function ReportRow({
  report,
  onDismiss,
  onRemoveListing,
  onBanUser,
}: {
  report: ModerationReport;
  onDismiss: (id: string) => void;
  onRemoveListing: (id: string) => void;
  onBanUser: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState<ConfirmingAction>(null);

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={report.listingType} />
          <Link
            href={`/pets/${report.listingId}`}
            className="rounded text-base font-semibold text-ink underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {report.listingTitle}
          </Link>
        </div>
        <p className="text-sm text-muted">Denunciado por {report.reporterName}</p>
        <p className="text-base text-ink">{report.reason}</p>
      </div>

      {confirming === null && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onDismiss(report.id)}
          >
            Dispensar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirming("REMOVE_LISTING")}
          >
            Remover anúncio
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirming("BAN_USER")}
          >
            Banir usuário
          </Button>
        </div>
      )}

      {confirming === "REMOVE_LISTING" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 transition-colors duration-150">
          <span className="text-sm text-ink">
            Tem certeza? O anúncio será removido.
          </span>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              onRemoveListing(report.id);
              setConfirming(null);
            }}
          >
            Sim, remover
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(null)}
          >
            Voltar
          </Button>
        </div>
      )}

      {confirming === "BAN_USER" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 transition-colors duration-150">
          <span className="text-sm text-ink">
            Tem certeza? O usuário não conseguirá mais entrar.
          </span>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              onBanUser(report.id);
              setConfirming(null);
            }}
          >
            Sim, banir
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(null)}
          >
            Voltar
          </Button>
        </div>
      )}
    </li>
  );
}

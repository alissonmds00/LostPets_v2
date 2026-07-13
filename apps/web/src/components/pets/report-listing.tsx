"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

// O módulo moderation ainda não tem backend (ver PLAN.md fase 4) — quando
// POST /api/moderation/reports existir, o timeout abaixo vira essa chamada.
function simulateReportSubmission(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 400));
}

export function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (reason.trim().length < 10) {
      setError("Descreva o motivo com um pouco mais de detalhe (mínimo 10 caracteres).");
      return;
    }

    setError(null);
    setSubmitting(true);
    await simulateReportSubmission();
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6" data-listing-id={listingId}>
        <p className="text-base font-medium text-ink">Denúncia registrada</p>
        <p className="mt-1 text-sm text-muted">
          Obrigado por avisar — a moderação vai revisar este anúncio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded text-sm font-medium text-danger transition-colors duration-150 hover:text-danger-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Denunciar anúncio
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-ink">Denunciar anúncio</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded text-sm text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancelar
            </button>
          </div>

          <Textarea
            label="Motivo da denúncia"
            placeholder="Explique o que há de errado com este anúncio..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={error ?? undefined}
          />

          <Button
            type="submit"
            variant="danger"
            size="sm"
            loading={submitting}
            className="self-start"
          >
            Enviar denúncia
          </Button>
        </form>
      )}
    </div>
  );
}

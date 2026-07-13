"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TypeBadge, StatusBadge } from "@/components/ui/badge";
import { speciesLabel } from "@/lib/pet-species";
import type { PetListing, PetListingStatus } from "@/lib/types";

// Row variant of ListingCard for an owner's own listings: same
// radius/border/spacing language, plus the owner actions (edit, change
// status) ListingCard doesn't need on the public feed.
export function OwnerListingRow({
  listing,
  onStatusChange,
}: {
  listing: PetListing;
  onStatusChange: (id: string, status: PetListingStatus) => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const cover = listing.photos[0];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={`/pets/${listing.id}`}
        className="-m-1 flex min-w-0 flex-1 items-center gap-4 rounded-lg p-1 transition-colors duration-150 hover:bg-surface-2"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {cover ? (
            <img
              src={cover.url}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted">
              Sem foto
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={listing.type} />
            <StatusBadge status={listing.status} />
          </div>
          <p className="truncate text-base font-semibold text-ink">
            {listing.title}
          </p>
          <p className="truncate text-sm text-muted">
            {speciesLabel(listing.species)} · {listing.city}
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {/* Sem PATCH /api/pets/:id ainda (ver PLAN.md fase 2) — o botão fica
            visível e desabilitado de propósito, pra ensinar que a edição
            existe como recurso, só não está pronta ainda, em vez de escondida. */}
        <span title="Edição ainda não disponível — em breve">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled
            aria-label="Editar anúncio — edição ainda não disponível"
          >
            Editar
          </Button>
        </span>

        {listing.status === "ACTIVE" && !confirmingCancel && (
          <>
            {/* Mudança de status é só estado local (otimista): atualiza o
                badge na hora, mas não persiste — precisa de
                PATCH /api/pets/:id, que ainda não existe. */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onStatusChange(listing.id, "RESOLVED")}
            >
              Marcar como resolvido
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar anúncio
            </Button>
          </>
        )}

        {listing.status === "ACTIVE" && confirmingCancel && (
          // Confirmação progressiva inline (sem modal, sem confirm() do
          // navegador) antes de aplicar a ação destrutiva.
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 transition-colors duration-150">
            <span className="text-sm text-ink">Tem certeza?</span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                onStatusChange(listing.id, "CANCELLED");
                setConfirmingCancel(false);
              }}
            >
              Sim, cancelar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingCancel(false)}
            >
              Voltar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

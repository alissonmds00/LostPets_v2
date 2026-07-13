import { cn } from "@/lib/cn";
import type { PetListingStatus, PetListingType } from "@/lib/types";

const typeLabel: Record<PetListingType, string> = {
  LOST: "Perdido",
  FOUND: "Achado",
  DONATION: "Doação",
};

const typeClasses: Record<PetListingType, string> = {
  LOST: "bg-type-lost text-type-lost-ink",
  FOUND: "bg-type-found text-type-found-ink",
  DONATION: "bg-type-donation text-type-donation-ink",
};

export function TypeBadge({ type, className }: { type: PetListingType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium",
        typeClasses[type],
        className,
      )}
    >
      {typeLabel[type]}
    </span>
  );
}

const statusLabel: Record<PetListingStatus, string> = {
  ACTIVE: "Ativo",
  RESOLVED: "Resolvido",
  CANCELLED: "Cancelado",
};

export function StatusBadge({ status, className }: { status: PetListingStatus; className?: string }) {
  if (status === "ACTIVE") {
    // Active is the default, ongoing state — no semantic color earned, a
    // neutral outline pill is enough (color here would be decoration, not
    // information, since every unresolved listing is "active").
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-border px-2.5 py-1 text-sm font-medium text-ink",
          className,
        )}
      >
        {statusLabel[status]}
      </span>
    );
  }

  const classes =
    status === "RESOLVED"
      ? "bg-status-resolved text-status-resolved-ink"
      : "bg-status-cancelled-bg text-status-cancelled-ink";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium",
        classes,
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

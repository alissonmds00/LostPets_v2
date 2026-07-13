import Link from "next/link";
import { TypeBadge, StatusBadge } from "@/components/ui/badge";
import { speciesLabel } from "@/lib/pet-species";
import type { PetListing } from "@/lib/types";

export function ListingCard({ listing }: { listing: PetListing }) {
  const cover = listing.photos[0];

  return (
    <Link
      href={`/pets/${listing.id}`}
      className="flex gap-4 rounded-xl border border-border bg-surface p-4 transition-colors duration-150 hover:bg-surface-2"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
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

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={listing.type} />
          <StatusBadge status={listing.status} />
        </div>
        <p className="truncate text-base font-semibold text-ink">{listing.title}</p>
        <p className="truncate text-sm text-muted">
          {speciesLabel(listing.species)} · {listing.city}
        </p>
      </div>
    </Link>
  );
}

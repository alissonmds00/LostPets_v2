"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/icons";
import { OwnerListingRow } from "@/components/pets/owner-listing-row";
import { mockListings } from "@/lib/mock/pets";
import type { PetListing, PetListingStatus } from "@/lib/types";

// Stand-in for "the current logged-in user" — there's no GET /api/pets yet
// to list a user's own listings (see PLAN.md fase 2), so this id is used to
// pick out "my" listings from the shared mock fixtures. It matches the
// ownerId on 3 of the 6 fixtures in lib/mock/pets.ts. Once the real
// endpoint exists, filtering by owner happens server-side and this constant
// goes away.
const CURRENT_USER_ID = "22222222-2222-4222-8222-222222222222";

export default function MyListingsPage() {
  // Local copy of the filtered mock data: status changes below only update
  // this component's state (optimistic/simulated), never the shared
  // mockListings array other screens read from. Real persistence needs
  // PATCH /api/pets/:id, which doesn't exist in the backend yet.
  const [listings, setListings] = useState<PetListing[]>(() =>
    mockListings.filter((listing) => listing.ownerId === CURRENT_USER_ID),
  );

  function handleStatusChange(id: string, status: PetListingStatus) {
    setListings((current) =>
      current.map((listing) =>
        listing.id === id
          ? { ...listing, status, updatedAt: new Date().toISOString() }
          : listing,
      ),
    );
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink">Meus anúncios</h1>
        <Link href="/pets/new">
          <Button size="sm">
            <IconPlus className="h-4 w-4" />
            Novo anúncio
          </Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center">
          <p className="text-lg font-semibold text-ink">
            Você ainda não tem nenhum anúncio
          </p>
          <p className="max-w-sm text-sm text-muted">
            Perdeu um pet, achou um por aí ou quer doar? Publique um anúncio
            e deixe a vizinhança ajudar a resolver rápido.
          </p>
          <Link href="/pets/new">
            <Button size="sm">
              <IconPlus className="h-4 w-4" />
              Publicar um anúncio
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map((listing) => (
            <OwnerListingRow
              key={listing.id}
              listing={listing}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </Container>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/icons";
import { ListingCard } from "@/components/pets/listing-card";
import {
  ListingFilterBar,
  type RadiusFilter,
  type TypeFilter,
} from "@/components/pets/listing-filter-bar";
import { ApiError, listPetListings } from "@/lib/api";
import type { PetListing } from "@/lib/types";

// GET /api/pets sempre retorna só anúncios ACTIVE (regra aplicada no
// backend) — o feed não precisa (e não deve) filtrar status aqui.
export default function FeedPage() {
  const [type, setType] = useState<TypeFilter>("ALL");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState<RadiusFilter>("ANY");
  const [allListings, setAllListings] = useState<PetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPetListings(type === "ALL" ? undefined : { type })
      .then((data) => {
        if (!cancelled) setAllListings(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar os anúncios.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  // Filtro de cidade fica client-side (sobre o conjunto já buscado por
  // tipo) — evita uma requisição por tecla digitada.
  const listings = useMemo(() => {
    const cityQuery = city.trim().toLowerCase();
    return allListings.filter(
      (listing) =>
        cityQuery === "" || listing.city.toLowerCase().includes(cityQuery),
    );
  }, [allListings, city]);

  const hasActiveFilters = type !== "ALL" || city.trim() !== "";

  function clearFilters() {
    setType("ALL");
    setCity("");
    setRadius("ANY");
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink">Feed</h1>
        <Link href="/pets/new">
          <Button size="sm">
            <IconPlus className="h-4 w-4" />
            Novo anúncio
          </Button>
        </Link>
      </div>

      <ListingFilterBar
        type={type}
        onTypeChange={setType}
        city={city}
        onCityChange={setCity}
        radius={radius}
        onRadiusChange={setRadius}
      />

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <p className="text-sm text-muted">
        {loading
          ? "Carregando anúncios..."
          : listings.length === 1
            ? "1 anúncio encontrado"
            : `${listings.length} anúncios encontrados`}
      </p>

      {!loading && listings.length > 0 && (
        <div className="flex flex-col gap-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {!loading && listings.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
          <p className="text-base font-medium text-ink">
            Nenhum anúncio encontrado com esses filtros
          </p>
          <p className="text-sm text-muted">
            Tente ampliar a busca: remova o filtro de cidade, troque o tipo
            de anúncio, ou aumente o raio de distância.
          </p>
          {hasActiveFilters && (
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </Container>
  );
}

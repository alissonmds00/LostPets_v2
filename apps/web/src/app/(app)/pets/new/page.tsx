"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";
import { ApiError, submitPetListing } from "@/lib/api";
import { speciesOptions } from "@/lib/pet-species";
import type { PetListingType, PetSpecies } from "@/lib/types";

const typeOptions: { value: PetListingType; label: string }[] = [
  { value: "LOST", label: "Perdido" },
  { value: "FOUND", label: "Achado" },
  { value: "DONATION", label: "Doação" },
];

export default function NewPetListingPage() {
  const [type, setType] = useState<PetListingType>("LOST");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [species, setSpecies] = useState<PetSpecies>("DOG");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocalização não é suportada neste navegador — preencha manualmente.");
      setShowManualLocation(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocating(false);
      },
      () => {
        setError("Não foi possível obter sua localização — preencha manualmente.");
        setShowManualLocation(true);
        setLocating(false);
      },
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!latitude || !longitude) {
      setError(
        'Defina a localização do anúncio — use o botão "Usar minha localização atual" ou preencha manualmente.',
      );
      setShowManualLocation(true);
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Latitude e longitude precisam ser números válidos.");
      return;
    }

    setSubmitting(true);
    try {
      await submitPetListing({
        type,
        title,
        description,
        species,
        city,
        latitude: lat,
        longitude: lng,
        photos,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar o anúncio. Tente de novo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Container className="flex max-w-lg flex-col items-start gap-4 py-20">
        <h1 className="text-2xl font-semibold text-ink">
          Recebemos seu anúncio
        </h1>
        <p className="text-base text-muted">
          Ele está sendo processado e vai aparecer em &quot;Meus anúncios&quot;
          em instantes.
        </p>
        <div className="flex gap-3">
          <Link href="/my-listings">
            <Button>Ver meus anúncios</Button>
          </Link>
          <Link href="/feed">
            <Button variant="secondary">Voltar pro feed</Button>
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl py-10">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-8"
      >
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-ink">Novo anúncio</h1>
          <p className="text-base text-muted">
            Conte o que aconteceu — quanto mais detalhe, mais fácil alguém
            reconhecer o pet.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <Select
          label="Tipo de anúncio"
          value={type}
          onChange={(e) => setType(e.target.value as PetListingType)}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Input
          label="Título"
          required
          placeholder="Ex: Golden Retriever perdido perto do parque"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          label="Descrição"
          required
          placeholder="Cor, porte, características, quando/onde foi visto pela última vez..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Select
          label="Espécie"
          value={species}
          onChange={(e) => setSpecies(e.target.value as PetSpecies)}
        >
          {speciesOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Input
          label="Cidade"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={locating}
            onClick={useCurrentLocation}
            className="self-start"
          >
            Usar minha localização atual
          </Button>

          {latitude && longitude && !showManualLocation ? (
            <p className="text-sm text-muted">
              Localização capturada.{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-ink"
                onClick={() => setShowManualLocation(true)}
              >
                Preencher manualmente
              </button>
            </p>
          ) : (
            !showManualLocation && (
              <button
                type="button"
                className="self-start text-sm text-muted underline underline-offset-2 hover:text-ink"
                onClick={() => setShowManualLocation(true)}
              >
                Preencher latitude/longitude manualmente
              </button>
            )
          )}

          {showManualLocation && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Latitude"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <Input
                label="Longitude"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="photos" className="text-sm font-medium text-ink">
            Fotos
          </label>
          <input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-primary-ink hover:file:bg-primary-hover"
          />
          {photos.length > 0 && (
            <p className="text-sm text-muted">
              {photos.length} foto{photos.length > 1 ? "s" : ""} selecionada
              {photos.length > 1 ? "s" : ""}.
            </p>
          )}
        </div>

        <Button type="submit" size="lg" loading={submitting}>
          Publicar anúncio
        </Button>
      </form>
    </Container>
  );
}

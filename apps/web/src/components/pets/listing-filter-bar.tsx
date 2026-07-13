"use client";

import { Input, Select } from "@/components/ui/field";
import type { PetListingType } from "@/lib/types";

export type TypeFilter = PetListingType | "ALL";
export type RadiusFilter = "ANY" | "5" | "10" | "25";

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "Todos os tipos" },
  { value: "LOST", label: "Perdido" },
  { value: "FOUND", label: "Achado" },
  { value: "DONATION", label: "Doação" },
];

const radiusOptions: { value: RadiusFilter; label: string }[] = [
  { value: "ANY", label: "Qualquer distância" },
  { value: "5", label: "Até 5 km" },
  { value: "10", label: "Até 10 km" },
  { value: "25", label: "Até 25 km" },
];

type ListingFilterBarProps = {
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
  city: string;
  onCityChange: (value: string) => void;
  radius: RadiusFilter;
  onRadiusChange: (value: RadiusFilter) => void;
};

export function ListingFilterBar({
  type,
  onTypeChange,
  city,
  onCityChange,
  radius,
  onRadiusChange,
}: ListingFilterBarProps) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
      <Select
        label="Tipo"
        value={type}
        onChange={(event) => onTypeChange(event.target.value as TypeFilter)}
      >
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Input
        label="Cidade"
        placeholder="Ex: São Paulo"
        value={city}
        onChange={(event) => onCityChange(event.target.value)}
      />

      {/* Raio de distância: o controle já existe na UI, mas não filtra o
          conjunto mock. O cálculo real de "está a X km de mim" precisa da
          consulta de distância por lat/lng em SQL que só o backend pode
          fazer (ver ARCHITECTURE.md — geolocalização é lat/lng + fórmula de
          distância via Prisma $queryRaw, não client-side); replicar isso em
          JS contra um array estático não teria valor real. */}
      <Select
        label="Raio de distância"
        hint="Ainda não filtra os resultados — depende da busca no backend."
        value={radius}
        onChange={(event) => onRadiusChange(event.target.value as RadiusFilter)}
      >
        {radiusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

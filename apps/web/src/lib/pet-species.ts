import type { PetSpecies } from "./types";

export const speciesOptions: { value: PetSpecies; label: string }[] = [
  { value: "DOG", label: "Cachorro" },
  { value: "CAT", label: "Gato" },
  { value: "BIRD", label: "Pássaro" },
];

const speciesLabels: Record<PetSpecies, string> = Object.fromEntries(
  speciesOptions.map((option) => [option.value, option.label]),
) as Record<PetSpecies, string>;

export function speciesLabel(species: PetSpecies): string {
  return speciesLabels[species];
}

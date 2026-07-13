// Mirrors apps/api/src/modules/identity/identity.dto.ts and
// apps/api/src/modules/pets/pets.dto.ts. Kept as plain types (not zod) since
// the frontend trusts the API's own validation; re-validating here would
// duplicate the backend's Zod schemas for no benefit.

export type Role = "USER" | "ADMIN";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type User = AuthenticatedUser & {
  createdAt: string;
};

export type PetListingType = "LOST" | "FOUND" | "DONATION";

export type PetListingStatus = "ACTIVE" | "RESOLVED" | "CANCELLED";

export type PetSpecies = "DOG" | "CAT" | "BIRD";

export type PetPhoto = {
  id: string;
  listingId: string;
  storageKey: string;
  url: string;
  order: number;
  createdAt: string;
};

export type PetListing = {
  id: string;
  type: PetListingType;
  title: string;
  description: string;
  species: PetSpecies;
  latitude: number;
  longitude: number;
  city: string;
  status: PetListingStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  photos: PetPhoto[];
};

// { error: { code, message, details? } } — the global exception handler's
// response shape (apps/api/src/infra/exception-handler.ts).
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

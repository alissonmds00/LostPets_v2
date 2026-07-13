import type {
  ApiErrorBody,
  AuthenticatedUser,
  PetListing,
  PetListingType,
  PetSpecies,
  User,
} from "./types";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001") + "/api";

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.statusCode = statusCode;
    this.details = body.details;
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody).error);
  }

  return data as T;
}

// identity — apps/api/src/modules/identity/identity.routes.ts

export function registerUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<User> {
  return apiFetch<User>("/identity/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthenticatedUser }> {
  return apiFetch<{ user: AuthenticatedUser }>("/identity/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/identity/logout", { method: "POST" });
}

export function getMe(): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>("/identity/me");
}

// pets — apps/api/src/modules/pets/pets.routes.ts

export type SubmitPetListingInput = {
  type: PetListingType;
  title: string;
  description: string;
  species: PetSpecies;
  latitude: number;
  longitude: number;
  city: string;
  photos: File[];
};

export function submitPetListing(
  input: SubmitPetListingInput,
): Promise<{ received: boolean }> {
  const form = new FormData();
  form.set("type", input.type);
  form.set("title", input.title);
  form.set("description", input.description);
  form.set("species", input.species);
  form.set("latitude", String(input.latitude));
  form.set("longitude", String(input.longitude));
  form.set("city", input.city);
  for (const photo of input.photos) {
    form.append("photos", photo);
  }

  return apiFetch<{ received: boolean }>("/pets", {
    method: "POST",
    body: form,
  });
}

// GET /api/pets — pública, sempre retorna só anúncios ACTIVE (regra aplicada
// no backend, não aqui).
export function listPetListings(filter?: {
  type?: PetListingType;
  city?: string;
}): Promise<PetListing[]> {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  if (filter?.city) params.set("city", filter.city);
  const query = params.toString();
  return apiFetch<PetListing[]>(`/pets${query ? `?${query}` : ""}`);
}

import type { PetListing } from "@/lib/types";

// Fixtures for screens that need GET /api/pets (list/search) or
// GET /api/pets/:id, neither of which exists in the backend yet (see
// PLAN.md fase 2). No photo URLs: real ones come from the storage gateway
// once those endpoints exist, so ListingCard's "Sem foto" placeholder is the
// honest state here, not a guessed/broken image URL.
export const mockListings: PetListing[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    type: "LOST",
    title: "Golden Retriever perdido perto do Parque Ibirapuera",
    description:
      "Ele se chama Bento, é bem dócil e estava usando uma coleira azul. Sumiu perto do portão 3 durante a tarde.",
    species: "DOG",
    latitude: -23.5874,
    longitude: -46.6576,
    city: "São Paulo",
    status: "ACTIVE",
    ownerId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-09T14:30:00.000Z",
    updatedAt: "2026-07-09T14:30:00.000Z",
    photos: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    type: "FOUND",
    title: "Gato malhado encontrado na Vila Madalena",
    description:
      "Apareceu no meu quintal há dois dias, bem cuidado e sociável. Deve ter dono por perto.",
    species: "CAT",
    latitude: -23.5505,
    longitude: -46.6913,
    city: "São Paulo",
    status: "ACTIVE",
    ownerId: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-07-10T09:15:00.000Z",
    updatedAt: "2026-07-10T09:15:00.000Z",
    photos: [],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    type: "DONATION",
    title: "Filhotes de vira-lata para doação responsável",
    description:
      "Quatro filhotes de 2 meses, saudáveis e vermifugados, procurando um lar. Entrega com termo de adoção.",
    species: "DOG",
    latitude: -23.5629,
    longitude: -46.6544,
    city: "São Paulo",
    status: "ACTIVE",
    ownerId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-08T11:00:00.000Z",
    updatedAt: "2026-07-08T11:00:00.000Z",
    photos: [],
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    type: "LOST",
    title: "Papagaio perdido no bairro Moema",
    description:
      "Voou da varanda durante uma tempestade. Responde pelo nome Kiko e fala algumas palavras.",
    species: "BIRD",
    latitude: -23.5975,
    longitude: -46.6636,
    city: "São Paulo",
    status: "RESOLVED",
    ownerId: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-07-05T08:00:00.000Z",
    updatedAt: "2026-07-11T10:00:00.000Z",
    photos: [],
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    type: "FOUND",
    title: "Cachorro sem coleira encontrado na Paulista",
    description:
      "Porte médio, pelo curto caramelo, bem assustado. Está comigo até encontrarmos o dono.",
    species: "DOG",
    latitude: -23.5614,
    longitude: -46.6558,
    city: "São Paulo",
    status: "ACTIVE",
    ownerId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-11T16:45:00.000Z",
    updatedAt: "2026-07-11T16:45:00.000Z",
    photos: [],
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    type: "DONATION",
    title: "Gata adulta muito carinhosa para doação",
    description:
      "Precisamos encontrar um novo lar pra Mel — ela é castrada, vacinada e adora colo.",
    species: "CAT",
    latitude: -23.55,
    longitude: -46.63,
    city: "São Paulo",
    status: "CANCELLED",
    ownerId: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-06T09:00:00.000Z",
    photos: [],
  },
];

export function getMockListingById(id: string): PetListing | undefined {
  return mockListings.find((listing) => listing.id === id);
}

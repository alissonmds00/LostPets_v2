import type { PetListingType } from "@/lib/types";
import { getMockListingById } from "./pets";

// Fixtures for the messages screens (inbox + thread). The `messaging`
// module has zero backend yet (no WebSocket, no REST history endpoint —
// see PLAN.md fase 3, it's currently just a README), so both screens run
// fully against this local mock state.

// Mock-only sentinel meaning "sent by whoever is logged in". Seed messages
// below use it directly so the thread renders correctly as a demo no matter
// which real account is signed in (mock listing/user ids aren't tied to
// real DB ids). Messages appended live via the composer instead carry the
// real `useAuth().user.id`, so the thread page's own/other comparison is
// still a genuine comparison against the authenticated user, not just the
// sentinel — see isOwnMessage in message-thread.tsx.
export const CURRENT_USER_SENTINEL = "me";

export type MockMessage = {
  id: string;
  senderId: string;
  body: string;
  sentAt: string; // ISO
};

export type Conversation = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingType: PetListingType;
  otherUser: { name: string };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

function listingRef(listingId: string) {
  const listing = getMockListingById(listingId);
  if (!listing) {
    throw new Error(`mock listing ${listingId} not found for conversation fixture`);
  }
  return { title: listing.title, type: listing.type };
}

const GOLDEN_LISTING_ID = "11111111-1111-4111-8111-111111111111";
const CAT_LISTING_ID = "33333333-3333-4333-8333-333333333333";
const PUPPIES_LISTING_ID = "55555555-5555-4555-8555-555555555555";

const CONVERSATION_GOLDEN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONVERSATION_CAT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONVERSATION_PUPPIES_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// Ordered newest lastMessageAt first — the inbox renders this order as-is.
export const mockConversations: Conversation[] = [
  {
    id: CONVERSATION_GOLDEN_ID,
    listingId: GOLDEN_LISTING_ID,
    listingTitle: listingRef(GOLDEN_LISTING_ID).title,
    listingType: listingRef(GOLDEN_LISTING_ID).type,
    otherUser: { name: "Marina Alves" },
    lastMessage: "Acho que vi ele perto da Rua Vergueiro, consigo mandar uma foto?",
    lastMessageAt: "2026-07-11T18:42:00.000Z",
    unreadCount: 2,
  },
  {
    id: CONVERSATION_CAT_ID,
    listingId: CAT_LISTING_ID,
    listingTitle: listingRef(CAT_LISTING_ID).title,
    listingType: listingRef(CAT_LISTING_ID).type,
    otherUser: { name: "Camila Ferreira" },
    lastMessage: "Perfeito, muito obrigada por cuidar dele até lá!",
    lastMessageAt: "2026-07-10T20:15:00.000Z",
    unreadCount: 0,
  },
  {
    id: CONVERSATION_PUPPIES_ID,
    listingId: PUPPIES_LISTING_ID,
    listingTitle: listingRef(PUPPIES_LISTING_ID).title,
    listingType: listingRef(PUPPIES_LISTING_ID).type,
    otherUser: { name: "Beatriz Lima" },
    lastMessage: "Combinado, te aviso quando eu estiver disponível pra buscar.",
    lastMessageAt: "2026-07-09T13:00:00.000Z",
    unreadCount: 0,
  },
];

const mockThreads: Record<string, MockMessage[]> = {
  [CONVERSATION_GOLDEN_ID]: [
    {
      id: "golden-1",
      senderId: "other",
      body: "Oi! Vi seu anúncio do Bento, acho que ele pode ser o cachorro que apareceu perto da Rua Vergueiro.",
      sentAt: "2026-07-11T17:50:00.000Z",
    },
    {
      id: "golden-2",
      senderId: CURRENT_USER_SENTINEL,
      body: "Sério?? Ele estava com uma coleira azul, você conseguiu ver?",
      sentAt: "2026-07-11T18:05:00.000Z",
    },
    {
      id: "golden-3",
      senderId: "other",
      body: "Não reparei na coleira, mas é um Golden bem dócil mesmo, ficou perto de um portão.",
      sentAt: "2026-07-11T18:20:00.000Z",
    },
    {
      id: "golden-4",
      senderId: "other",
      body: "Acho que vi ele perto da Rua Vergueiro, consigo mandar uma foto?",
      sentAt: "2026-07-11T18:42:00.000Z",
    },
  ],
  [CONVERSATION_CAT_ID]: [
    {
      id: "cat-1",
      senderId: "other",
      body: "Oi, acho que esse gato malhado pode ser o Tom, ele sumiu semana passada.",
      sentAt: "2026-07-10T10:00:00.000Z",
    },
    {
      id: "cat-2",
      senderId: CURRENT_USER_SENTINEL,
      body: "Oi Camila! Ele tem alguma marca característica? Pra eu confirmar.",
      sentAt: "2026-07-10T10:20:00.000Z",
    },
    {
      id: "cat-3",
      senderId: "other",
      body: "Tem uma mancha branca no peito em formato de coração, e é bem próximo de gente.",
      sentAt: "2026-07-10T19:50:00.000Z",
    },
    {
      id: "cat-4",
      senderId: CURRENT_USER_SENTINEL,
      body: "Então é ele mesmo! Pode vir buscar quando quiser.",
      sentAt: "2026-07-10T20:05:00.000Z",
    },
    {
      id: "cat-5",
      senderId: "other",
      body: "Perfeito, muito obrigada por cuidar dele até lá!",
      sentAt: "2026-07-10T20:15:00.000Z",
    },
  ],
  [CONVERSATION_PUPPIES_ID]: [
    {
      id: "puppies-1",
      senderId: "other",
      body: "Oi! Os filhotes ainda estão disponíveis para doação?",
      sentAt: "2026-07-09T09:00:00.000Z",
    },
    {
      id: "puppies-2",
      senderId: CURRENT_USER_SENTINEL,
      body: "Oi Beatriz! Estão sim, temos dois machos e duas fêmeas ainda.",
      sentAt: "2026-07-09T09:10:00.000Z",
    },
    {
      id: "puppies-3",
      senderId: "other",
      body: "Que ótimo, tenho interesse em um dos machos. Vocês pedem alguma taxa?",
      sentAt: "2026-07-09T12:40:00.000Z",
    },
    {
      id: "puppies-4",
      senderId: CURRENT_USER_SENTINEL,
      body: "Só o termo de adoção responsável, sem taxa. Posso te mandar os detalhes.",
      sentAt: "2026-07-09T12:55:00.000Z",
    },
    {
      id: "puppies-5",
      senderId: "other",
      body: "Combinado, te aviso quando eu estiver disponível pra buscar.",
      sentAt: "2026-07-09T13:00:00.000Z",
    },
  ],
};

export function getMockConversationById(id: string): Conversation | undefined {
  return mockConversations.find((conversation) => conversation.id === id);
}

export function getMockThreadMessages(conversationId: string): MockMessage[] {
  return [...(mockThreads[conversationId] ?? [])];
}

import { mockListings } from "./pets";
import type { PetListingType } from "@/lib/types";

// Fixtures for the admin moderation queue (GET /api/moderation/reports,
// once it exists — the moderation module is still just a README, see
// PLAN.md fase 4). Only PENDING reports are relevant here: reviewed ones
// (dismissed/actioned) wouldn't show up in the "fila de revisão" anymore.
export type ModerationReportStatus = "PENDING";

export type ModerationReport = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingType: PetListingType;
  reporterName: string;
  reason: string;
  status: ModerationReportStatus;
};

const [lostGolden, foundCat, donationPuppies] = mockListings;

export const mockReports: ModerationReport[] = [
  {
    id: "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaa1",
    listingId: lostGolden.id,
    listingTitle: lostGolden.title,
    listingType: lostGolden.type,
    reporterName: "Marina Alves",
    reason:
      "Essa mesma foto e texto já apareceram em outro anúncio suspeito na semana passada — pode ser golpe.",
    status: "PENDING",
  },
  {
    id: "aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaa2",
    listingId: foundCat.id,
    listingTitle: foundCat.title,
    listingType: foundCat.type,
    reporterName: "Rafael Souza",
    reason:
      "O anunciante está pedindo pagamento antes de devolver o animal, o que não parece certo.",
    status: "PENDING",
  },
  {
    id: "aaaaaaaa-0003-4aaa-8aaa-aaaaaaaaaaa3",
    listingId: donationPuppies.id,
    listingTitle: donationPuppies.title,
    listingType: donationPuppies.type,
    reporterName: "Juliana Prado",
    reason:
      "Anúncio duplicado: o mesmo texto foi publicado por outro usuário há poucos dias.",
    status: "PENDING",
  },
];

import Link from "next/link";
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { ReportListing } from "@/components/pets/report-listing";
import { getMockListingById } from "@/lib/mock/pets";
import { speciesLabel } from "@/lib/pet-species";

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffMinutes < 1) return "agora mesmo";
  if (diffMinutes < 60) {
    return `há ${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`;
  }
  if (diffHours < 24) {
    return `há ${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  }
  if (diffDays < 30) {
    return `há ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
  }
  return new Date(iso).toLocaleDateString("pt-BR");
}

// WIP: GET /api/pets/:id ainda não existe no backend — ver PLAN.md fase 2.
// Esta tela usa apps/web/src/lib/mock/pets.ts (getMockListingById) como
// fonte de dados até esse endpoint existir.
export default async function PetListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getMockListingById(id);

  if (!listing) {
    return (
      <Container className="flex flex-col items-start gap-4 py-20">
        <h1 className="text-2xl font-semibold text-ink">
          Anúncio não encontrado
        </h1>
        <p className="text-base text-muted">
          Esse anúncio pode ter sido removido, resolvido há muito tempo, ou o
          link que você seguiu está incorreto.
        </p>
        <Link href="/feed">
          <Button variant="secondary">Voltar pro feed</Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-6 py-10">
      {/* Fotos vêm do gateway de storage quando GET /api/pets/:id existir —
          os anúncios mock não têm foto, então isto é um placeholder
          honesto, não uma imagem inventada. */}
      <div className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-muted sm:h-80">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-10 w-10"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="9" cy="10" r="1.75" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 17l5-4 3 2.5L17 11l3 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-sm">Este anúncio ainda não tem fotos</p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={listing.type} />
          <StatusBadge status={listing.status} />
        </div>

        <h1 className="text-2xl font-semibold text-ink">{listing.title}</h1>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>{speciesLabel(listing.species)}</span>
          <span aria-hidden="true">·</span>
          <span>{listing.city}</span>
          <span aria-hidden="true">·</span>
          <span>Publicado {formatRelativeDate(listing.createdAt)}</span>
        </div>

        <p className="max-w-prose whitespace-pre-line text-base text-ink">
          {listing.description}
        </p>

        <div className="flex flex-col gap-2 pt-2">
          {/* messaging ainda não tem backend (ver PLAN.md fase 3) — leva pra
              /messages, que hoje só mostra o estado "sem backend ainda". */}
          <Link href="/messages" className="self-start">
            <Button size="lg">Falar com o dono</Button>
          </Link>
          <p className="text-sm text-muted">
            Isso abre Mensagens — o chat direto com o dono ainda depende do
            módulo de mensagens, que ainda não tem backend.
          </p>
        </div>
      </div>

      <ReportListing listingId={listing.id} />
    </Container>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";
import { IconFeed, IconListings, IconMessages } from "@/components/icons";

export default function LandingPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col items-start gap-6 py-20 sm:py-28">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
            Ajude um pet a voltar pra casa.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Publique ou encontre anúncios de pets perdidos, achados e para
            doação na sua comunidade — com contato direto entre vizinhos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg">Criar conta</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10 sm:flex-row sm:gap-16">
          <div className="flex flex-1 flex-col gap-3">
            <IconFeed className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-ink">
              Publique em minutos
            </h2>
            <p className="text-base text-muted">
              Conte o que aconteceu, adicione fotos e a localização — seu
              anúncio já aparece pra vizinhança.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <IconListings className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-ink">
              Encontre perto de você
            </h2>
            <p className="text-base text-muted">
              Filtre por tipo, cidade e distância pra ver só o que é
              relevante pra sua região.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <IconMessages className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-ink">
              Fale direto com quem postou
            </h2>
            <p className="text-base text-muted">
              Mensagens ligadas a cada anúncio, sem intermediário — direto ao
              ponto.
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}

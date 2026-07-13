"use client";

import { useAuth } from "@/lib/auth-context";
import { Container } from "@/components/container";
import { IconProfile } from "@/components/icons";

const roleLabel: Record<string, string> = {
  USER: "Usuário",
  ADMIN: "Administrador",
};

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-10">
      <h1 className="text-2xl font-semibold text-ink">Meu perfil</h1>

      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink">
          <IconProfile className="h-7 w-7" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-lg font-semibold text-ink">{user.name}</p>
          <p className="text-base text-muted">{user.email}</p>
          <p className="text-sm text-muted">{roleLabel[user.role] ?? user.role}</p>
        </div>
      </div>

      <p className="text-sm text-muted">
        Edição de nome e senha ainda não está disponível — a API ainda não
        tem um endpoint pra isso.
      </p>
    </Container>
  );
}

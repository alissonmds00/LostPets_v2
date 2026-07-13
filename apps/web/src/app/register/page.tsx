"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password });
      router.push("/feed");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar sua conta. Tente de novo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <Container className="max-w-md">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-8"
        >
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold text-ink">Criar conta</h1>
            <p className="text-base text-muted">
              Leva menos de um minuto — e ajuda a devolver um pet pra casa
              mais rápido.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <Input
            label="Nome completo"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="Mínimo de 8 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" size="lg" loading={submitting}>
            Criar conta
          </Button>

          <p className="text-center text-sm text-muted">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </Container>
    </main>
  );
}

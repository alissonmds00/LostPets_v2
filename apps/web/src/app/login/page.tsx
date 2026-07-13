"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/feed");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.",
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
            <h1 className="text-2xl font-semibold text-ink">Entrar</h1>
            <p className="text-base text-muted">
              Acesse sua conta pra postar e responder anúncios.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" size="lg" loading={submitting}>
            Entrar
          </Button>

          <p className="text-center text-sm text-muted">
            Ainda não tem conta?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </form>
      </Container>
    </main>
  );
}

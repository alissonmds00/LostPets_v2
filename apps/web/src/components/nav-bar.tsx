"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const authLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/my-listings", label: "Meus anúncios" },
  { href: "/messages", label: "Conversas" },
  { href: "/profile", label: "Perfil" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={user ? "/feed" : "/"} className="text-lg font-semibold text-ink">
          Lost Pets
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            {authLinks
              .concat(
                user.role === "ADMIN"
                  ? [{ href: "/admin/reports", label: "Moderação" }]
                  : [],
              )
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 sm:inline-block",
                    pathname.startsWith(link.href)
                      ? "bg-surface text-ink"
                      : "text-muted hover:text-ink hover:bg-surface",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                router.push("/");
              }}
            >
              Sair
            </Button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">
                Cadastrar
              </Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

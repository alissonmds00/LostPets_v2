"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import {
  IconFeed,
  IconListings,
  IconMessages,
  IconProfile,
  IconShield,
} from "@/components/icons";

const tabs = [
  { href: "/feed", label: "Feed", Icon: IconFeed },
  { href: "/my-listings", label: "Anúncios", Icon: IconListings },
  { href: "/messages", label: "Conversas", Icon: IconMessages },
  { href: "/profile", label: "Perfil", Icon: IconProfile },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = user?.role === "ADMIN"
    ? tabs.concat([{ href: "/admin/reports", label: "Moderação", Icon: IconShield }])
    : tabs;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors duration-150",
              active ? "text-primary" : "text-muted",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

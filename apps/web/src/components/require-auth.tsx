"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"
          role="status"
          aria-label="Carregando"
        />
      </div>
    );
  }

  return <>{children}</>;
}

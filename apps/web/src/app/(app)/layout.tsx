import { MobileTabBar } from "@/components/mobile-tab-bar";
import { RequireAuth } from "@/components/require-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex-1 pb-20 sm:pb-0">{children}</div>
      <MobileTabBar />
    </RequireAuth>
  );
}

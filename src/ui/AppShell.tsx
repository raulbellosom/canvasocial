import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { useTheme } from "../workflows/useTheme";
import { useAuth } from "../contexts/AuthContext";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { UserMenu } from "../components/layout/UserMenu";
import { NotificationsPopover } from "../components/layout/NotificationsPopover";
import { Moon, Sun } from "lucide-react";

export function AppShell() {
  const { theme, toggle } = useTheme();

  // Enable global realtime notifications with sound
  useRealtimeNotifications();

  return (
    <div className="min-h-dvh grid grid-rows-[auto,1fr]">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-violet-600 grid place-items-center text-white font-bold shadow-lg group-hover:shadow-[var(--accent)]/50 transition-shadow">
                C
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">
                  Canvas Social
                </span>
                <span className="text-[10px] text-[var(--muted)] font-medium">
                  BETA
                </span>
              </div>
            </NavLink>
          </div>

          {/* Center Nav (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-4 py-2 rounded-full text-sm font-medium transition-all ${isActive ? "bg-white/10 text-white shadow-inner" : "text-[var(--muted)] hover:text-[var(--fg)] hover:bg-white/5"}`
              }
            >
              Workspaces
            </NavLink>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="rounded-full text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </Button>

            <div className="h-6 w-px bg-[var(--border)] mx-1" />

            <NotificationsPopover />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

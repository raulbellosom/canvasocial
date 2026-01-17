import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { appwriteConfig, storage } from "../../lib/appwrite";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const displayName =
    user.name.length > 20 ? user.name.substring(0, 20) + "..." : user.name;

  // Try to find avatar in prefs or generic
  // For MVP we assume we might store avatar w/ user, or just use initials
  const initials = user.name.substring(0, 2).toUpperCase();

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-white/5 rounded-full p-1 pr-3 transition-colors"
      >
        <div className="size-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] grid place-items-center text-white text-xs font-bold shadow-lg">
          {initials}
        </div>
        <span className="text-sm font-medium hidden sm:block">
          {displayName}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
          <div className="p-3 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Signed in as
            </p>
            <p className="text-sm font-medium truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                setIsOpen(false); /* nav('/profile') */
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 disabled:opacity-50 text-left"
            >
              <UserIcon size={16} />
              Edit Profile
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 disabled:opacity-50 text-left"
            >
              <Settings size={16} />
              Settings
            </button>
          </div>
          <div className="p-1 border-t border-[var(--border)]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-500/10 text-red-500 text-left"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

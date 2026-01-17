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
        className="flex items-center gap-2 hover:bg-muted/50 rounded-full p-1 pr-3 transition-colors"
      >
        <div className="size-8 rounded-full bg-linear-to-br from-(--accent) to-violet-500 grid place-items-center text-white text-xs font-bold shadow-lg">
          {initials}
        </div>
        <span className="text-sm font-medium hidden sm:block">
          {displayName}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground">
              Signed in as
            </p>
            <p className="text-sm font-medium truncate text-foreground">
              {user.email}
            </p>
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                setIsOpen(false); /* nav('/profile') */
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors text-left"
            >
              <UserIcon size={16} className="text-muted-foreground" />
              Edit Profile
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition-colors text-left"
            >
              <Settings size={16} className="text-muted-foreground" />
              Settings
            </button>
          </div>
          <div className="p-1 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive text-left transition-colors"
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

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { account, databases, appwriteConfig } from "../../lib/appwrite";
import { Query } from "appwrite";

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const user = await account.get();
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.notifications,
        [
          Query.equal("user_id", user.$id),
          Query.equal("is_read", false),
          Query.orderDesc("$createdAt"),
          Query.limit(5),
        ],
      );
      return res.documents;
    },
    refetchInterval: 10000, // Poll every 10s as backup to realtime
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.notifications,
        id,
        { is_read: true },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications?.length || 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-white/5 transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2.5 bg-red-500 rounded-full border-2 border-[var(--bg)]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {unreadCount === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--muted)]">
                No new notifications
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {notifications?.map((n) => (
                  <div
                    key={n.$id}
                    className="p-3 text-sm hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium text-[var(--fg)]">
                          {n.title}
                        </p>
                        <p className="text-[var(--muted)] text-xs mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[var(--muted)] text-[10px] mt-1">
                          {new Date(n.$createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={() => markRead.mutate(n.$id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

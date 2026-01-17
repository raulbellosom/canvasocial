import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Query } from "appwrite";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";

export function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const user = await account.get();
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.notifications,
        [
          Query.equal("user_id", user.$id),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );
      return res.documents as any[];
    },
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

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-[var(--muted)]">
          Invitations and activity updates.
        </p>
      </div>

      {isLoading && <div className="text-sm text-[var(--muted)]">Loading…</div>}

      <div className="space-y-2">
        {(data ?? []).map((n) => (
          <Card key={n.$id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  {n.title ?? "Notification"}
                </div>
                <div className="text-sm text-[var(--muted)] mt-1">
                  {n.body ?? ""}
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  {new Date(n.$createdAt).toLocaleString()}
                </div>
              </div>
              {!n.is_read && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markRead.mutate(n.$id)}
                >
                  Mark read
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

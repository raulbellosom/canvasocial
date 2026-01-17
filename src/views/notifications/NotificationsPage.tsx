import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ID, Query } from "appwrite";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Check, X, Bell, Mail } from "lucide-react";

export function NotificationsPage() {
  const qc = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => account.get(),
  });

  const { data: notifications, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const u = await account.get();
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.notifications,
        [
          Query.equal("user_id", u.$id),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );
      return res.documents as any[];
    },
  });

  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const u = await account.get();
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.invitations,
        [
          Query.equal("invitee_email", u.email),
          Query.equal("status", "PENDING"),
          Query.orderDesc("$createdAt"),
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

  const respondToInvite = useMutation({
    mutationFn: async ({
      invitation,
      status,
    }: {
      invitation: any;
      status: "ACCEPTED" | "DECLINED";
    }) => {
      if (status === "ACCEPTED") {
        // Create Membership
        await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.workspaceMembers,
          ID.unique(),
          {
            workspace_id: invitation.target_id,
            user_id: user?.$id,
            role: invitation.role,
            invited_by: invitation.invited_by,
            enabled: true,
          },
        );
      }

      // Update Invitation Status
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.invitations,
        invitation.$id,
        { status },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Stay updated with your workspace activity and invitations.
          </p>
        </div>

        {/* Pending Invitations */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 w-fit px-3 py-1 rounded-full">
            <Mail size={14} />
            Invitations
          </div>
          {isLoadingInvitations ? (
            <div className="h-20 bg-muted/20 animate-pulse rounded-2xl" />
          ) : (invitations ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 px-6 rounded-2xl border border-dashed border-border bg-muted/5">
              No pending invitations.
            </div>
          ) : (
            <div className="grid gap-3">
              {(invitations ?? []).map((inv) => (
                <Card
                  key={inv.$id}
                  className="p-5 flex items-center justify-between group hover:border-indigo-500/50 transition-colors rounded-2xl shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Mail size={24} />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        Workspace Invite
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        You have been invited with role{" "}
                        <span className="text-indigo-500 font-medium">
                          {inv.role}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(inv.$createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        respondToInvite.mutate({
                          invitation: inv,
                          status: "ACCEPTED",
                        })
                      }
                      disabled={respondToInvite.isPending}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-500/20"
                    >
                      <Check size={16} /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        respondToInvite.mutate({
                          invitation: inv,
                          status: "DECLINED",
                        })
                      }
                      disabled={respondToInvite.isPending}
                      className="rounded-xl hover:bg-red-500/10 hover:text-red-500 text-muted-foreground gap-2"
                    >
                      <X size={16} /> Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Notifications List */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 w-fit px-3 py-1 rounded-full">
            <Bell size={14} />
            Activity
          </div>
          {isLoadingNotifications ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-muted/20 animate-pulse rounded-2xl"
                />
              ))}
            </div>
          ) : (notifications ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 px-6 rounded-2xl border border-dashed border-border bg-muted/5">
              Nothing to show here.
            </div>
          ) : (
            <div className="grid gap-3">
              {(notifications ?? []).map((n) => (
                <Card
                  key={n.$id}
                  className={`p-5 flex items-start justify-between gap-4 rounded-2xl border transition-all ${!n.is_read ? "border-indigo-500/20 bg-indigo-500/5 shadow-indigo-500/5" : "bg-muted/5 border-border shadow-sm"}`}
                >
                  <div className="flex gap-4">
                    <div
                      className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${!n.is_read ? "bg-indigo-500 text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      <Bell size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {n.title ?? "Update"}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 max-w-lg leading-relaxed">
                        {n.body ?? ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 mt-3 flex items-center gap-1.5 uppercase tracking-wide font-medium">
                        {new Date(n.$createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {!n.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead.mutate(n.$id)}
                      className="rounded-xl h-8 px-3 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/10 bg-indigo-500/5"
                    >
                      Mark as read
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

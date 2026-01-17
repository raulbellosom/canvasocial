import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ID, Query } from "appwrite";
import { Link } from "react-router-dom";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { useState, useEffect } from "react";
import {
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  Users,
  UserMinus,
  Shield,
  Check,
  Settings,
  ChevronDown,
  Mail,
} from "lucide-react";

type Workspace = {
  $id: string;
  name: string;
  owner_id: string;
  enabled?: boolean;
};

export function WorkspacesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [managingMembersWs, setManagingMembersWs] = useState<Workspace | null>(
    null,
  );
  const [inviteWs, setInviteWs] = useState<Workspace | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [editName, setEditName] = useState("");

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => account.get(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const currentUser = await account.get();
      // Owner workspaces OR memberships
      const owned = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaces,
        [
          Query.equal("owner_id", currentUser.$id),
          Query.equal("enabled", true),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );
      const memberships = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaceMembers,
        [
          Query.equal("user_id", currentUser.$id),
          Query.equal("enabled", true),
          Query.limit(50),
        ],
      );
      const workspaceIds = memberships.documents.map(
        (m: any) => m.workspace_id,
      );
      let shared: any[] = [];
      if (workspaceIds.length) {
        const sharedRes = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.workspaces,
          [
            Query.equal("$id", workspaceIds),
            Query.equal("enabled", true),
            Query.orderDesc("$createdAt"),
            Query.limit(50),
          ],
        );
        shared = sharedRes.documents;
      }
      const uniq = new Map<string, any>();
      [...owned.documents, ...shared].forEach((w) => uniq.set(w.$id, w));
      return Array.from(uniq.values()) as Workspace[];
    },
  });

  const createWs = useMutation({
    mutationFn: async (wsName: string) => {
      if (!user) throw new Error("Not logged in");
      const doc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaces,
        ID.unique(),
        {
          name: wsName,
          owner_id: user.$id,
          enabled: true,
        },
        [
          `read("user:${user.$id}")`,
          `update("user:${user.$id}")`,
          `delete("user:${user.$id}")`,
        ],
      );
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaceMembers,
        ID.unique(),
        {
          workspace_id: doc.$id,
          user_id: user.$id,
          role: "OWNER",
          invited_by: user.$id,
          enabled: true,
        },
        [
          `read("user:${user.$id}")`,
          `update("user:${user.$id}")`,
          `delete("user:${user.$id}")`,
        ],
      );
      return doc;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });

  const updateWs = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaces,
        id,
        { name },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setEditingWorkspace(null);
    },
  });

  const deleteWs = useMutation({
    mutationFn: async (wsId: string) => {
      // 1. Delete associated canvases (soft delete)
      const canvases = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvases,
        [Query.equal("workspace_id", wsId)],
      );

      for (const canvas of canvases.documents) {
        await databases.updateDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.canvases,
          canvas.$id,
          { enabled: false },
        );

        // Also disable ops for this canvas
        const ops = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.canvasOps,
          [Query.equal("canvas_id", canvas.$id)],
        );
        for (const op of ops.documents) {
          await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.collections.canvasOps,
            op.$id,
            { enabled: false },
          );
        }
      }

      // 2. Disable workspace itself (soft delete)
      return await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaces,
        wsId,
        { enabled: false },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setDeletingWorkspace(null);
    },
  });

  // Pending Invitations Query
  const { data: pendingInvitations, isLoading: isLoadingPendingInvites } =
    useQuery({
      queryKey: ["workspace-invitations", managingMembersWs?.$id],
      queryFn: async () => {
        if (!managingMembersWs) return [];
        const res = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.invitations,
          [
            Query.equal("target_id", managingMembersWs.$id),
            Query.equal("status", "PENDING"),
          ],
        );
        return res.documents;
      },
      enabled: !!managingMembersWs,
    });

  const revokeInvitation = useMutation({
    mutationFn: async (id: string) => {
      return await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.invitations,
        id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["workspace-invitations", managingMembersWs?.$id],
      });
    },
  });

  // Reset inputs when closing modal
  useEffect(() => {
    if (!managingMembersWs) {
      setInviteEmail("");
    }
  }, [managingMembersWs]);

  const inviteMember = useMutation({
    mutationFn: async ({
      wsId,
      wsName,
      email,
      role,
    }: {
      wsId: string;
      wsName: string;
      email: string;
      role: string;
    }) => {
      const profiles = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.profiles,
        [Query.equal("email", email)],
      );
      if (profiles.documents.length === 0) {
        throw new Error("User not found with this email");
      }
      const userProfile = profiles.documents[0];

      // Create Invitation instead of Membership
      const invitation = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.invitations,
        ID.unique(),
        {
          target_type: "WORKSPACE",
          target_id: wsId,
          invitee_email: email,
          invitee_user: userProfile.user_auth_id,
          role: role,
          status: "PENDING",
          invited_by: user?.$id,
          enabled: true,
        },
      );

      // Create notification for the invited user
      try {
        await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.notifications,
          ID.unique(),
          {
            user_id: userProfile.user_auth_id,
            type: "INVITE",
            title: "Workspace Invitation",
            body: `You have been invited to join "${wsName}" as ${role === "EDITOR" ? "an Editor" : "a Viewer"}.`,
            is_read: false,
          },
        );
      } catch (err) {
        console.error("Failed to create notification:", err);
      }

      return invitation;
    },
    onSuccess: () => {
      alert("Invitation sent successfully");
      setInviteWs(null);
      setInviteEmail("");
      setInviteRole("EDITOR");
    },
    onError: (err) => alert(err.message),
  });

  const { data: members, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["workspace-members", managingMembersWs?.$id],
    queryFn: async () => {
      if (!managingMembersWs) return [];
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaceMembers,
        [Query.equal("workspace_id", managingMembersWs.$id)],
      );
      // Fetch profiles for names
      const profiles = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.profiles,
        [
          Query.equal(
            "user_auth_id",
            res.documents.map((m: any) => m.user_id),
          ),
        ],
      );
      return res.documents.map((m: any) => ({
        ...m,
        profile: profiles.documents.find(
          (p: any) => p.user_auth_id === m.user_id,
        ),
      }));
    },
    enabled: !!managingMembersWs,
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      return await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaceMembers,
        id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaceMembers,
        id,
        { role },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    },
    onError: (err) => alert("Failed to update role: " + err.message),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Workspaces
            </h1>
            <p className="text-muted-foreground font-medium max-w-lg">
              Manage your creative spaces. Create a new workspace or jump back
              into an existing one.
            </p>
          </div>

          <div className="w-full md:w-auto">
            <div className="flex bg-muted/20 border border-border p-1.5 rounded-2xl shadow-xl focus-within:bg-background transition-colors">
              <input
                className="bg-transparent border-none outline-none text-foreground placeholder-muted-foreground px-4 py-2 w-full md:w-64"
                placeholder="New workspace name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = name.trim();
                    if (v) {
                      setName("");
                      createWs.mutate(v);
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const v = name.trim();
                  if (v) {
                    setName("");
                    createWs.mutate(v);
                  }
                }}
                disabled={createWs.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-3xl bg-white/5 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            Failed to load workspaces. Please try refreshing.
          </div>
        )}

        {/* Workspaces Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((w) => {
            const isOwner = user?.$id === w.owner_id;
            return (
              <div key={w.$id} className="relative group">
                <Link
                  to={`/workspaces/${w.$id}/canvases`}
                  className="block h-32 p-6 rounded-3xl bg-card hover:bg-muted/50 border border-border transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-indigo-500/10 group-hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="text-lg font-semibold text-foreground dark:text-white tracking-wide truncate pr-16">
                        {w.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-1 w-full truncate">
                        {w.$id}
                      </div>
                    </div>
                    <div className="text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 flex items-center gap-1">
                      Open Workspace <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>

                {/* Owner Actions - Simplified to a single Settings button */}
                {isOwner && (
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setManagingMembersWs(w);
                      }}
                      className="p-2.5 rounded-xl bg-muted hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-500 hover:scale-110 active:scale-95 transition-all border border-border shadow-sm flex items-center gap-2"
                      title="Manage Workspace"
                    >
                      <Settings size={18} />
                      <span className="text-xs font-semibold pr-1">Manage</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && data?.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="text-white/20 text-xl font-medium">
                No workspaces yet. Create one to get started.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingWorkspace && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-background dark:bg-[#18181b] border border-border dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Rename Workspace</h3>
              <button
                onClick={() => setEditingWorkspace(null)}
                className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
                disabled={updateWs.isPending}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">
                  New Name
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Workspace name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editName.trim()) {
                      updateWs.mutate({
                        id: editingWorkspace.$id,
                        name: editName,
                      });
                    }
                  }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl"
                  onClick={() => setEditingWorkspace(null)}
                  disabled={updateWs.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                  onClick={() =>
                    updateWs.mutate({
                      id: editingWorkspace.$id,
                      name: editName,
                    })
                  }
                  disabled={!editName.trim() || updateWs.isPending}
                >
                  {updateWs.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Native UI Feel) */}
      {deletingWorkspace && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-background dark:bg-[#18181b] border border-red-500/20 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                Delete Workspace?
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="text-foreground font-semibold">
                  "{deletingWorkspace.name}"
                </span>
                ? This will also delete all canvases and objects within it. This
                action cannot be undone.
              </p>
              <div className="flex flex-col gap-3 pt-4">
                <Button
                  className="w-full rounded-2xl bg-red-600 hover:bg-red-500 py-6 text-lg font-bold shadow-lg shadow-red-600/20"
                  onClick={() => deleteWs.mutate(deletingWorkspace.$id)}
                  disabled={deleteWs.isPending}
                >
                  {deleteWs.isPending ? "Deleting..." : "Delete Everything"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full rounded-2xl text-muted-foreground hover:text-foreground"
                  onClick={() => setDeletingWorkspace(null)}
                  disabled={deleteWs.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteWs && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-background dark:bg-[#18181b] border border-border dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border dark:border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">
                Invite Member
              </h3>
              <button
                onClick={() => setInviteWs(null)}
                className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                disabled={inviteMember.isPending}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  User Email
                </label>
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Role
                </label>
                <div className="flex bg-muted/50 p-1 rounded-xl">
                  <button
                    onClick={() => setInviteRole("EDITOR")}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${inviteRole === "EDITOR" ? "bg-white dark:bg-zinc-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setInviteRole("VIEWER")}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${inviteRole === "VIEWER" ? "bg-white dark:bg-zinc-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Viewer
                  </button>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {inviteRole === "EDITOR"
                    ? "Can edit and delete canvases."
                    : "Can only view canvases."}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl"
                  onClick={() => setInviteWs(null)}
                  disabled={inviteMember.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                  onClick={() =>
                    inviteMember.mutate({
                      wsId: inviteWs.$id,
                      wsName: inviteWs.name,
                      email: inviteEmail,
                      role: inviteRole,
                    })
                  }
                  disabled={!inviteEmail.trim() || inviteMember.isPending}
                >
                  {inviteMember.isPending ? "Inviting..." : "Send Invite"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Manage Workspace Settings Modal (Consolidated) */}
      {managingMembersWs && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-background dark:bg-[#18181b] border border-border dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border dark:border-white/5 flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Settings className="text-indigo-500" />
                  Workspace Settings
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure{" "}
                  <span className="font-semibold text-foreground">
                    {managingMembersWs.name}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setManagingMembersWs(null)}
                className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid md:grid-cols-[1fr_2fr] h-[550px]">
              {/* Sidebar Tabs (Conceptual) */}
              <div className="border-r border-border dark:border-white/5 p-4 space-y-2 bg-muted/5">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">
                  Management
                </div>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 font-semibold text-sm">
                  <Users size={18} /> Members & Access
                </button>
                <button
                  onClick={() => {
                    setEditingWorkspace(managingMembersWs);
                    setEditName(managingMembersWs.name);
                    setManagingMembersWs(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted font-medium text-sm transition-colors"
                >
                  <Edit2 size={18} /> Rename Workspace
                </button>
                <div className="pt-4 mt-4 border-t border-border dark:border-white/5">
                  <button
                    onClick={() => {
                      setDeletingWorkspace(managingMembersWs);
                      setManagingMembersWs(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 font-medium text-sm transition-colors"
                  >
                    <Trash2 size={18} /> Delete Workspace
                  </button>
                </div>
              </div>

              {/* Main Content: Members & Invitations */}
              <div className="p-6 overflow-y-auto space-y-8">
                {/* Invite Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <UserPlus size={16} className="text-indigo-500" />
                    Invite New Member
                  </h4>
                  <div className="flex gap-2">
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1"
                    />
                    <Button
                      onClick={() =>
                        inviteMember.mutate({
                          wsId: managingMembersWs.$id,
                          wsName: managingMembersWs.name,
                          email: inviteEmail,
                          role: "EDITOR",
                        })
                      }
                      disabled={!inviteEmail.trim() || inviteMember.isPending}
                      className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6"
                    >
                      {inviteMember.isPending ? "..." : "Invite"}
                    </Button>
                  </div>
                </div>

                {/* Pending Invitations Section */}
                {pendingInvitations && pendingInvitations.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Mail size={16} className="text-amber-500" />
                      Pending Invitations
                    </h4>
                    <div className="space-y-3">
                      {pendingInvitations.map((inv: any) => (
                        <div
                          key={inv.$id}
                          className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 group hover:border-amber-500/30 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-sm">
                              <Mail size={20} />
                            </div>
                            <div>
                              <div className="text-sm font-bold leading-none">
                                {inv.invitee_email}
                              </div>
                              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-1">
                                Pending
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => revokeInvitation.mutate(inv.$id)}
                            disabled={revokeInvitation.isPending}
                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Revoke Invitation"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Member List Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Users size={18} className="text-indigo-500" />
                    Existing Members
                  </h4>
                  <div className="space-y-3">
                    {isLoadingMembers ? (
                      <div className="py-10 text-center text-muted-foreground animate-pulse">
                        Loading...
                      </div>
                    ) : (members ?? []).length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
                        No other members yet.
                      </div>
                    ) : (
                      (members ?? []).map((m: any) => (
                        <div
                          key={m.$id}
                          className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border group hover:border-indigo-500/30 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                              {m.profile?.name?.[0] ?? "?"}
                            </div>
                            <div>
                              <div className="text-sm font-bold flex items-center gap-1.5 leading-none">
                                {m.profile?.name ?? "Unknown"}
                                {m.role === "OWNER" && (
                                  <Shield
                                    size={14}
                                    className="text-amber-500"
                                  />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {m.profile?.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {m.role !== "OWNER" && (
                              <>
                                <button
                                  onClick={() =>
                                    updateMemberRole.mutate({
                                      id: m.$id,
                                      role:
                                        m.role === "EDITOR"
                                          ? "VIEWER"
                                          : "EDITOR",
                                    })
                                  }
                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                    m.role === "EDITOR"
                                      ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                                      : "bg-muted text-muted-foreground border-transparent"
                                  }`}
                                >
                                  {m.role}
                                </button>
                                <button
                                  onClick={() => removeMember.mutate(m.$id)}
                                  disabled={removeMember.isPending}
                                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                  title="Remove Member"
                                >
                                  <UserMinus size={18} />
                                </button>
                              </>
                            )}
                            {m.role === "OWNER" && (
                              <span className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest px-2">
                                Owner
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

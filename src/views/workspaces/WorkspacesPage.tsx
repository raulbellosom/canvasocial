import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ID, Query } from "appwrite";
import { Link } from "react-router-dom";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { useState } from "react";
import { Edit2, Trash2, X, AlertTriangle, ArrowRight } from "lucide-react";

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
            <div className="flex bg-muted/50 dark:bg-white/5 border border-border dark:border-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-2xl focus-within:bg-background dark:focus-within:bg-white/10 transition-colors">
              <input
                className="bg-transparent border-none outline-none text-foreground dark:text-white placeholder-muted-foreground px-4 py-2 w-full md:w-64"
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
                  className="block h-32 p-6 rounded-3xl bg-card dark:bg-white/5 hover:bg-accent/50 dark:hover:bg-white/10 border border-border dark:border-white/10 transition-all duration-300 backdrop-blur-sm group-hover:shadow-2xl group-hover:shadow-indigo-500/10 group-hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50">
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

                {/* Owner Actions */}
                {isOwner && (
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingWorkspace(w);
                        setEditName(w.name);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-indigo-500/20 text-white/50 hover:text-indigo-400 transition-all border border-white/5"
                      title="Edit Workspace"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingWorkspace(w);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all border border-white/5"
                      title="Delete Workspace"
                    >
                      <Trash2 size={16} />
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
              <h3 className="text-2xl font-bold">Delete Workspace?</h3>
              <p className="text-white/60 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="text-white font-semibold">
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
                  className="w-full rounded-2xl text-white/40 hover:text-white"
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
    </div>
  );
}

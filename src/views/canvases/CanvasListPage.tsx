import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ID, Query } from "appwrite";
import { Link, useParams } from "react-router-dom";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Canvas } from "../../lib/types";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { useState } from "react";
import { Edit2, Trash2, X, AlertTriangle, ArrowUpRight } from "lucide-react";

export function CanvasListPage() {
  const { workspaceId } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingCanvas, setEditingCanvas] = useState<Canvas | null>(null);
  const [deletingCanvas, setDeletingCanvas] = useState<Canvas | null>(null);
  const [editName, setEditName] = useState("");

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => account.get(),
  });

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaces,
        workspaceId,
      );
    },
    enabled: !!workspaceId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["canvases", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvases,
        [
          Query.equal("workspace_id", workspaceId),
          Query.equal("enabled", true),
          Query.orderDesc("$updatedAt"),
          Query.limit(50),
        ],
      );
      return res.documents as unknown as Canvas[];
    },
    enabled: !!workspaceId,
  });

  const createCanvas = useMutation({
    mutationFn: async (canvasName: string) => {
      if (!workspaceId) throw new Error("missing workspaceId");
      if (!user) throw new Error("Not logged in");
      const doc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvases,
        ID.unique(),
        {
          workspace_id: workspaceId,
          name: canvasName,
          created_by: user.$id,
          width: 1280,
          height: 720,
          snapshot_file_id: null,
          canvas_json: JSON.stringify({
            version: 1,
            objects: [],
            meta: { zoom: 1, pan: { x: 0, y: 0 } },
          }),
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
        appwriteConfig.collections.canvasMembers,
        ID.unique(),
        {
          canvas_id: doc.$id,
          user_id: user.$id,
          role: "OWNER",
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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["canvases", workspaceId] }),
  });

  const updateCanvas = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvases,
        id,
        { name },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["canvases", workspaceId] });
      setEditingCanvas(null);
    },
  });

  const deleteCanvas = useMutation({
    mutationFn: async (canvasId: string) => {
      // 1. Disable ops for this canvas
      const ops = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvasOps,
        [Query.equal("canvas_id", canvasId)],
      );

      for (const op of ops.documents) {
        await databases.updateDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.canvasOps,
          op.$id,
          { enabled: false },
        );
      }

      // 2. Disable canvas itself
      return await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvases,
        canvasId,
        { enabled: false },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["canvases", workspaceId] });
      setDeletingCanvas(null);
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link
                to="/workspaces"
                className="hover:text-white transition-colors"
              >
                Workspaces
              </Link>
              <span>/</span>
              <span className="text-gray-300 font-medium">
                {workspace?.name || workspaceId}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Canvases
            </h1>
            <p className="text-gray-400 font-medium max-w-lg">
              All your creative works in this workspace.
            </p>
          </div>

          <div className="w-full md:w-auto">
            <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-2xl focus-within:bg-white/10 transition-colors">
              <input
                className="bg-transparent border-none outline-none text-white placeholder-white/30 px-4 py-2 w-full md:w-64"
                placeholder="New canvas name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = name.trim();
                    if (v) {
                      setName("");
                      createCanvas.mutate(v);
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const v = name.trim();
                  if (v) {
                    setName("");
                    createCanvas.mutate(v);
                  }
                }}
                disabled={createCanvas.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-3xl bg-white/5 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Canvases Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((c) => {
            const isOwner = user?.$id === c.created_by;
            return (
              <div key={c.$id} className="relative group">
                <Link
                  to={`/canvases/${c.$id}`}
                  className="block h-40 p-6 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 backdrop-blur-sm group-hover:shadow-2xl group-hover:shadow-purple-500/10 group-hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>

                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="text-xl font-semibold text-white tracking-wide truncate pr-16">
                        {c.name}
                      </div>
                      <div className="text-xs text-white/30 mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500/50"></span>
                        Updated {new Date(c.$updatedAt!).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-linear-to-r from-indigo-500 to-purple-500 w-1/3 opacity-50 group-hover:opacity-100 transition-opacity"></div>
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
                        setEditingCanvas(c);
                        setEditName(c.name);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-purple-500/20 text-white/50 hover:text-purple-400 transition-all border border-white/5"
                      title="Edit Canvas"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingCanvas(c as any); // Type assertion for safety
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all border border-white/5"
                      title="Delete Canvas"
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
                No canvases yet. Start creating!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingCanvas && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Rename Canvas</h3>
              <button
                onClick={() => setEditingCanvas(null)}
                className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
                disabled={updateCanvas.isPending}
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
                  placeholder="Canvas name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editName.trim()) {
                      updateCanvas.mutate({
                        id: editingCanvas.$id,
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
                  onClick={() => setEditingCanvas(null)}
                  disabled={updateCanvas.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500"
                  onClick={() =>
                    updateCanvas.mutate({
                      id: editingCanvas.$id,
                      name: editName,
                    })
                  }
                  disabled={!editName.trim() || updateCanvas.isPending}
                >
                  {updateCanvas.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCanvas && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#18181b] border border-red-500/20 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold">Delete Canvas?</h3>
              <p className="text-white/60 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="text-white font-semibold">
                  "{deletingCanvas.name}"
                </span>
                ? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3 pt-4">
                <Button
                  className="w-full rounded-2xl bg-red-600 hover:bg-red-500 py-6 text-lg font-bold shadow-lg shadow-red-600/20"
                  onClick={() => deleteCanvas.mutate(deletingCanvas.$id)}
                  disabled={deleteCanvas.isPending}
                >
                  {deleteCanvas.isPending ? "Deleting..." : "Delete Canvas"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full rounded-2xl text-white/40 hover:text-white"
                  onClick={() => setDeletingCanvas(null)}
                  disabled={deleteCanvas.isPending}
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

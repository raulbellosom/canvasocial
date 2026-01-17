import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ID, Query } from "appwrite";
import { Link, useParams } from "react-router-dom";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Canvas } from "../../lib/types";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { useState } from "react";

type CanvasDoc = {
  $id: string;
  workspace_id: string;
  name: string;
  updated_at?: string;
  enabled?: boolean;
};

export function CanvasListPage() {
  const { workspaceId } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState("");

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
      const user = await account.get();
      const doc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.canvases,
        ID.unique(),
        {
          workspace_id: workspaceId,
          name: canvasName,
          created_by: user.$id,
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
      // Member entry (optional for MVP)
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

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
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
              <span className="text-gray-300 font-mono">{workspaceId}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent">
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
          {(data ?? []).map((c) => (
            <Link key={c.$id} to={`/canvases/${c.$id}`} className="group">
              <div className="h-40 p-6 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 backdrop-blur-sm group-hover:shadow-2xl group-hover:shadow-purple-500/10 group-hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </div>
                </div>

                <div>
                  <div className="text-xl font-semibold text-white tracking-wide truncate pr-8">
                    {c.name}
                  </div>
                  <div className="text-xs text-white/30 mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500/50"></span>
                    Updated {new Date(c.$updatedAt!).toLocaleDateString()}
                  </div>
                </div>

                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-1/3 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </Link>
          ))}

          {!isLoading && data?.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="text-white/20 text-xl font-medium">
                No canvases yet. Start creating!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ID, Query } from "appwrite";
import { Link } from "react-router-dom";
import { databases, appwriteConfig, account } from "../../lib/appwrite";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { useState } from "react";

type Workspace = {
  $id: string;
  name: string;
  owner_id: string;
  enabled?: boolean;
};

export function WorkspacesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const user = await account.get();
      // Owner workspaces OR memberships
      const owned = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaces,
        [
          Query.equal("owner_id", user.$id),
          Query.equal("enabled", true),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );
      const memberships = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.workspaceMembers,
        [
          Query.equal("user_id", user.$id),
          Query.equal("enabled", true),
          Query.limit(50),
        ],
      );
      const workspaceIds = memberships.documents.map(
        (m: any) => m.workspace_id,
      );
      let shared: any[] = [];
      if (workspaceIds.length) {
        // Appwrite supports Query.equal with array for "in" semantics
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
      const user = await account.get();
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
      // Add owner as member (useful for unified checks)
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

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Workspaces
            </h1>
            <p className="text-gray-400 font-medium max-w-lg">
              Manage your creative spaces. Create a new workspace or jump back
              into an existing one.
            </p>
          </div>

          <div className="w-full md:w-auto">
            <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-2xl focus-within:bg-white/10 transition-colors">
              <input
                className="bg-transparent border-none outline-none text-white placeholder-white/30 px-4 py-2 w-full md:w-64"
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
          {(data ?? []).map((w) => (
            <Link
              key={w.$id}
              to={`/workspaces/${w.$id}/canvases`}
              className="group"
            >
              <div className="h-32 p-6 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 backdrop-blur-sm group-hover:shadow-2xl group-hover:shadow-indigo-500/10 group-hover:-translate-y-1 relative overflow-hidden">
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
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white tracking-wide">
                      {w.name}
                    </div>
                    <div className="text-xs text-white/30 font-mono mt-1 w-full truncate">
                      {w.$id}
                    </div>
                  </div>
                  <div className="text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                    Open Workspace &rarr;
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && data?.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="text-white/20 text-xl font-medium">
                No workspaces yet. Create one to get started.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

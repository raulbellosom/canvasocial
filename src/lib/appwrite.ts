import { Client, Account, Databases, Storage, Functions } from "appwrite";

export const appwriteConfig = {
  endpoint:
    import.meta.env.VITE_APPWRITE_ENDPOINT ||
    "https://appwrite.racoondevs.com/v1",
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  collections: {
    profiles: import.meta.env.VITE_APPWRITE_COLLECTION_PROFILES,
    workspaces: import.meta.env.VITE_APPWRITE_COLLECTION_WORKSPACES,
    workspaceMembers: import.meta.env
      .VITE_APPWRITE_COLLECTION_WORKSPACE_MEMBERS,
    canvases: import.meta.env.VITE_APPWRITE_COLLECTION_CANVASES,
    canvasMembers: import.meta.env.VITE_APPWRITE_COLLECTION_CANVAS_MEMBERS,
    canvasOps: import.meta.env.VITE_APPWRITE_COLLECTION_CANVAS_OPS,
    canvasSessions: import.meta.env.VITE_APPWRITE_COLLECTION_CANVAS_SESSIONS,
    invitations: import.meta.env.VITE_APPWRITE_COLLECTION_INVITATIONS,
    notifications: import.meta.env.VITE_APPWRITE_COLLECTION_NOTIFICATIONS,
  },
  buckets: {
    avatars: import.meta.env.VITE_APPWRITE_BUCKET_AVATARS,
    canvasAssets: import.meta.env.VITE_APPWRITE_BUCKET_CANVAS_ASSETS,
    canvasSnapshots: import.meta.env.VITE_APPWRITE_BUCKET_CANVAS_SNAPSHOTS,
  },
};

export const client = new Client();
export const realtime = client;

client
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

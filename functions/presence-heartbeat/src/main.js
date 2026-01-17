import { Client, Databases, ID, Query } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new Databases(client);
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const COLL_SESSIONS = "canvas_sessions";

  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch {
    // Allow empty heartbeat if just checking/cleaning
  }

  const { canvasId } = payload || {};
  const userId = req.headers["x-appwrite-user-id"];

  if (userId && canvasId) {
    log(`Heartbeat user:${userId} canvas:${canvasId}`);
    try {
      // Check if session exists
      const sessions = await db.listDocuments(DATABASE_ID, COLL_SESSIONS, [
        Query.equal("canvas_id", canvasId),
        Query.equal("user_id", userId),
      ]);

      if (sessions.total > 0) {
        await db.updateDocument(
          DATABASE_ID,
          COLL_SESSIONS,
          sessions.documents[0].$id,
          {
            last_seen: new Date().toISOString(),
          },
        );
      } else {
        await db.createDocument(DATABASE_ID, COLL_SESSIONS, ID.unique(), {
          canvas_id: canvasId,
          user_id: userId,
          last_seen: new Date().toISOString(),
          device: "UNKNOWN", // Can parse User-Agent
          enabled: true,
        });
      }
    } catch (err) {
      error("Error updating session: " + err.message);
    }
  }

  // Cleanup old sessions (e.g. older than 2 mins)
  // This might be heavy if done on every heartbeat.
  // Optimization: Do it only if random() < 0.1 or rely on a separate cron.
  // We'll do a quick check here for this canvas or global if lightweight.

  return res.json({ success: true });
};

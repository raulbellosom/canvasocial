import { Client, Databases, Query } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new Databases(client);
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const COLL_OPS = "canvas_ops";

  // Delete ops older than 7 days
  const retentionDays = 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  try {
    log(`Cleaning ops older than ${cutoff.toISOString()}`);

    const ops = await db.listDocuments(DATABASE_ID, COLL_OPS, [
      Query.lessThan("ts", cutoff.toISOString()),
      Query.limit(100), // Delete in batches
    ]);

    log(`Found ${ops.total} old ops.`);

    const promises = ops.documents.map((op) =>
      db.deleteDocument(DATABASE_ID, COLL_OPS, op.$id),
    );

    await Promise.all(promises);

    return res.json({
      success: true,
      deleted: ops.documents.length,
    });
  } catch (err) {
    error("Cleanup failed: " + err.message);
    return res.json({ error: err.message }, 500);
  }
};

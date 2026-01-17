import { Client, Databases, ID, Query } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new Databases(client);
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const COLL_INVITATIONS = "invitations";

  // 1. Parse Input
  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch (e) {
    return res.json({ error: "Invalid JSON body" }, 400);
  }

  const { targetId, targetType, email, role } = payload;
  const userId = req.headers["x-appwrite-user-id"];

  if (!userId) {
    return res.json({ error: "Unauthorized" }, 401);
  }
  if (!targetId || !targetType || !email || !role) {
    return res.json({ error: "Missing required fields" }, 400);
  }

  try {
    // 2. (Optional) Validate permissions - Check if inviter has access to workspace/canvas
    // For MVP, we assume client-side check + backend trust, or we'd query workspace_members here.

    // 3. Create Invitation
    const invite = await db.createDocument(
      DATABASE_ID,
      COLL_INVITATIONS,
      ID.unique(),
      {
        target_id: targetId,
        target_type: targetType,
        invitee_email: email,
        role: role,
        status: "PENDING",
        invited_by: userId,
        enabled: true,
      },
    );

    // 4. Send Email (Mock or integration)
    log(`Created invitation ${invite.$id} for ${email}`);

    return res.json({
      success: true,
      invitation: invite,
    });
  } catch (err) {
    error("Failed to create invitation: " + err.message);
    return res.json({ error: "Internal Server Error" }, 500);
  }
};

import { Client, Databases, ID, Query } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new Databases(client);
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const COLL_INVITATIONS = "invitations";
  const COLL_WORKSPACE_MEMBERS = "workspace_members";
  const COLL_CANVAS_MEMBERS = "canvas_members";

  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch {
    return res.json({ error: "Invalid JSON" }, 400);
  }

  const { inviteId, action } = payload; // action: 'accept' | 'decline'
  const userId = req.headers["x-appwrite-user-id"];

  if (!userId || !inviteId || !action) {
    return res.json({ error: "Missing params" }, 400);
  }

  try {
    // 1. Get Invitation
    const invite = await db.getDocument(
      DATABASE_ID,
      COLL_INVITATIONS,
      inviteId,
    );

    if (invite.status !== "PENDING") {
      return res.json({ error: "Invitation already processed" }, 400);
    }

    // Optional: Check if email matches user email (if you fetch user email)

    if (action === "decline") {
      await db.updateDocument(DATABASE_ID, COLL_INVITATIONS, inviteId, {
        status: "DECLINED",
      });
      return res.json({ success: true, status: "DECLINED" });
    }

    if (action === "accept") {
      // 2. Create Membership
      if (invite.target_type === "WORKSPACE") {
        await db.createDocument(
          DATABASE_ID,
          COLL_WORKSPACE_MEMBERS,
          ID.unique(),
          {
            workspace_id: invite.target_id,
            user_id: userId,
            role: invite.role,
            invited_by: invite.invited_by,
            enabled: true,
          },
        );
      } else if (invite.target_type === "CANVAS") {
        await db.createDocument(DATABASE_ID, COLL_CANVAS_MEMBERS, ID.unique(), {
          canvas_id: invite.target_id,
          user_id: userId,
          role: invite.role,
          enabled: true,
        });
      }

      // 3. Update Invite
      await db.updateDocument(DATABASE_ID, COLL_INVITATIONS, inviteId, {
        status: "ACCEPTED",
        invitee_user: userId,
      });

      return res.json({ success: true, status: "ACCEPTED" });
    }

    return res.json({ error: "Invalid action" }, 400);
  } catch (err) {
    error(err.message);
    return res.json({ error: err.message }, 500);
  }
};

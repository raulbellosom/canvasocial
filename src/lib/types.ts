export type Role = "OWNER" | "EDITOR" | "VIEWER";
export type DeviceType = "MOBILE" | "DESKTOP" | "TABLET" | "UNKNOWN";
export type OpType = "ADD" | "UPDATE" | "DELETE" | "REORDER" | "META";
export type InvitationTargetType = "WORKSPACE" | "CANVAS";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
export type NotificationType = "INVITE" | "SYSTEM" | "CANVAS_ACTIVITY";

export interface UserProfile {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  user_auth_id: string;
  email: string;
  name: string;
  avatar_file_id?: string;
  enabled: boolean;
}

export interface Workspace {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  owner_id: string;
  enabled: boolean;
}

export interface WorkspaceMember {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  invited_by?: string;
  enabled: boolean;
}

export interface Canvas {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  workspace_id: string;
  name: string;
  created_by: string;
  snapshot_file_id?: string;
  canvas_json: string; // JSON string
  is_public: boolean;
  enabled: boolean;
}

export interface CanvasMember {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  canvas_id: string;
  user_id: string;
  role: Role;
  enabled: boolean;
}

export interface CanvasOp {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  canvas_id: string;
  op_type: OpType;
  object_id?: string;
  payload_json: string; // JSON string
  actor_id: string;
  ts: string; // datetime
  enabled: boolean;
}

export interface CanvasSession {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  canvas_id: string;
  user_id: string;
  last_seen: string;
  device?: DeviceType;
  enabled: boolean;
}

export interface Invitation {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  target_type: InvitationTargetType;
  target_id: string;
  invitee_email: string;
  invitee_user?: string;
  role: Role;
  status: InvitationStatus;
  invited_by: string;
  expires_at?: string;
  enabled: boolean;
}

export interface Notification {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  payload_json?: string;
  is_read: boolean;
  enabled: boolean;
}

export type CanvasObjectType =
  | "rect"
  | "circle"
  | "line"
  | "arrow"
  | "text"
  | "image"
  | "pen"
  | "path";

export type CanvasObjectBase = {
  id: string;
  type: CanvasObjectType;
  name?: string;
  layerId?: string; // New: Link to layer
  z: number;
  visible: boolean;
  locked: boolean;
  updated_at: string;
  updated_by: string;
};

export type RectObject = CanvasObjectBase & {
  type: "rect";
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  angle: number;
};
export type CircleObject = CanvasObjectBase & {
  type: "circle";
  left: number;
  top: number;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};
export type TextObject = CanvasObjectBase & {
  type: "text";
  left: number;
  top: number;
  text: string;
  fontSize: number;
  fill: string;
};
export type PathObject = CanvasObjectBase & {
  type: "path";
  path: any[];
  stroke: string;
  strokeWidth: number;
  left: number;
  top: number;
};
export type ImageObject = CanvasObjectBase & {
  type: "image";
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  fileId: string;
  url: string;
};

// Loose type for now to match Fabric's object model more closely (left/top vs x/y)
export type CanvasObject =
  | RectObject
  | CircleObject
  | TextObject
  | PathObject
  | ImageObject
  | CanvasObjectBase;

export type CanvasLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  zIndex: number; // For ordering layers themselves
};

export type CanvasState = {
  version: number;
  width: number;
  height: number;
  bgColor: string;
  bgFileId?: string;
  layers: CanvasLayer[];
  objects: CanvasObject[];
  meta: { zoom: number; pan: { x: number; y: number } };
};

export type CanvasOp = {
  $id?: string;
  op_type: "add" | "update" | "delete" | "reorder" | "meta";
  object_id?: string;
  payload_json: string;
  actor_id: string;
  ts?: string;
};

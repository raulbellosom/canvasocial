import { useEffect, useState, useCallback } from "react";
import { ID, Query } from "appwrite";
import { databases, appwriteConfig, client, account } from "../../lib/appwrite";
import type { CanvasState, CanvasOp, CanvasLayer } from "./types";

export function useRealtimeCanvas(canvasId: string | undefined) {
  const [state, setState] = useState<CanvasState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastRemoteOp, setLastRemoteOp] = useState<CanvasOp | null>(null);

  // 1. Init User & Load Snapshot
  useEffect(() => {
    async function init() {
      try {
        const user = await account.get();
        setUserId(user.$id);
      } catch {
        console.warn("No user logged in");
      }
    }
    init();
  }, []);

  // 2. Load Sync & Subscribe
  useEffect(() => {
    if (!canvasId) return;

    // Load initial state
    async function fetchCanvas() {
      try {
        const doc = await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.canvases,
          canvasId as string,
        );

        // Base State
        const baseState: CanvasState = {
          version: 1,
          width: doc.width || 1280,
          height: doc.height || 720,
          bgColor: doc.bg_color || "#ffffff",
          bgFileId: doc.bg_file_id,
          layers: JSON.parse(doc.canvas_json || "{}").layers || [
            {
              id: "layer1",
              name: "Layer 1",
              visible: true,
              locked: false,
              zIndex: 0,
            },
          ],
          objects: JSON.parse(doc.canvas_json || "{}").objects || [],
          meta: { zoom: 1, pan: { x: 0, y: 0 } },
        };

        // Fetch pending operations (those not yet consolidated)
        const ops = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.canvasOps,
          [
            Query.equal("canvas_id", canvasId as string),
            Query.equal("enabled", true),
            Query.orderAsc("ts"),
            Query.limit(100), // Adjust limit if needed
          ],
        );

        // Filter out operations that might have been already consolidated
        // (Assuming consolidation function updates $updatedAt or uses a flag)
        // For now, we apply ALL enabled ops as a safety measure

        // Use a temporary updater to apply all ops to the base state
        let currentState = baseState;
        ops.documents.forEach((docOp: any) => {
          const op = docOp as CanvasOp;
          currentState = applyOpToPureState(currentState, op);
        });

        setState(currentState);
      } catch (error) {
        console.error("Error fetching initial canvas state and ops:", error);
      }
    }
    fetchCanvas();

    // Subscribe to ops
    const unsubscribe = client.subscribe(
      `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.canvasOps}.documents`,
      (response) => {
        if (
          response.events.includes(
            "databases.*.collections.*.documents.*.create",
          )
        ) {
          const op = response.payload as CanvasOp;
          setLastRemoteOp(op);
          applyOpToState(setState, op);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [canvasId]);

  // 3. Queue Op
  const queueOp = useCallback(
    async (op: Omit<CanvasOp, "$id" | "actor_id">) => {
      if (!userId || !canvasId) return;

      try {
        await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.canvasOps,
          ID.unique(),
          {
            ...op,
            actor_id: userId,
            canvas_id: canvasId,
            ts: new Date().toISOString(),
          },
        );
        // Optimistic update
        const fullOp = {
          ...op,
          $id: "temp",
          actor_id: userId,
          canvas_id: canvasId || "",
        } as CanvasOp;
        applyOpToState(setState, fullOp);
      } catch (err) {
        console.error("Failed to queue op", err);
      }
    },
    [canvasId, userId],
  );

  return { state, userId, queueOp, lastRemoteOp };
}

/**
 * Pure function to apply a CanvasOp to a CanvasState.
 * Used for both initial consolidation of pending ops and realtime updates.
 */
export function applyOpToPureState(
  prev: CanvasState,
  doc: CanvasOp,
): CanvasState {
  const next = {
    ...prev,
    objects: [...prev.objects],
    layers: [...(prev.layers || [])],
  };

  let payload: any = {};
  try {
    payload = JSON.parse(doc.payload_json || "{}");
  } catch (e) {
    console.error("Failed to parse payload_json", e);
    return prev;
  }

  const isLayerOp = payload.type === "layer";

  if (doc.op_type === "add") {
    if (isLayerOp) {
      if (
        payload.layer &&
        !next.layers.find((l) => l.id === payload.layer.id)
      ) {
        next.layers.push(payload.layer);
      }
    } else {
      if (
        payload.object &&
        !next.objects.find((o) => o.id === payload.object.id)
      ) {
        next.objects.push(payload.object);
      }
    }
  } else if (doc.op_type === "update") {
    if (isLayerOp) {
      const idx = next.layers.findIndex((l) => l.id === doc.object_id);
      if (idx !== -1 && payload.patch) {
        next.layers[idx] = { ...next.layers[idx], ...payload.patch };
      }
    } else {
      const idx = next.objects.findIndex((o) => o.id === doc.object_id);
      if (idx !== -1 && payload.patch) {
        next.objects[idx] = { ...next.objects[idx], ...payload.patch };
      }
    }
  } else if (doc.op_type === "delete") {
    if (isLayerOp) {
      next.layers = next.layers.filter((l) => l.id !== doc.object_id);
    } else {
      next.objects = next.objects.filter((o) => o.id !== doc.object_id);
    }
  } else if (doc.op_type === "reorder") {
    if (isLayerOp && typeof payload.index === "number") {
      const idx = next.layers.findIndex((l) => l.id === doc.object_id);
      if (idx !== -1) {
        const [moved] = next.layers.splice(idx, 1);
        next.layers.splice(payload.index, 0, moved);
      }
    }
  } else if (doc.op_type === "meta") {
    if (payload.width) next.width = payload.width;
    if (payload.height) next.height = payload.height;
    if (payload.bgColor) next.bgColor = payload.bgColor;
    if (payload.bgFileId) next.bgFileId = payload.bgFileId;
  }

  return next;
}

/**
 * Wrapper for applyOpToPureState that updates React state.
 */
function applyOpToState(
  setState: React.Dispatch<React.SetStateAction<CanvasState | null>>,
  doc: CanvasOp,
) {
  setState((prev) => (prev ? applyOpToPureState(prev, doc) : null));
}

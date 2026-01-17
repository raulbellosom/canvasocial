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

    // Load initial state (mock for now, or fetch from DB if we stored snapshots)
    setState({
      version: 1,
      layers: [
        {
          id: "layer1",
          name: "Layer 1",
          visible: true,
          locked: false,
          zIndex: 0,
        },
      ],
      objects: [],
      meta: { zoom: 1, pan: { x: 0, y: 0 } },
    });

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

function applyOpToState(
  setState: React.Dispatch<React.SetStateAction<CanvasState | null>>,
  doc: CanvasOp,
) {
  setState((prev) => {
    if (!prev) return null;
    const next = {
      ...prev,
      objects: [...prev.objects],
      layers: [...(prev.layers || [])],
    };
    const payload = JSON.parse(doc.payload_json || "{}");

    // Helper to check if op targets a layer
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
    }
    return next;
  });
}

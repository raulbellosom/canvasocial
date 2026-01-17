import { useState, useEffect } from "react";
import * as fabric from "fabric";
import { Button } from "../../ui/Button";
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { CanvasLayer } from "./types";
import { ID } from "appwrite";

interface LayersPanelProps {
  canvas: fabric.Canvas | null;
  layers: CanvasLayer[];
  activeLayerId: string;
  setActiveLayerId: (id: string) => void;
  queueOp: (op: any) => void;
}

export function LayersPanel({
  canvas,
  layers,
  activeLayerId,
  setActiveLayerId,
  queueOp,
}: LayersPanelProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768; // Open by default only on Desktop
    }
    return false;
  });

  const addLayer = () => {
    const id = ID.unique();
    const newLayer: CanvasLayer = {
      id,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      zIndex: layers.length,
    };
    queueOp({
      op_type: "add",
      payload_json: JSON.stringify({ type: "layer", layer: newLayer }),
    });
    setActiveLayerId(id);
  };

  const toggleVisibility = (layer: CanvasLayer) => {
    const patch = { visible: !layer.visible };
    // Optimistic / Queue
    queueOp({
      op_type: "update",
      object_id: layer.id,
      payload_json: JSON.stringify({ type: "layer", patch }),
    });

    // Immediate Fabric update
    if (!canvas) return;
    canvas.getObjects().forEach((obj: any) => {
      if (obj.layerId === layer.id) {
        obj.set({ visible: patch.visible });
      }
    });
    canvas.requestRenderAll();
  };

  const toggleLock = (layer: CanvasLayer) => {
    const patch = { locked: !layer.locked };
    queueOp({
      op_type: "update",
      object_id: layer.id,
      payload_json: JSON.stringify({ type: "layer", patch }),
    });

    if (!canvas) return;
    canvas.getObjects().forEach((obj: any) => {
      if (obj.layerId === layer.id) {
        obj.set({ selectable: !patch.locked, evented: !patch.locked });
      }
    });
    canvas.requestRenderAll();
  };

  const deleteLayer = (id: string) => {
    // Prevent deleting last layer
    if (layers.length <= 1) return;

    queueOp({
      op_type: "delete",
      object_id: id,
      payload_json: JSON.stringify({ type: "layer" }),
    });
    // Also delete all objects in this layer?
    // For V2, yes, let's assume cascade delete or specialized op.
    // For now, we just delete the layer entry. Objects will become orphans or hidden.
    // Better to delete objects too.
    if (canvas) {
      const toRemove = canvas.getObjects().filter((o: any) => o.layerId === id);
      toRemove.forEach((o) => {
        canvas.remove(o);
        // queue delete op for object?
        // YES, strictly.
      });
    }
    if (activeLayerId === id) {
      setActiveLayerId(layers[0].id);
    }
  };

  if (!isOpen) {
    return (
      <div className="absolute top-4 right-4 z-10">
        <Button
          size="sm"
          className="h-10 w-10 bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 rounded-xl"
          onClick={() => setIsOpen(true)}
        >
          <Layers size={20} />
        </Button>
      </div>
    );
  }

  // Sync objects for listing
  const [layerObjects, setLayerObjects] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!canvas) return;
    const updateObjects = () => {
      const objs = canvas.getObjects();
      const map: Record<string, any[]> = {};
      objs.forEach((o: any) => {
        const lid = o.layerId || "unknown";
        if (!map[lid]) map[lid] = [];
        map[lid].push(o);
      });
      // Reverse to show top-most first in list
      Object.keys(map).forEach((k) => map[k].reverse());
      setLayerObjects(map);
    };

    canvas.on("object:added", updateObjects);
    canvas.on("object:removed", updateObjects);
    // canvas.on("object:modified", updateObjects); // update on modify if needed (e.g. name change)

    updateObjects();
    return () => {
      canvas.off("object:added", updateObjects);
      canvas.off("object:removed", updateObjects);
    };
  }, [canvas]);

  const moveLayer = (index: number, direction: "up" | "down") => {
    // index is current index in 'sorted' array.
    // sorted is descending zIndex.
    // direction up means higher zIndex (lower index in sorted array)

    const newSorted = [...sorted];
    if (direction === "up") {
      if (index === 0) return; // Already top
      const temp = newSorted[index];
      newSorted[index] = newSorted[index - 1];
      newSorted[index - 1] = temp;
    } else {
      if (index === newSorted.length - 1) return; // Already bottom
      const temp = newSorted[index];
      newSorted[index] = newSorted[index + 1];
      newSorted[index + 1] = temp;
    }

    // Now we have new order. Reassign zIndex based on new order.
    // sorted[0] gets highest zIndex.
    // length - 1 - i
    newSorted.forEach((l, i) => {
      const newZ = newSorted.length - 1 - i;
      if (l.zIndex !== newZ) {
        queueOp({
          op_type: "update",
          object_id: l.id,
          payload_json: JSON.stringify({
            type: "layer",
            patch: { zIndex: newZ },
          }),
        });
      }
    });
  };

  // Sort layers by zIndex descending (Top first)
  const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] transition-all">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2 font-medium text-sm text-white/90">
          <Layers size={16} className="text-indigo-400" /> Layers
        </div>
        <div className="flex gap-1">
          <button
            onClick={addLayer}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
            title="New Layer"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {sorted.map((layer, index) => (
          <div key={layer.id} className="flex flex-col">
            <div
              onClick={() => setActiveLayerId(layer.id)}
              className={`flex items-center justify-between p-3 rounded-xl text-sm cursor-pointer border transition-all group ${
                activeLayerId === layer.id
                  ? "bg-indigo-500/10 border-indigo-500/30 shadow-[inset_0_0_10px_rgba(99,102,241,0.1)]"
                  : "border-transparent hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex flex-col gap-0.5">
                  <button
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(index, "up");
                    }}
                    className="text-white/20 hover:text-white disabled:opacity-0"
                  >
                    <ArrowUp size={10} />
                  </button>
                  <button
                    disabled={index === sorted.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(index, "down");
                    }}
                    className="text-white/20 hover:text-white disabled:opacity-0"
                  >
                    <ArrowDown size={10} />
                  </button>
                </div>
                <span
                  className={`truncate max-w-[100px] font-medium ${activeLayerId === layer.id ? "text-indigo-300" : "text-zinc-400 group-hover:text-zinc-200"}`}
                >
                  {layer.name}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(layer);
                  }}
                  className={`p-1.5 rounded hover:bg-white/10 ${layer.visible ? "text-white/70" : "text-white/30"}`}
                  title={layer.visible ? "Hide" : "Show"}
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(layer);
                  }}
                  className={`p-1.5 rounded hover:bg-white/10 ${layer.locked ? "text-amber-400" : "text-white/30"}`}
                  title={layer.locked ? "Unlock" : "Lock"}
                >
                  {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(layer.id);
                  }}
                  className="p-1.5 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 rounded transition"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Objects List */}
            {layerObjects[layer.id] && layerObjects[layer.id].length > 0 && (
              <div className="pl-6 mt-1 space-y-0.5 border-l border-white/5 ml-4">
                {layerObjects[layer.id].map((obj: any, idx) => {
                  const isDetailed = activeLayerId === layer.id; // Show details if layer active
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs text-zinc-300 hover:text-white px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer group/item border border-transparent hover:border-white/5 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canvas) {
                          canvas.setActiveObject(obj);
                          canvas.requestRenderAll();
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="opacity-50 text-[10px] w-4 text-center">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[80px]">
                          {obj.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        {/* Object Controls */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            obj.bringForward();
                            canvas?.requestRenderAll();
                            // TODO: sync Z order
                            queueOp({
                              op_type: "reorder",
                              object_id: obj.name,
                              payload_json: JSON.stringify({
                                index: canvas?.getObjects().indexOf(obj),
                              }),
                            });
                          }}
                          className="p-1 hover:bg-white/20 rounded text-white/50 hover:text-white"
                          title="Bring Forward"
                        >
                          <ArrowUp size={10} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            obj.sendBackwards();
                            canvas?.requestRenderAll();
                            queueOp({
                              op_type: "reorder",
                              object_id: obj.name,
                              payload_json: JSON.stringify({
                                index: canvas?.getObjects().indexOf(obj),
                              }),
                            });
                          }}
                          className="p-1 hover:bg-white/20 rounded text-white/50 hover:text-white"
                          title="Send Backward"
                        >
                          <ArrowDown size={10} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            obj.set({ visible: !obj.visible });
                            obj.setCoords();
                            canvas?.requestRenderAll();
                            queueOp({
                              op_type: "update",
                              object_id: obj.name,
                              payload_json: JSON.stringify({
                                patch: { visible: obj.visible },
                              }),
                            });
                          }}
                          className={`p-1 hover:bg-white/20 rounded ${obj.visible ? "text-white/50" : "text-white/30"}`}
                        >
                          {obj.visible ? (
                            <Eye size={10} />
                          ) : (
                            <EyeOff size={10} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            obj.set({
                              selectable: !obj.lockMovementX,
                              evented: !obj.lockMovementX,
                            });
                            // Fabric lock implies lockMovementX/Y etc.
                            // Simplified: just toggle 'selectable'
                            const locked = !obj.selectable;
                            obj.set({ selectable: !locked, evented: !locked });
                            canvas?.requestRenderAll();
                            queueOp({
                              op_type: "update",
                              object_id: obj.name,
                              payload_json: JSON.stringify({
                                patch: { locked: locked },
                              }),
                            });
                          }}
                          className={`p-1 hover:bg-white/20 rounded ${!obj.selectable ? "text-amber-400" : "text-white/50"}`}
                        >
                          {!obj.selectable ? (
                            <Lock size={10} />
                          ) : (
                            <Unlock size={10} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {layers.length === 0 && (
          <div className="text-center py-8 text-xs text-white/30">
            No layers
          </div>
        )}
      </div>
    </div>
  );
}

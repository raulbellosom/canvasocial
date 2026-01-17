import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { useRealtimeCanvas } from "./useRealtimeCanvas";
import * as fabric from "fabric";
import { ID } from "appwrite";

import {
  MousePointer2,
  Square,
  Circle as CircleIcon,
  Type,
  Pen,
  Eraser,
  Trash2,
  Image as ImageIcon,
  Hand,
} from "lucide-react";
import { LayersPanel } from "./LayersPanel";
import { ContextMenu, ContextMenuAction } from "./ContextMenu";
import { ColorPickerPopover } from "./ColorPickerPopover";

type Tool = "select" | "rect" | "circle" | "text" | "pen" | "hand";

export function CanvasEditorPage() {
  const { canvasId } = useParams();
  const { state, userId, queueOp, lastRemoteOp } = useRealtimeCanvas(canvasId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer1"); // Default
  const [activeColor, setActiveColor] = useState<string>("#000000");
  const [activeStrokeColor, setActiveStrokeColor] = useState<string>("#000000");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    targetId?: string;
    type?: string;
    locked?: boolean;
    visibleLayer?: boolean;
  } | null>(null);

  // Auto-select first layer if active is missing
  useEffect(() => {
    if (state?.layers && state.layers.length > 0) {
      if (!state.layers.find((l) => l.id === activeLayerId)) {
        setActiveLayerId(state.layers[0].id);
      }
    }
  }, [state?.layers, activeLayerId]);

  // Initialize Fabric
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || fabricCanvas) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#f3f4f6",
      selection: true,
    });

    setFabricCanvas(canvas);

    // Resize logic
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      canvas.setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(containerRef.current);

    // Zoom Logic
    canvas.on("mouse:wheel", function (opt) {
      if (opt.e.ctrlKey) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY } as any, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      }
    });

    // Panning Logic (Hand Tool)
    // Panning Logic (Hand Tool)
    canvas.on("mouse:down", function (opt) {
      const evt = opt.e as MouseEvent;
      const target = canvas as any;

      // Handle Right Click (Context Menu)
      if ((opt as any).button === 3 || evt.button === 2) {
        evt.preventDefault();
        const activeObj = opt.target as any;
        if (activeObj) {
          if (canvas.getActiveObject() !== activeObj) {
            canvas.setActiveObject(activeObj);
            canvas.requestRenderAll();
          }
          setContextMenu({
            x: evt.clientX,
            y: evt.clientY,
            visible: true,
            targetId: activeObj.name,
            type: activeObj.type,
            locked: !activeObj.evented,
            visibleLayer: activeObj.visible,
          });
          return;
        }
      }

      // Panning Mode
      if (target.defaultCursor === "grab") {
        target.isDragging = true;
        target.selection = false;
        target.lastPosX = evt.clientX;
        target.lastPosY = evt.clientY;
      }
    });

    canvas.on("mouse:move", function (opt) {
      const target = canvas as any;
      if (target.isDragging) {
        const e = opt.e as MouseEvent;
        const vpt = target.viewportTransform;
        if (vpt) {
          vpt[4] += e.clientX - target.lastPosX;
          vpt[5] += e.clientY - target.lastPosY;
          target.requestRenderAll();
        }
        target.lastPosX = e.clientX;
        target.lastPosY = e.clientY;
      }
    });

    canvas.on("mouse:up", function (opt) {
      const target = canvas as any;
      if (target.isDragging) {
        target.setViewportTransform(target.viewportTransform);
        target.isDragging = false;
        target.selection = true;
      }
    });

    // Events
    canvas.on("selection:created", (e) => {
      const active = e.selected?.[0] as any;
      if (active) {
        setSelectedId(active.name || null);
        if (active.fill && typeof active.fill === "string")
          setActiveColor(active.fill);
      }
    });
    canvas.on("selection:cleared", () => setSelectedId(null));
    canvas.on("selection:updated", (e) => {
      const active = e.selected?.[0] as any;
      if (active) {
        setSelectedId(active.name || null);
        if (active.fill && typeof active.fill === "string")
          setActiveColor(active.fill);
      }
    });

    canvas.on("object:modified", (e) => {
      const target = e.target as any;
      if (!target || !target.name) return; // Missing ID

      // Serialize change and queue op
      const patch: any = {
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
        fill: target.fill,
      };

      if (target.type === "text" || target.type === "i-text") {
        patch.text = (target as any).text;
        patch.fontSize = (target as any).fontSize;
      }

      queueOp({
        op_type: "update",
        object_id: target.name,
        payload_json: JSON.stringify({ patch }),
      });
    });

    // Handle Path Creation (Free Draw)
    canvas.on("path:created", (e: any) => {
      const path = e.path;
      if (!path) return;
      const id = ID.unique();
      path.set({ name: id });
      (path as any).layerId = activeLayerId;

      // We need to serialize the path data
      // Fabric path object has .path property which is array of commands
      const canvasObj = {
        id,
        type: "path", // Changed from pen
        layerId: activeLayerId,
        z: 0,
        visible: true,
        locked: false,
        updated_at: new Date().toISOString(),
        updated_by: userId ?? "unknown",
        path: path.path, // We store the SVG path commands
        stroke: path.stroke,
        strokeWidth: path.strokeWidth,
        left: path.left,
        top: path.top,
      };

      queueOp({
        op_type: "add",
        object_id: id,
        payload_json: JSON.stringify({ object: canvasObj }),
      });
    });

    return () => {
      canvas.dispose();
      ro.disconnect();
    };
  }, []);

  // Sync Initial State
  useEffect(() => {
    if (!fabricCanvas || !state || state.objects.length === 0) return;
    if (fabricCanvas.getObjects().length === 0) {
      state.objects.forEach((obj) => {
        addFabricObject(fabricCanvas, obj, false);
      });
      // Apply layer visibility/locks
      state.layers?.forEach((layer) => {
        fabricCanvas.getObjects().forEach((o: any) => {
          if (o.layerId === layer.id) {
            o.set({
              visible: layer.visible,
              selectable: !layer.locked,
              evented: !layer.locked,
            });
          }
        });
      });
      fabricCanvas.requestRenderAll();
    }
  }, [fabricCanvas, state]); // Run once when both available (and state loaded)

  // Sync Remote Ops
  useEffect(() => {
    if (!fabricCanvas || !lastRemoteOp) return;
    // Apply op
    const op = lastRemoteOp;
    const payload = JSON.parse(op.payload_json || "{}");

    if (op.op_type === "add") {
      const obj = payload.object;
      if (!obj) return;
      if (fabricCanvas.getObjects().find((o: any) => o.name === obj.id)) return; // Already exists
      addFabricObject(fabricCanvas, obj, false);
    } else if (op.op_type === "update") {
      const obj = fabricCanvas
        .getObjects()
        .find((o: any) => o.name === op.object_id);
      if (obj && payload.patch) {
        obj.set(payload.patch);
        obj.setCoords();
        fabricCanvas.requestRenderAll();
      }
    } else if (op.op_type === "delete") {
      const obj = fabricCanvas
        .getObjects()
        .find((o: any) => o.name === op.object_id);
      if (obj) {
        fabricCanvas.remove(obj);
        fabricCanvas.requestRenderAll();
      }
    } else if (op.op_type === "reorder") {
      const obj = fabricCanvas
        .getObjects()
        .find((o: any) => o.name === op.object_id);
      if (obj && typeof payload.index === "number") {
        (obj as any).moveTo(payload.index);
        fabricCanvas.requestRenderAll();
      }
    }
  }, [lastRemoteOp, fabricCanvas]);

  const addRect = () => {
    if (!fabricCanvas || !userId) return;
    const id = ID.unique();
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: "red",
      name: id,
    });
    (rect as any).layerId = activeLayerId; // Assign Layer
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);

    // Queue Add Op
    const canvasObj = {
      id,
      type: "rect",
      layerId: activeLayerId,
      z: 0,
      visible: true,
      locked: false,
      updated_at: new Date().toISOString(),
      updated_by: userId,
      x: 100,
      y: 100,
      w: 100,
      h: 100,
      fill: "red",
      stroke: "black",
      strokeWidth: 0,
      rotation: 0,
    };
    queueOp({
      op_type: "add",
      object_id: id,
      payload_json: JSON.stringify({ object: canvasObj }),
    });
    setTool("select"); // Auto-switch back to select
  };

  const addCircle = () => {
    if (!fabricCanvas || !userId) return;
    const id = ID.unique();
    const circle = new fabric.Circle({
      left: 200,
      top: 200,
      radius: 50,
      fill: "green",
      name: id,
    });
    (circle as any).layerId = activeLayerId;
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);

    const canvasObj = {
      id,
      type: "circle",
      layerId: activeLayerId,
      z: 0,
      visible: true,
      locked: false,
      updated_at: new Date().toISOString(),
      updated_by: userId,
      left: 200,
      top: 200,
      radius: 50,
      fill: "green",
      stroke: "",
      strokeWidth: 0,
    };
    queueOp({
      op_type: "add",
      object_id: id,
      payload_json: JSON.stringify({ object: canvasObj }),
    });
    setTool("select");
  };

  const addText = () => {
    if (!fabricCanvas || !userId) return;
    const id = ID.unique();
    const text = new fabric.IText("Hello", {
      left: 300,
      top: 300,
      fontFamily: "Inter, sans-serif",
      fill: "#333",
      fontSize: 24,
      name: id,
    });
    (text as any).layerId = activeLayerId;
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);

    const canvasObj = {
      id,
      type: "text",
      layerId: activeLayerId,
      z: 0,
      visible: true,
      locked: false,
      updated_at: new Date().toISOString(),
      updated_by: userId,
      left: 300,
      top: 300,
      text: "Hello",
      fontSize: 24,
      fill: "#333",
    };
    queueOp({
      op_type: "add",
      object_id: id,
      payload_json: JSON.stringify({ object: canvasObj }),
    });
    setTool("select");
  };

  // Toggle Drawing/Hand Mode
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = tool === "pen";

    if (tool === "pen") {
      fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
      fabricCanvas.freeDrawingBrush.width = 5;
      fabricCanvas.freeDrawingBrush.color = "black";
      fabricCanvas.defaultCursor = "default";
      fabricCanvas.selection = true;
    } else if (tool === "hand") {
      fabricCanvas.defaultCursor = "grab";
      fabricCanvas.selection = false;
      // Disable object selection while panning
      fabricCanvas.getObjects().forEach((obj) => {
        obj.selectable = false;
        obj.evented = false; // Prevent drag
      });
    } else {
      fabricCanvas.defaultCursor = "default";
      fabricCanvas.selection = true;
      // Re-enable object selection
      // Note: We might need to check layer locks here really, but for now enable all
      fabricCanvas.getObjects().forEach((obj) => {
        // Check layer lock from state if possible? Or just re-apply simple logic
        // For now, assume unlocked if switching back.
        // Ideally we check state.layers again.
        obj.selectable = true;
        obj.evented = true;
      });
    }
    fabricCanvas.requestRenderAll();
  }, [tool, fabricCanvas]);

  const deleteSelected = () => {
    if (!fabricCanvas || !selectedId) return;
    const obj = fabricCanvas
      .getObjects()
      .find((o: any) => o.name === selectedId);
    if (obj) {
      fabricCanvas.remove(obj);
      queueOp({ op_type: "delete", object_id: selectedId, payload_json: "{}" });
      setSelectedId(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas || !userId) return;

    try {
      const { storage, appwriteConfig } = await import("../../lib/appwrite");
      // Upload to storage
      const upload = await storage.createFile(
        appwriteConfig.buckets.canvasAssets,
        ID.unique(),
        file,
      );

      const fileId = upload.$id;
      const url = storage.getFileView(
        appwriteConfig.buckets.canvasAssets,
        fileId,
      ).href;

      // Add to canvas
      const img = await fabric.Image.fromURL(url);
      const id = ID.unique();

      img.set({
        left: 100,
        top: 100,
        name: id,
      });
      if (img.width && img.width > 500) {
        img.scaleToWidth(500);
      }

      (img as any).layerId = activeLayerId;
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);

      // Queue Op
      const canvasObj = {
        id,
        type: "image",
        layerId: activeLayerId,
        z: 0,
        visible: true,
        locked: false,
        updated_at: new Date().toISOString(),
        updated_by: userId,
        left: 100,
        top: 100,
        width: img.getScaledWidth(),
        height: img.getScaledHeight(),
        angle: 0,
        fileId: fileId,
        url: url,
      };
      queueOp({
        op_type: "add",
        object_id: id,
        payload_json: JSON.stringify({ object: canvasObj }),
      });
    } catch (error) {
      console.error("Image upload failed", error);
    }
  };

  const handleContextMenuAction = (action: ContextMenuAction) => {
    if (!fabricCanvas || !userId || !contextMenu?.targetId) return;
    const targetId = contextMenu.targetId;
    const obj = fabricCanvas
      .getObjects()
      .find((o: any) => o.name === targetId) as any;
    if (!obj) return;

    setContextMenu(null);

    switch (action) {
      case "duplicate":
        obj.clone().then((cloned: any) => {
          const newId = ID.unique();
          cloned.set({
            left: obj.left + 20,
            top: obj.top + 20,
            name: newId,
            evented: true,
          });
          (cloned as any).layerId = activeLayerId;
          fabricCanvas.add(cloned);
          fabricCanvas.setActiveObject(cloned);

          // Op
          // Ideally we sync full props, for now simplified clone
          const canvasObj = {
            id: newId,
            type: obj.type || "rect", // fallback
            layerId: activeLayerId,
            z: 0,
            visible: true,
            locked: false,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            left: cloned.left,
            top: cloned.top,
            width: cloned.width,
            height: cloned.height,
            angle: cloned.angle,
            fill: cloned.fill,
            scaleX: cloned.scaleX,
            scaleY: cloned.scaleY,
            // If image, need url
            url: (obj as any).src, // might fail for non-images
          };
          if (obj.type === "i-text" || obj.type === "text") {
            (canvasObj as any).text = (obj as any).text;
            (canvasObj as any).type = "text";
          }
          queueOp({
            op_type: "add",
            object_id: newId,
            payload_json: JSON.stringify({ object: canvasObj }),
          });
        });
        break;
      case "delete":
        fabricCanvas.remove(obj);
        queueOp({ op_type: "delete", object_id: targetId, payload_json: "{}" });
        break;
      case "lock":
        obj.set({ selectable: false, evented: false });
        // Sync layer lock? Or object lock?
        // Update Op
        queueOp({
          op_type: "update",
          object_id: targetId,
          payload_json: JSON.stringify({ patch: { locked: true } }),
        });
        break;
      case "unlock":
        obj.set({ selectable: true, evented: true });
        queueOp({
          op_type: "update",
          object_id: targetId,
          payload_json: JSON.stringify({ patch: { locked: false } }),
        });
        break;
      case "bringToFront":
        obj.bringToFront();
        // TODO: Reliable Z-index usage in fabric vs db
        // For now just local
        break;
      case "sendToBack":
        obj.sendToBack();
        break;
      case "visible":
        obj.set({ visible: true });
        obj.setCoords();
        fabricCanvas.requestRenderAll();
        queueOp({
          op_type: "update",
          object_id: targetId,
          payload_json: JSON.stringify({ patch: { visible: true } }),
        });
        break;
      case "hidden":
        obj.set({ visible: false });
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        queueOp({
          op_type: "update",
          object_id: targetId,
          payload_json: JSON.stringify({ patch: { visible: false } }),
        });
        break;
    }
  };

  const handleColorChange = (color: string) => {
    setActiveColor(color);
    if (!fabricCanvas) return;

    if (tool === "pen") {
      if (fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.color = color;
      }
    }

    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      activeObj.set({ fill: color });
      if (activeObj.type === "path" || activeObj.type === "pen") {
        activeObj.set({ stroke: color });
      }
      fabricCanvas.requestRenderAll();

      // Queue Op
      if ((activeObj as any).name) {
        const patch: any = { fill: color };
        if (activeObj.type === "path" || activeObj.type === "pen") {
          patch.stroke = color;
        }
        queueOp({
          op_type: "update",
          object_id: (activeObj as any).name,
          payload_json: JSON.stringify({ patch }),
        });
      }
    }
  };

  // Mobile check
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Auto-close layers on mobile
  useEffect(() => {
    if (isMobile) {
      // Logic handled inside LayersPanel if needed, or we control isOpen state here if we lifted it up.
      // LayersPanel handles its own state currently. We might want to pass initialOpen={!isMobile} if we refactor.
    }
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#09090b] text-foreground font-sans touch-none overscroll-none">
      {/* Canvas Layer - touch-none is critical for PWA gestures */}
      <div
        className="absolute inset-0 z-0 bg-neutral-900/50 touch-none"
        ref={containerRef}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Floating Header (Minimal) - Padding adjustment for mobile */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-4 pointer-events-none">
        <div className="h-10 px-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-3 shadow-2xl pointer-events-auto">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium text-white/90">
            Untitled Canvas
          </span>
          <span className="hidden sm:inline text-xs text-white/50 border-l border-white/10 pl-3">
            Last saved just now
          </span>
        </div>
      </div>

      {/* Floating Toolbar (Left) - Adjust for mobile to be bottom-center or smaller */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 md:left-4 md:top-1/2 md:-translate-y-1/2 z-20 flex flex-col gap-2 p-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:bg-black/50 sm:flex hidden">
        {/* Desktop Toolbar */}
        <IconButton
          active={tool === "select"}
          onClick={() => setTool("select")}
          icon={<MousePointer2 size={20} />}
          label="Select"
        />
        <IconButton
          active={tool === "hand"}
          onClick={() => setTool("hand")}
          icon={<Hand size={20} />}
          label="Hand Tool (Pan)"
        />
        <div className="h-px w-8 bg-white/10 mx-auto my-1" />
        <IconButton
          active={tool === "rect"}
          onClick={addRect}
          icon={<Square size={20} />}
          label="Rectangle"
        />
        <IconButton
          active={tool === "circle"}
          onClick={addCircle}
          icon={<CircleIcon size={20} />}
          label="Circle"
        />
        <IconButton
          active={tool === "text"}
          onClick={addText}
          icon={<Type size={20} />}
          label="Text"
        />
        <IconButton
          active={tool === "pen"}
          onClick={() => setTool("pen")}
          icon={<Pen size={20} />}
          label="Pen"
        />
        <div className="h-px w-8 bg-white/10 mx-auto my-1" />

        <div className="flex flex-col gap-1 items-center">
          <span className="text-[10px] text-zinc-500 font-medium">Fill</span>
          <ColorPickerPopover
            color={activeColor}
            onChange={(c) => {
              setActiveColor(c);
              if (!fabricCanvas) return;
              const activeObj = fabricCanvas.getActiveObject();
              if (activeObj) {
                activeObj.set({ fill: c });
                fabricCanvas.requestRenderAll();
                if ((activeObj as any).name) {
                  queueOp({
                    op_type: "update",
                    object_id: (activeObj as any).name,
                    payload_json: JSON.stringify({ patch: { fill: c } }),
                  });
                }
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-1 items-center">
          <span className="text-[10px] text-zinc-500 font-medium">Stroke</span>
          <ColorPickerPopover
            color={activeStrokeColor}
            onChange={(c) => {
              setActiveStrokeColor(c);
              if (!fabricCanvas) return;
              const activeObj = fabricCanvas.getActiveObject();
              if (activeObj) {
                activeObj.set({
                  stroke: c,
                  strokeWidth: activeObj.strokeWidth || 2,
                });
                fabricCanvas.requestRenderAll();
                if ((activeObj as any).name) {
                  queueOp({
                    op_type: "update",
                    object_id: (activeObj as any).name,
                    payload_json: JSON.stringify({
                      patch: {
                        stroke: c,
                        strokeWidth: activeObj.strokeWidth || 2,
                      },
                    }),
                  });
                }
              }
            }}
          />
        </div>

        <div className="h-px w-8 bg-white/10 mx-auto my-1" />
        <label
          className="cursor-pointer p-3 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center"
          title="Upload Image"
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <ImageIcon size={20} />
        </label>
        {selectedId && (
          <button
            onClick={deleteSelected}
            className="p-3 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-400 transition-colors flex items-center justify-center mt-2"
            title="Delete Selection"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {/* Mobile Toolbar (Bottom) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl sm:hidden overflow-x-auto max-w-[90vw]">
        <IconButton
          active={tool === "select"}
          onClick={() => setTool("select")}
          icon={<MousePointer2 size={18} />}
          label="Select"
        />
        <div className="w-px h-6 bg-white/10 mx-1" />
        <IconButton
          active={tool === "rect"}
          onClick={addRect}
          icon={<Square size={18} />}
          label="Rect"
        />
        <IconButton
          active={tool === "circle"}
          onClick={addCircle}
          icon={<CircleIcon size={18} />}
          label="Circle"
        />
        <IconButton
          active={tool === "text"}
          onClick={addText}
          icon={<Type size={18} />}
          label="Text"
        />
        <IconButton
          active={tool === "pen"}
          onClick={() => setTool("pen")}
          icon={<Pen size={18} />}
          label="Pen"
        />
        <label className="cursor-pointer p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <ImageIcon size={18} />
        </label>
        {selectedId && (
          <button
            onClick={deleteSelected}
            className="p-2 rounded-xl hover:bg-red-500/20 text-red-400"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Floating Layers Panel (Right) */}
      <LayersPanel
        canvas={fabricCanvas}
        layers={state?.layers || []}
        activeLayerId={activeLayerId}
        setActiveLayerId={setActiveLayerId}
        queueOp={queueOp}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetType={contextMenu.type}
          isLocked={contextMenu.locked}
          isVisible={contextMenu.visibleLayer}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  );
}

function addFabricObject(canvas: fabric.Canvas, obj: any, setActive: boolean) {
  let fObj: fabric.Object | null = null;
  if (obj.type === "rect") {
    fObj = new fabric.Rect({
      left: obj.x ?? obj.left,
      top: obj.y ?? obj.top,
      width: obj.w ?? obj.width,
      height: obj.h ?? obj.height,
      fill: obj.fill,
      name: obj.id,
      angle: obj.rotation ?? obj.angle,
    });
  } else if (obj.type === "circle") {
    fObj = new fabric.Circle({
      left: obj.x ?? obj.left,
      top: obj.y ?? obj.top,
      radius: obj.r ?? obj.radius,
      fill: obj.fill,
      name: obj.id,
    });
  } else if (obj.type === "text") {
    fObj = new fabric.IText(obj.text, {
      left: obj.x ?? obj.left,
      top: obj.y ?? obj.top,
      fontSize: obj.fontSize,
      fill: obj.fill,
      name: obj.id,
      fontFamily: "Inter, sans-serif",
    });
  } else if (obj.type === "pen" || obj.type === "path") {
    fObj = new fabric.Path(obj.points || obj.path, {
      left: obj.left,
      top: obj.top,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      fill: undefined,
      name: obj.id,
    });
  } else if (obj.type === "image") {
    fabric.Image.fromURL(obj.url).then((img) => {
      img.set({
        left: obj.left,
        top: obj.top,
        name: obj.id,
        angle: obj.angle || 0,
      });
      if (obj.width) img.scaleToWidth(obj.width);

      (img as any).layerId = obj.layerId;
      canvas.add(img);
      if (setActive) canvas.setActiveObject(img);
    });
    return;
  }

  if (fObj) {
    (fObj as any).layerId = obj.layerId;
    canvas.add(fObj);
    if (setActive) canvas.setActiveObject(fObj);
  }
}

function IconButton({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center ${
        active
          ? "bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] ring-1 ring-indigo-500/50"
          : "text-white/60 hover:text-white hover:bg-white/10"
      }`}
    >
      {icon}
    </button>
  );
}

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
  ChevronLeft,
  ChevronRight,
  Paintbrush,
  CircleDot,
  Settings,
  Maximize,
  Target,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { LayersPanel } from "./LayersPanel";
import { ContextMenu, ContextMenuAction } from "./ContextMenu";
import { ColorPickerPopover } from "./ColorPickerPopover";

type Tool = "select" | "rect" | "circle" | "text" | "pen" | "hand" | "line";

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
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [pendingSettings, setPendingSettings] = useState<{
    width: number;
    height: number;
    bgColor: string;
  } | null>(null);

  const [zoom, setZoom] = useState(1);
  const isInitialized = useRef(false);
  const isCentered = useRef(false);
  const isDrawingShape = useRef(false);
  const shapeBeingDrawn = useRef<fabric.Object | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  // Refs for event handlers to avoid stale closures
  const toolRef = useRef(tool);
  const activeColorRef = useRef(activeColor);
  const activeLayerIdRef = useRef(activeLayerId);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

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
    if (!canvasRef.current || !containerRef.current || isInitialized.current)
      return;

    console.log("Initializing Fabric Canvas...");
    isInitialized.current = true;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "transparent", // Transparent to show workspace bg
      selection: true,
      preserveObjectStacking: true, // Ensure layers order is preserved
    });

    setFabricCanvas(canvas);

    const updateZoomState = () => {
      setZoom(canvas.getZoom());
    };

    canvas.on("mouse:wheel", updateZoomState);

    // Initial Center - Zoom 1, Center Content in Screen
    if (containerRef.current) {
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      const contentW = state?.width || 1920;
      const contentH = state?.height || 1080;

      const vpt = canvas.viewportTransform;
      if (vpt) {
        // vpt[4] is X translation, [5] is Y
        vpt[4] = (containerW - contentW) / 2;
        vpt[5] = (containerH - contentH) / 2;
        canvas.requestRenderAll();
      }
    }

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

    // Handle contextmenu event to show custom context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get pointer position relative to canvas
      const pointer = canvas.getPointer(e);
      const target = canvas.findTarget(e as any) as any;

      if (target) {
        // Select the target if not already selected
        if (canvas.getActiveObject() !== target) {
          canvas.setActiveObject(target);
          canvas.requestRenderAll();
        }

        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          visible: true,
          targetId: target.name,
          type: target.type,
          locked: !target.evented,
          visibleLayer: target.visible,
        });
      } else {
        // Check if there's already a selected object
        const activeObj = canvas.getActiveObject() as any;
        if (activeObj) {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            visible: true,
            targetId: activeObj.name,
            type: activeObj.type,
            locked: !activeObj.evented,
            visibleLayer: activeObj.visible,
          });
        }
      }
    };

    // Attach to upper-canvas which Fabric creates for event handling
    const upperCanvas = canvas.upperCanvasEl;
    if (upperCanvas) {
      upperCanvas.addEventListener("contextmenu", handleContextMenu);
    }

    // Long-press for mobile context menu
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartPos = { x: 0, y: 0 };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };

      longPressTimer = setTimeout(() => {
        // Find object at touch position
        const pointer = canvas.getPointer(e as any);
        const target = canvas.findTarget(e as any) as any;

        if (target) {
          canvas.setActiveObject(target);
          canvas.requestRenderAll();
          setContextMenu({
            x: touch.clientX,
            y: touch.clientY,
            visible: true,
            targetId: target.name,
            type: target.type,
            locked: !target.evented,
            visibleLayer: target.visible,
          });
        }
      }, 500);
    };

    const handleTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;
      // Cancel long press if moved too far (10px threshold)
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    };

    canvasRef.current?.addEventListener("touchstart", handleTouchStart);
    canvasRef.current?.addEventListener("touchend", handleTouchEnd);
    canvasRef.current?.addEventListener("touchmove", handleTouchMove);

    return () => {
      console.log("Disposing Fabric Canvas...");
      canvas.dispose();
      isInitialized.current = false;
      setFabricCanvas(null);
    };
  }, [canvasRef]);

  // Resize Observer for Infinite Canvas
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;
    const canvas = fabricCanvas;

    const resizeCanvasEl = () => {
      if (!containerRef.current) return;
      // Update DOM size to fill container
      canvas.setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      canvas.requestRenderAll();
    };

    const ro = new ResizeObserver(resizeCanvasEl);
    ro.observe(containerRef.current);

    // Initial call
    resizeCanvasEl();

    return () => ro.disconnect();
  }, [fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas || !state) return;
    const canvas = fabricCanvas;

    // Sync Dimensions
    // Sync Artboard (Infinite Canvas Background)
    let artboard = canvas.getObjects().find((o: any) => o.name === "artboard");
    if (!artboard) {
      artboard = new fabric.Rect({
        name: "artboard",
        left: 0,
        top: 0,
        width: state.width,
        height: state.height,
        fill: state.bgColor || "#ffffff",
        selectable: false,
        evented: false,
        hoverCursor: "default",
        excludeFromExport: true,
      });
      canvas.add(artboard);
      (canvas as any).sendToBack?.(artboard);
    } else {
      artboard.set({
        width: state.width,
        height: state.height,
        fill: state.bgColor || "#ffffff",
      });
      (canvas as any).sendToBack?.(artboard);
    }
    canvas.requestRenderAll();
    canvas.requestRenderAll();
  }, [fabricCanvas, state?.width, state?.height, state?.bgColor]);

  // Auto-Center on Load
  useEffect(() => {
    if (fabricCanvas && state?.width && !isCentered.current) {
      // Use timeout to ensure DOM is stabilized
      setTimeout(() => {
        centerCanvas(false);
        isCentered.current = true;
      }, 100);
    }
  }, [fabricCanvas, state?.width]);

  useEffect(() => {
    if (!fabricCanvas) return;
    const canvas = fabricCanvas;

    // Panning Logic (Hand Tool)
    canvas.on("mouse:down", function (opt) {
      const evt = opt.e as MouseEvent;
      const target = canvas as any;

      // Handle Right Click (Context Menu)
      if ((opt as any).button === 3 || evt.button === 2) {
        evt.preventDefault();
        evt.stopPropagation();

        // Get the clicked object or currently selected object
        const clickedObj = opt.target as any;
        const activeObj = clickedObj || canvas.getActiveObject();

        if (activeObj) {
          // Select the clicked object if different from current selection
          if (clickedObj && canvas.getActiveObject() !== clickedObj) {
            canvas.setActiveObject(clickedObj);
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
        }
        return;
      }

      // Panning Mode - Only if Hand Tool is active
      if (toolRef.current === "hand") {
        target.isDragging = true;
        target.selection = false;
        target.lastPosX = evt.clientX;
        target.lastPosY = evt.clientY;
        return;
      }

      // Drawing Mode
      if (
        toolRef.current === "rect" ||
        toolRef.current === "circle" ||
        toolRef.current === "line"
      ) {
        isDrawingShape.current = true;
        const pointer = canvas.getPointer(evt);
        startPoint.current = { x: pointer.x, y: pointer.y };

        const id = ID.unique();
        if (toolRef.current === "rect") {
          const rect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: activeColorRef.current,
            name: id,
            strokeWidth: 0,
          });
          (rect as any).layerId = activeLayerIdRef.current;
          shapeBeingDrawn.current = rect;
          canvas.add(rect);
        } else if (toolRef.current === "circle") {
          const circle = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            fill: activeColorRef.current,
            name: id,
            strokeWidth: 0,
          });
          (circle as any).layerId = activeLayerIdRef.current;
          shapeBeingDrawn.current = circle;
          canvas.add(circle);
        } else if (toolRef.current === "line") {
          const line = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            {
              stroke: activeColorRef.current,
              strokeWidth: 4,
              name: id,
            },
          );
          (line as any).layerId = activeLayerIdRef.current;
          shapeBeingDrawn.current = line;
          canvas.add(line);
        }
        canvas.selection = false;
        return;
      }
    });

    canvas.on("mouse:move", function (opt) {
      const target = canvas as any;
      const evt = opt.e as MouseEvent;

      if (target.isDragging) {
        const vpt = target.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - target.lastPosX;
          vpt[5] += evt.clientY - target.lastPosY;
          target.requestRenderAll();
        }
        target.lastPosX = evt.clientX;
        target.lastPosY = evt.clientY;
        return;
      }

      if (
        isDrawingShape.current &&
        shapeBeingDrawn.current &&
        startPoint.current
      ) {
        const pointer = canvas.getPointer(evt);
        const shape = shapeBeingDrawn.current;

        if (shape.type === "rect") {
          const left = Math.min(startPoint.current.x, pointer.x);
          const top = Math.min(startPoint.current.y, pointer.y);
          const width = Math.abs(startPoint.current.x - pointer.x);
          const height = Math.abs(startPoint.current.y - pointer.y);

          shape.set({ left, top, width, height });
        } else if (shape.type === "circle") {
          const radius =
            Math.sqrt(
              Math.pow(startPoint.current.x - pointer.x, 2) +
                Math.pow(startPoint.current.y - pointer.y, 2),
            ) / 2;
          const left = Math.min(startPoint.current.x, pointer.x);
          const top = Math.min(startPoint.current.y, pointer.y);

          // Re-center circle correctly based on start and current pointer
          // Or just use the diagonal as diameter
          const centerX = (startPoint.current.x + pointer.x) / 2;
          const centerY = (startPoint.current.y + pointer.y) / 2;

          shape.set({
            radius: radius,
            left: centerX - radius,
            top: centerY - radius,
          });
        } else if (shape.type === "line") {
          (shape as fabric.Line).set({
            x2: pointer.x,
            y2: pointer.y,
          });
        }
        canvas.requestRenderAll();
      }
    });

    canvas.on("mouse:up", function (opt) {
      const target = canvas as any;
      if (target.isDragging) {
        target.setViewportTransform(target.viewportTransform);
        target.isDragging = false;
        target.selection = true;
        return;
      }

      if (isDrawingShape.current && shapeBeingDrawn.current) {
        const obj = shapeBeingDrawn.current;

        // If it's too small, remove it (accidental click)
        const isTooSmall =
          (obj.type === "rect" &&
            (obj.width || 0) < 5 &&
            (obj.height || 0) < 5) ||
          (obj.type === "circle" && (obj.getScaledWidth() || 0) < 5) ||
          (obj.type === "line" &&
            Math.abs((obj as fabric.Line).x1! - (obj as fabric.Line).x2!) < 5 &&
            Math.abs((obj as fabric.Line).y1! - (obj as fabric.Line).y2!) < 5);

        if (isTooSmall) {
          canvas.remove(obj);
        } else {
          // Finalize and Sync
          canvas.setActiveObject(obj);

          const canvasObj: any = {
            id: (obj as any).name,
            type: obj.type,
            layerId: activeLayerIdRef.current,
            z: 0,
            visible: true,
            locked: false,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            fill: obj.fill,
            stroke: obj.stroke || "",
            strokeWidth: obj.strokeWidth || 0,
          };

          if (obj.type === "rect") {
            canvasObj.x = obj.left;
            canvasObj.y = obj.top;
            canvasObj.w = obj.width;
            canvasObj.h = obj.height;
          } else if (obj.type === "circle") {
            canvasObj.left = obj.left;
            canvasObj.top = obj.top;
            canvasObj.radius = (obj as fabric.Circle).radius;
          } else if (obj.type === "line") {
            const line = obj as fabric.Line;
            canvasObj.points = [line.x1, line.y1, line.x2, line.y2];
          }

          queueOp({
            op_type: "add",
            object_id: (obj as any).name,
            payload_json: JSON.stringify({ object: canvasObj }),
          });
        }

        isDrawingShape.current = false;
        shapeBeingDrawn.current = null;
        startPoint.current = null;
        canvas.selection = true;
        canvas.requestRenderAll();
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
      // Event listeners are cleaned up by canvas.dispose() in the main init effect
    };
  }, [fabricCanvas]);

  // Sync Initial State - runs when state.objects changes
  const syncedObjectsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!fabricCanvas || !state) return;

    // Get current object IDs in state
    const stateObjectIds = new Set(state.objects.map((o) => o.id));

    // Add missing objects to canvas
    state.objects.forEach((obj) => {
      if (!syncedObjectsRef.current.has(obj.id)) {
        // Check if object already exists on canvas
        const existsOnCanvas = fabricCanvas
          .getObjects()
          .some((o: any) => o.name === obj.id);
        if (!existsOnCanvas) {
          addFabricObject(fabricCanvas, obj, false);
        }
        syncedObjectsRef.current.add(obj.id);
      }
    });

    // Ensure we render after initial sync
    fabricCanvas.requestRenderAll();

    // Apply layer visibility/locks
    state.layers?.forEach((layer) => {
      fabricCanvas.getObjects().forEach((o: any) => {
        if ((o as any).layerId === layer.id) {
          o.set({
            visible: layer.visible,
            selectable: !layer.locked,
            evented: !layer.locked,
          });
        }
      });
    });

    fabricCanvas.requestRenderAll();
  }, [fabricCanvas, state?.objects?.length]); // Re-run when objects array length changes

  // Sync Remote Ops
  useEffect(() => {
    if (!fabricCanvas || !lastRemoteOp) return;
    // Apply op
    const op = lastRemoteOp;
    const payload = JSON.parse(op.payload_json || "{}");

    if (op.op_type === "add") {
      const obj = payload.object;
      if (!obj) return;
      if (
        fabricCanvas.getObjects().find((o: any) => (o as any).name === obj.id)
      )
        return; // Already exists
      addFabricObject(fabricCanvas, obj, false);
    } else if (op.op_type === "update") {
      const obj = fabricCanvas
        .getObjects()
        .find((o: any) => (o as any).name === op.object_id);
      if (obj && payload.patch) {
        obj.set(payload.patch);
        obj.setCoords();
        fabricCanvas.requestRenderAll();
      }
    } else if (op.op_type === "delete") {
      const obj = fabricCanvas
        .getObjects()
        .find((o: any) => (o as any).name === op.object_id);
      if (obj) {
        fabricCanvas.remove(obj);
        fabricCanvas.requestRenderAll();
      }
    } else if (op.op_type === "reorder") {
      const obj = fabricCanvas
        .getObjects()
        .find((o: any) => (o as any).name === op.object_id);
      if (obj && typeof payload.index === "number") {
        (obj as any).moveTo(payload.index);
        fabricCanvas.requestRenderAll();
      }
    }
  }, [lastRemoteOp, fabricCanvas]);

  const addText = () => {
    if (!fabricCanvas || !userId) return;
    const id = ID.unique();
    const text = new fabric.IText("Hello", {
      left: 100,
      top: 100,
      fontFamily: "Inter, sans-serif",
      fill: activeColor,
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
      left: 100,
      top: 100,
      text: "Hello",
      fontSize: 24,
      fill: activeColor,
    };
    queueOp({
      op_type: "add",
      object_id: id,
      payload_json: JSON.stringify({ object: canvasObj }),
    });
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
        // Exclude Artboard from being selectable
        if ((obj as any).name === "artboard") {
          return;
        }
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

    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      activeObj.set({ fill: color });
      if (activeObj.type === "path") {
        activeObj.set({ stroke: color });
      }
      fabricCanvas.requestRenderAll();

      if ((activeObj as any).name) {
        queueOp({
          op_type: "update",
          object_id: (activeObj as any).name,
          payload_json: JSON.stringify({
            patch: {
              fill: color,
              ...(activeObj.type === "path" ? { stroke: color } : {}),
            },
          }),
        });
      }
    }
  };

  const centerCanvas = (animate: boolean = true) => {
    if (!fabricCanvas || !containerRef.current || !state) return;
    const canvas = fabricCanvas;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const padding = 60;
    const availableW = containerWidth - padding;
    const availableH = containerHeight - padding;

    const scaleX = availableW / state.width;
    const scaleY = availableH / state.height;
    const scale = Math.min(scaleX, scaleY, 1);

    const targetX = (containerWidth - state.width * scale) / 2;
    const targetY = (containerHeight - state.height * scale) / 2;

    if (animate) {
      const startZoom = canvas.getZoom();
      const startVpt = [...(canvas.viewportTransform || [1, 0, 0, 1, 0, 0])];

      fabric.util.animate({
        startValue: 0,
        endValue: 1,
        duration: 500,
        onChange: (value) => {
          const currentZoom = startZoom + (scale - startZoom) * value;
          const currentX = startVpt[4] + (targetX - startVpt[4]) * value;
          const currentY = startVpt[5] + (targetY - startVpt[5]) * value;

          canvas.setZoom(currentZoom);
          const vpt = canvas.viewportTransform;
          if (vpt) {
            vpt[4] = currentX;
            vpt[5] = currentY;
          }
          canvas.requestRenderAll();
        },
        easing: fabric.util.ease.easeInOutQuad,
      });
    } else {
      canvas.setZoom(scale);
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] = targetX;
        vpt[5] = targetY;
      }
      canvas.requestRenderAll();
    }
  };

  const resetZoom = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(1);
    setZoom(1);
    fabricCanvas.requestRenderAll();
  };

  const manualZoom = (delta: number) => {
    if (!fabricCanvas || !containerRef.current) return;
    const canvas = fabricCanvas;
    let newZoom = canvas.getZoom() * (1 + delta);

    // Limits
    if (newZoom > 20) newZoom = 20;
    if (newZoom < 0.01) newZoom = 0.01;

    // Zoom to center of container
    const center = {
      x: containerRef.current.clientWidth / 2,
      y: containerRef.current.clientHeight / 2,
    };

    canvas.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
    setZoom(newZoom);
    canvas.requestRenderAll();
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
    <div className="relative w-full h-full overflow-hidden bg-muted/20 dark:bg-background text-foreground font-sans touch-none overscroll-none">
      {/* Canvas Container - Now with scroll support for large canvas */}
      {/* Canvas Container - Infinite Canvas Mode */}
      <div
        ref={containerRef}
        className="w-full h-full bg-transparent flex items-center justify-center"
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Floating Toolbar (Left) - Collapsible with vertical scroll */}
      <div
        className={`fixed left-4 top-20 z-20 hidden sm:flex flex-col rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 ease-in-out hover:bg-zinc-900/60 ${
          toolbarCollapsed
            ? "w-12 h-min"
            : "w-[68px] bottom-24 overflow-x-hidden"
        }`}
      >
        {/* Sticky Collapse Toggle - Always visible */}
        <div className="shrink-0 p-2 border-b border-white/10">
          <button
            onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center w-full"
            title={toolbarCollapsed ? "Expand Toolbar" : "Collapse Toolbar"}
          >
            {toolbarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>

        {/* Scrollable Tools Section */}
        {!toolbarCollapsed && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
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
              onClick={() => setTool("rect")}
              icon={<Square size={20} />}
              label="Rectangle Tool"
            />
            <IconButton
              active={tool === "circle"}
              onClick={() => setTool("circle")}
              icon={<CircleIcon size={20} />}
              label="Circle Tool"
            />
            <IconButton
              active={tool === "line"}
              onClick={() => setTool("line")}
              icon={<Minus size={20} className="rotate-45" />}
              label="Line Tool"
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

            <div
              className="flex flex-col gap-1 items-center"
              title="Fill Color"
            >
              <Paintbrush size={14} className="text-zinc-500" />
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

            <div
              className="flex flex-col gap-1 items-center"
              title="Stroke Color"
            >
              <CircleDot size={14} className="text-zinc-500" />
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

            <div className="h-px w-8 bg-white/10 mx-auto" />
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

            <div className="h-px w-8 bg-white/10 mx-auto" />
            <IconButton
              onClick={() => setIsSettingsOpen(true)}
              icon={<Settings size={20} />}
              label="Settings"
            />
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
          onClick={() => setTool("rect")}
          icon={<Square size={18} />}
          label="Rect"
        />
        <IconButton
          active={tool === "circle"}
          onClick={() => setTool("circle")}
          icon={<CircleDot size={18} />}
          label="Circle"
        />
        <IconButton
          active={tool === "line"}
          onClick={() => setTool("line")}
          icon={<Minus size={18} className="rotate-45" />}
          label="Line"
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
        selectedShapeId={selectedId}
      />

      {/* Viewport Controls (Bottom Right) */}
      <div className="fixed right-4 bottom-24 z-20 flex flex-col items-center gap-2 p-2 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 ease-in-out hover:bg-zinc-900/60">
        <div className="flex flex-col items-center border-b border-white/5 pb-2 mb-1">
          <IconButton
            onClick={() => manualZoom(0.1)}
            icon={<ZoomIn size={18} />}
            label="Zoom In"
          />
          <span className="text-[10px] font-bold text-white/50 my-1 min-w-[35px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton
            onClick={() => manualZoom(-0.1)}
            icon={<ZoomOut size={18} />}
            label="Zoom Out"
          />
        </div>
        <IconButton
          onClick={resetZoom}
          icon={<Maximize size={18} />}
          label="Reset Zoom (100%)"
        />
        <IconButton
          onClick={() => centerCanvas(true)}
          icon={<Target size={18} />}
          label="Center / Fit Canvas"
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetId={contextMenu.targetId}
          targetType={contextMenu.type}
          isLocked={contextMenu.locked}
          isVisible={contextMenu.visibleLayer}
          onClose={() => setContextMenu(null)}
          queueOp={queueOp}
        />
      )}

      {/* Canvas Settings Modal */}
      {isSettingsOpen && state && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-zinc-900 border-white/10 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Settings size={20} className="text-indigo-400" />
                Canvas Settings
              </h2>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setPendingSettings(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
                  Width (px)
                </label>
                <input
                  type="number"
                  value={pendingSettings?.width ?? state.width}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPendingSettings((prev) => ({
                      width: val,
                      height: prev?.height ?? state.height,
                      bgColor: prev?.bgColor ?? state.bgColor,
                    }));
                  }}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
                  Height (px)
                </label>
                <input
                  type="number"
                  value={pendingSettings?.height ?? state.height}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPendingSettings((prev) => ({
                      width: prev?.width ?? state.width,
                      height: val,
                      bgColor: prev?.bgColor ?? state.bgColor,
                    }));
                  }}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
                Background Color
              </label>
              <div className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-lg p-2.5">
                <input
                  type="color"
                  value={pendingSettings?.bgColor ?? state.bgColor}
                  onChange={(e) => {
                    setPendingSettings((prev) => ({
                      width: prev?.width ?? state.width,
                      height: prev?.height ?? state.height,
                      bgColor: e.target.value,
                    }));
                  }}
                  className="w-10 h-10 border-none bg-transparent cursor-pointer rounded overflow-hidden"
                />
                <span className="text-sm text-zinc-400 font-mono">
                  {(pendingSettings?.bgColor ?? state.bgColor).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={!pendingSettings}
                  onClick={() => {
                    if (pendingSettings) {
                      queueOp({
                        op_type: "meta",
                        payload_json: JSON.stringify(pendingSettings),
                      });
                      setPendingSettings(null);
                    }
                  }}
                  className="flex-1"
                >
                  Save Changes
                </Button>
                <Button
                  variant="ghost"
                  disabled={!pendingSettings}
                  onClick={() => setPendingSettings(null)}
                  className="flex-1"
                >
                  Discard
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  const defaultSettings = {
                    width: 1280,
                    height: 720,
                    bgColor: "#ffffff",
                  };
                  // Only queue if different from current state
                  if (
                    state.width !== 1280 ||
                    state.height !== 720 ||
                    state.bgColor !== "#ffffff"
                  ) {
                    queueOp({
                      op_type: "meta",
                      payload_json: JSON.stringify(defaultSettings),
                    });
                  }
                  setPendingSettings(null);
                }}
                className="w-full border-white/10 hover:bg-white/5 text-zinc-400"
              >
                Restore Default Settings (1280x720 White)
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setPendingSettings(null);
                }}
                className="w-full text-zinc-500"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
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
  } else if (obj.type === "line") {
    fObj = new fabric.Line(obj.points || [0, 0, 100, 100], {
      stroke: obj.stroke || obj.fill || "black",
      strokeWidth: obj.strokeWidth || 4,
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

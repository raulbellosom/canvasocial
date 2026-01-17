import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";

interface FabricCanvasProps {
  canvasId: string;
}

export function FabricCanvas({ canvasId }: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Initialize Fabric Canvas
    // Note: fabric v6 syntax might differ slightly from v5, verify if 'fabric.Canvas' is correct.
    // It usually is.
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#f3f4f6", // light gray
      selection: true,
    });

    setFabricCanvas(canvas);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && canvas) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      // Dispose
      canvas.dispose();
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[var(--bg)]"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

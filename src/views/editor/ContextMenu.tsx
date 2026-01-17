import { useEffect, useRef } from "react";
import {
  Copy,
  Trash2,
  Lock,
  Unlock,
  BringToFront,
  SendToBack,
  Group,
  Eye,
  EyeOff,
} from "lucide-react";
import { createPortal } from "react-dom";

export type ContextMenuAction =
  | "duplicate"
  | "delete"
  | "lock"
  | "unlock"
  | "bringToFront"
  | "sendToBack"
  | "group"
  | "ungroup"
  | "visible"
  | "hidden";

interface Props {
  x: number;
  y: number;
  targetId?: string;
  onClose: () => void;
  queueOp: (op: any) => void;
  targetType?: string;
  isLocked?: boolean;
  isVisible?: boolean;
}

export function ContextMenu({
  x,
  y,
  targetId,
  onClose,
  queueOp,
  targetType,
  isLocked,
  isVisible,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleAction = (action: ContextMenuAction) => {
    if (!targetId && action !== "group") {
      onClose();
      return;
    }

    switch (action) {
      case "delete":
        queueOp({ op_type: "delete", object_id: targetId });
        break;
      case "lock":
      case "unlock":
        queueOp({
          op_type: "update",
          object_id: targetId,
          payload_json: JSON.stringify({
            patch: {
              selectable: action === "unlock",
              evented: action === "unlock",
            },
          }),
        });
        break;
      case "visible":
      case "hidden":
        queueOp({
          op_type: "update",
          object_id: targetId,
          payload_json: JSON.stringify({
            patch: { visible: action === "visible" },
          }),
        });
        break;
      case "bringToFront":
      case "sendToBack":
        queueOp({
          op_type: "reorder",
          object_id: targetId,
          payload_json: JSON.stringify({
            action: action,
          }),
        });
        break;
      case "duplicate":
        // This might need more logic to clone the object,
        // for now just placeholder or we can implement basic copy
        queueOp({
          op_type: "add",
          payload_json: JSON.stringify({
            type: "duplicate",
            source_id: targetId,
          }),
        });
        break;
    }
    onClose();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust position to stay in viewport
  // Simple clamping
  const style = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 300),
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 w-56 rounded-xl border border-(--border) bg-(--card) shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1 flex flex-col gap-1"
      style={style}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-(--muted) border-b border-(--border) mb-1">
        {targetType
          ? `${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`
          : "Selection"}
      </div>

      <MenuItem
        icon={<Copy size={16} />}
        label="Duplicate"
        onClick={() => handleAction("duplicate")}
      />
      <MenuItem
        icon={<Trash2 size={16} />}
        label="Delete"
        onClick={() => handleAction("delete")}
        shortcut="Del"
        className="text-red-400 hover:text-red-400 hover:bg-red-500/10"
      />

      <div className="h-px bg-(--border) my-0.5" />

      <MenuItem
        icon={isLocked ? <Unlock size={16} /> : <Lock size={16} />}
        label={isLocked ? "Unlock" : "Lock"}
        onClick={() => handleAction(isLocked ? "unlock" : "lock")}
      />
      <MenuItem
        icon={isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        label={isVisible ? "Hide" : "Show"}
        onClick={() => handleAction(isVisible ? "hidden" : "visible")}
      />

      <div className="h-px bg-(--border) my-0.5" />

      <MenuItem
        icon={<BringToFront size={16} />}
        label="Bring to Front"
        onClick={() => handleAction("bringToFront")}
      />
      <MenuItem
        icon={<SendToBack size={16} />}
        label="Send to Back"
        onClick={() => handleAction("sendToBack")}
      />
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  shortcut,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/10 text-sm transition-colors text-left group ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="opacity-70 group-hover:opacity-100 transition-opacity">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-xs text-(--muted) font-mono">{shortcut}</span>
      )}
    </button>
  );
}

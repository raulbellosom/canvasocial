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
  onClose: () => void;
  onAction: (action: ContextMenuAction) => void;
  targetType?: string;
  isLocked?: boolean;
  isVisible?: boolean;
}

export function ContextMenu({
  x,
  y,
  onClose,
  onAction,
  targetType,
  isLocked,
  isVisible,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
      className="fixed z-50 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1 flex flex-col gap-1"
      style={style}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted)] border-b border-[var(--border)] mb-1">
        {targetType
          ? `${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`
          : "Selection"}
      </div>

      <MenuItem
        icon={<Copy size={16} />}
        label="Duplicate"
        onClick={() => onAction("duplicate")}
      />
      <MenuItem
        icon={<Trash2 size={16} />}
        label="Delete"
        onClick={() => onAction("delete")}
        shortcut="Del"
        className="text-red-400 hover:text-red-400 hover:bg-red-500/10"
      />

      <div className="h-px bg-[var(--border)] my-0.5" />

      <MenuItem
        icon={isLocked ? <Unlock size={16} /> : <Lock size={16} />}
        label={isLocked ? "Unlock" : "Lock"}
        onClick={() => onAction(isLocked ? "unlock" : "lock")}
      />
      <MenuItem
        icon={isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        label={isVisible ? "Hide" : "Show"}
        onClick={() => onAction(isVisible ? "hidden" : "visible")}
      />

      <div className="h-px bg-[var(--border)] my-0.5" />

      <MenuItem
        icon={<BringToFront size={16} />}
        label="Bring to Front"
        onClick={() => onAction("bringToFront")}
      />
      <MenuItem
        icon={<SendToBack size={16} />}
        label="Send to Back"
        onClick={() => onAction("sendToBack")}
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
        <span className="text-xs text-[var(--muted)] font-mono">
          {shortcut}
        </span>
      )}
    </button>
  );
}

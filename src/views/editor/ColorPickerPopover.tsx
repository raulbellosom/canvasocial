import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Palette, X } from "lucide-react";

interface Props {
  color: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#71717a",
  "#1e293b",
];

export function ColorPickerPopover({ color, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 12,
      });
    }
  }, [isOpen]);

  // Close on scroll to avoid detached popover
  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => setIsOpen(false);
      window.addEventListener("scroll", handleScroll, true);
      return () => window.removeEventListener("scroll", handleScroll, true);
    }
  }, [isOpen]);

  const popoverContent = (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
        onClick={() => setIsOpen(false)}
      />
      <div
        className="fixed z-50 p-3 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Select Color
          </span>
          <button onClick={() => setIsOpen(false)}>
            <X size={14} className="text-white/50 hover:text-white" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-3">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full border border-white/10 hover:scale-110 transition-transform ${
                color === c ? "ring-2 ring-white" : ""
              }`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c);
                // Keep open for exploring colors? Or close? Standard is keep open usually unless preset click.
                // Let's keep open for now to match user interaction flow.
                // Wait, previous code closed it: setIsOpen(false). Let's respect that.
                setIsOpen(false);
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg border border-white/10 shadow-inner"
            style={{ backgroundColor: color }}
          ></div>
          <input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            placeholder="#HEX"
          />
          <div className="relative w-8 h-8 overflow-hidden rounded-lg border border-white/10">
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 cursor-pointer opacity-0"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-all hover:scale-110 shadow-sm overflow-hidden"
        style={{ backgroundColor: color }}
        title="Color Picker"
      >
        {!color && (
          <Palette size={14} className="text-white mix-blend-difference" />
        )}
      </button>
      {isOpen && createPortal(popoverContent, document.body)}
    </div>
  );
}

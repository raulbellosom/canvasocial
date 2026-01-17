import { useState } from "react";
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center transition-all hover:scale-105 shadow-sm"
        style={{ backgroundColor: color }}
        title="Color Picker"
      >
        {!color && (
          <Palette size={16} className="text-white mix-blend-difference" />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 left-0 z-50 p-3 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-[var(--muted)]">
                Fill Color
              </span>
              <button onClick={() => setIsOpen(false)}>
                <X size={14} className="text-white/50 hover:text-white" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full border border-white/10 hover:scale-110 transition-transform ${color === c ? "ring-2 ring-white" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    onChange(c);
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg border border-white/10"
                style={{ backgroundColor: color }}
              ></div>
              <input
                type="text"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="color"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer opacity-50 hover:opacity-100"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

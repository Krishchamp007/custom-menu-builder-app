import { useEffect, useState } from "react";
import { Shuffle, X } from "lucide-react";

type Props = {
  open: boolean;
  dishName: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
};

export function SwapSheet({ open, dishName, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center no-print">
      <button
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl shadow-sheet border-t border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-accent">
              <Shuffle size={18} />
            </div>
            <div>
              <h3 className="display text-lg font-semibold">Swap dish</h3>
              <p className="text-sm text-muted mt-0.5">
                Replace <span className="text-text">{dishName}</span>.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-muted hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        <div>
          <label className="label">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. too heavy, no paneer, want something quick"
            className="input"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim() || undefined)}
            className="btn-primary flex-1"
          >
            Generate replacement
          </button>
        </div>
      </div>
    </div>
  );
}

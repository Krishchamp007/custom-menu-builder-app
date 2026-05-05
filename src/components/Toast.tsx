import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type Toast = { id: number; msg: string; kind: "info" | "error" | "success" };
type Ctx = { push: (msg: string, kind?: Toast["kind"]) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed top-3 inset-x-0 z-50 flex flex-col items-center gap-2 px-3 no-print pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto card px-4 py-2.5 text-sm shadow-card max-w-md w-full ${
              t.kind === "error"
                ? "border-fat/60 text-text"
                : t.kind === "success"
                ? "border-accent/60 text-text"
                : ""
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

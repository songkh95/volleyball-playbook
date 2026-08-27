import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title?: string;
  onClose?: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-panel p-5 shadow-none ring-1 ring-line"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-5 sm:items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="box-border w-full max-w-md overflow-hidden rounded-2xl bg-panel px-7 py-5 shadow-none ring-1 ring-line"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

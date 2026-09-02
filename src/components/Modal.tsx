import { useEffect, type ReactNode } from "react";
import { registerBackHandler } from "../lib/backHandlers";

type Props = {
  open: boolean;
  title?: string;
  onClose?: () => void;
  zClass?: string;
  children: ReactNode;
};

export function Modal({ open, title, onClose, zClass = "z-50", children }: Props) {
  useEffect(() => {
    if (!open || !onClose) return;
    return registerBackHandler(() => {
      onClose();
      return true;
    });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-end justify-center bg-black/70 px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-5 sm:items-center`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="box-border w-full max-w-md overflow-hidden rounded-2xl glass px-7 py-5 shadow-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

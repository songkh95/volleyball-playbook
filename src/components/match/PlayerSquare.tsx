type Props = {
  number?: string;
  order?: string | number;
  position?: string;
  serving?: boolean;
  selected?: boolean;
  dashed?: boolean;
  dimNumber?: boolean;
  onClick: () => void;
};

const box = "flex shrink-0 flex-col items-center justify-center rounded-lg";
const sqStyle = { width: "var(--match-sq)", height: "var(--match-sq)" } as const;

export function PlayerSquare({
  number,
  order,
  position,
  serving,
  selected,
  dashed,
  dimNumber,
  onClick,
}: Props) {
  if (dashed) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={sqStyle}
        className={`${box} border border-dashed border-white/25 text-white/40`}
      >
        <span className="text-[length:calc(var(--match-sq)*0.42)] font-light leading-none">+</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={sqStyle}
      className={`${box} px-0.5 py-0.5 ${
        selected
          ? "bg-accent text-ink"
          : serving
            ? "bg-accent/15 ring-1 ring-accent"
            : "bg-black/35 ring-1 ring-white/10"
      }`}
    >
      <span
        className={`text-[length:calc(var(--match-sq)*0.32)] font-bold leading-none tabular-nums ${
          selected ? "" : dimNumber ? "text-white/55" : ""
        }`}
      >
        {number ?? "—"}
      </span>
      <span
        className={`mt-0.5 text-[length:calc(var(--match-sq)*0.16)] leading-none ${
          selected ? "text-ink/60" : "text-white/50"
        }`}
      >
        순서 {order ?? "—"}
      </span>
      <span
        className={`mt-0.5 max-w-full truncate text-[length:calc(var(--match-sq)*0.16)] leading-none ${
          selected ? "text-ink/80" : "text-white/75"
        }`}
      >
        {position ?? ""}
      </span>
    </button>
  );
}

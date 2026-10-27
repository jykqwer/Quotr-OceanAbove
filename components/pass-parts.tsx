export function PerforatedRule() {
  return (
    <div className="relative">
      <div className="border-t border-dashed border-ink-900/30" />
      <span
        aria-hidden="true"
        className="absolute -left-[8px] -top-[8px] h-4 w-4 rounded-full border border-white/10 bg-abyss-950 shadow-[inset_0_0_0_1px_rgba(27,36,48,0.35)]"
      />
      <span
        aria-hidden="true"
        className="absolute -right-[8px] -top-[8px] h-4 w-4 rounded-full border border-white/10 bg-abyss-950 shadow-[inset_0_0_0_1px_rgba(27,36,48,0.35)]"
      />
    </div>
  );
}

function bars(value: string, count = 44): number[] {
  let hash = 2166136261;
  const widths: number[] = [];
  for (let i = 0; i < count; i += 1) {
    hash ^= value.charCodeAt(i % value.length) || 7;
    hash = Math.imul(hash, 16777619) >>> 0;
    widths.push(1 + (hash % 3));
  }
  return widths;
}

/** Deterministic bar pattern derived from the ticket id — it encodes that id, nothing else. */
export function Barcode({ value }: { value: string }) {
  return (
    <div className="flex h-6 items-end gap-[2px]" aria-hidden="true">
      {bars(value).map((width, index) => (
        <span
          key={index}
          className="bg-ink-700/80"
          style={{ width, height: index % 4 === 0 ? "100%" : "68%" }}
        />
      ))}
    </div>
  );
}

/** The ink stamp that lands when a quote becomes a ticket. */
export function IssuedStamp({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
      <span className="display block animate-stamp whitespace-nowrap border-2 border-sunset-600/55 bg-cream-100/70 px-2.5 py-0.5 text-[13px] font-semibold uppercase tracking-[0.3em] text-sunset-600/80">
        {label}
      </span>
    </div>
  );
}

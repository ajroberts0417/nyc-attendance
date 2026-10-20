// Every school's attendance on one day as a tick on a common scale, with the city (and optionally one school) marked.
export default function StripPlot({
  values,
  mark,
  city,
  label,
}: {
  values: number[];
  mark: number | null;
  city: number | null;
  label: string;
}) {
  const lo = Math.floor(Math.min(...values, mark ?? 100) / 10) * 10;
  const pos = (v: number) => `${((v - lo) / (100 - lo)) * 100}%`;
  const ticks = Array.from({ length: (100 - lo) / 10 + 1 }, (_, i) => lo + i * 10);

  return (
    <figure className="w-full">
      <figcaption className="mb-6 text-xs text-ink-2">{label}</figcaption>
      <div className="relative h-14">
        {values.map((v, i) => (
          <span key={i} className="absolute inset-y-0 w-px bg-ink opacity-[0.14]" style={{ left: pos(v) }} />
        ))}
        {city !== null && (
          <span className="absolute -top-2 -bottom-1 border-l border-dashed border-ink" style={{ left: pos(city) }}>
            <span className="absolute -top-5 -translate-x-1/2 text-xs whitespace-nowrap text-ink-2 tabular-nums">City {city.toFixed(1)}</span>
          </span>
        )}
        {mark !== null && (
          <span className="absolute inset-y-0 w-1 -translate-x-1/2 bg-accent ring-2 ring-page" style={{ left: pos(mark) }}>
            <span className="absolute top-full mt-1 -translate-x-1/4 text-sm font-semibold whitespace-nowrap text-accent tabular-nums">
              {mark.toFixed(1)}
            </span>
          </span>
        )}
      </div>
      <div className="relative mt-7 h-5 border-t border-line text-[11px] text-ink-3 tabular-nums">
        {ticks.map((t, i) => (
          <span
            key={t}
            className={`absolute top-1 ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: pos(t) }}
          >
            {t}
            {i === ticks.length - 1 ? "%" : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

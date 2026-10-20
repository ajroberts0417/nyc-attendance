"use client";

import { useEffect, useRef, useState } from "react";

export type Series = {
  name: string;
  color: string;
  dashed?: boolean;
  points: { date: string; value: number | null }[];
};

const short = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export default function TrendChart({
  series,
  height = 200,
  selected,
  onSelect,
}: {
  series: Series[];
  height?: number;
  selected?: string;
  onSelect?: (date: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labelled = series.length > 1;
  const M = { top: 10, right: labelled ? 84 : 8, bottom: 24, left: 34 };
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null);
  const lo = values.length ? Math.floor((Math.min(...values) - 1) / 5) * 5 : 80;
  const hi = values.length ? Math.min(100, Math.ceil((Math.max(...values) + 1) / 5) * 5) : 100;
  const step = hi - lo > 20 ? 10 : 5;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

  const iw = Math.max(0, w - M.left - M.right);
  const ih = height - M.top - M.bottom;
  const x = (i: number) => M.left + (dates.length === 1 ? iw / 2 : (i / (dates.length - 1)) * iw);
  const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
  const nX = Math.max(2, Math.min(6, Math.floor(iw / 90)));
  const xTicks = dates.length <= nX ? dates.map((_, i) => i) : Array.from({ length: nX }, (_, k) => Math.round((k / (nX - 1)) * (dates.length - 1)));
  const sel = selected ? dates.indexOf(selected) : -1;

  const lines = series.map((s) => {
    const byDate = new Map(s.points.map((p) => [p.date, p.value]));
    let d = "";
    let pen = false;
    let last: [number, number] | null = null;
    dates.forEach((date, i) => {
      const v = byDate.get(date);
      if (v == null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
      last = [x(i), y(v)];
    });
    return { ...s, d, byDate, last: last as [number, number] | null };
  });

  const indexAt = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = dates.length === 1 ? 0 : Math.round(((e.clientX - rect.left) / rect.width) * (dates.length - 1));
    return Math.max(0, Math.min(dates.length - 1, i));
  };

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={w} height={height} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
            {short(dates[i])}
          </text>
        ))}
        {sel >= 0 && <line x1={x(sel)} x2={x(sel)} y1={M.top} y2={M.top + ih} stroke="var(--ink)" strokeWidth={1} />}
        {hover !== null && hover !== sel && (
          <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--ink-3)" strokeDasharray="2 3" />
        )}
        {lines.map((s) => (
          <g key={s.name}>
            <path d={s.d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.dashed ? "4 4" : undefined} />
            {[sel, hover].map((i, k) => {
              const v = i !== null && i >= 0 ? s.byDate.get(dates[i]) : null;
              return v == null ? null : <circle key={k} cx={x(i!)} cy={y(v)} r={4} fill={s.color} stroke="var(--page)" strokeWidth={2} />;
            })}
            {dates.length < 40 &&
              dates.map((date, i) => {
                const v = s.byDate.get(date);
                return v == null || i === sel ? null : <circle key={date} cx={x(i)} cy={y(v)} r={2} fill={s.color} />;
              })}
            {labelled && s.last && (
              <text x={s.last[0] + 8} y={s.last[1]} dy="0.32em" fontSize={12} fill="var(--ink-2)">
                {s.name}
              </text>
            )}
          </g>
        ))}
        <rect
          x={M.left}
          y={0}
          width={iw}
          height={height}
          fill="transparent"
          className={onSelect ? "cursor-pointer" : undefined}
          onPointerMove={(e) => setHover(indexAt(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelect?.(dates[indexAt(e)])}
        />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: Math.min(x(hover) + 12, Math.max(0, w - 170)), top: 0 }}>
          <div className="text-ink-2">{long(dates[hover])}</div>
          {lines.map((s) => {
            const v = s.byDate.get(dates[hover]);
            return (
              <div key={s.name} className="flex items-center gap-2">
                {labelled && <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />}
                {labelled && <span className="flex-1 text-ink-2">{s.name}</span>}
                <span className="font-medium tabular-nums">{v == null ? "—" : `${v.toFixed(1)}%`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export type Series = {
  name: string;
  color: string;
  dashed?: boolean;
  points: { date: string; value: number | null }[];
};

const H = 220;
const M = { top: 12, right: 16, bottom: 28, left: 40 };

const short = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

export default function TrendChart({ series, height = H }: { series: Series[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null);
  const lo = values.length ? Math.floor((Math.min(...values) - 1) / 5) * 5 : 80;
  const hi = values.length ? Math.min(100, Math.ceil((Math.max(...values) + 1) / 5) * 5) : 100;
  const ticks = Array.from({ length: Math.round((hi - lo) / 5) + 1 }, (_, i) => lo + i * 5).filter(
    (_, i, a) => a.length <= 6 || i % 2 === 0,
  );

  const iw = w - M.left - M.right;
  const ih = height - M.top - M.bottom;
  const x = (i: number) => M.left + (dates.length === 1 ? iw / 2 : (i / (dates.length - 1)) * iw);
  const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
  const xTicks = dates.length <= 8 ? dates.map((_, i) => i) : Array.from({ length: 6 }, (_, k) => Math.round((k / 5) * (dates.length - 1)));

  const lines = series.map((s) => {
    const byDate = new Map(s.points.map((p) => [p.date, p.value]));
    let d = "";
    let pen = false;
    dates.forEach((date, i) => {
      const v = byDate.get(date);
      if (v == null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return { ...s, d, byDate };
  });

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = dates.length === 1 ? 0 : Math.round((px / rect.width) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  }

  const showDots = dates.length <= 40;

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={w} height={height} className="block overflow-visible" role="img" aria-label={series.map((s) => s.name).join(" vs ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {t}%
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
            {short(dates[i])}
          </text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--ink-3)" strokeDasharray="2 3" />}
        {lines.map((s) => (
          <g key={s.name}>
            <path d={s.d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.dashed ? "4 4" : undefined} />
            {dates.map((date, i) => {
              const v = s.byDate.get(date);
              if (v == null || (!showDots && hover !== i)) return null;
              return (
                <circle key={date} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              );
            })}
          </g>
        ))}
        <rect
          x={M.left}
          y={0}
          width={Math.max(0, iw)}
          height={height}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(x(hover) + 12, w - 180), top: M.top }}
        >
          <div className="mb-1 font-medium text-ink">{long(dates[hover])}</div>
          {lines.map((s) => {
            const v = s.byDate.get(dates[hover]);
            return (
              <div key={s.name} className="flex items-center gap-2 text-ink-2">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                <span className="flex-1">{s.name}</span>
                <span className="font-medium text-ink">{v == null ? "—" : `${v.toFixed(2)}%`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

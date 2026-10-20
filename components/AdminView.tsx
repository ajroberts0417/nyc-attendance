"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCsv } from "@/lib/csv";

export type DayLog = { date: string; citywide: string; schools: number; reported: number; fetchedAt: string };
type Row = { dbn: string; name: string; pct: string };
type Live = { fetchedAt: string; citywide: string; rows: (Row & { date: string })[] } | { error: string };

const toRows = (text: string): Row[] => parseCsv(text).map(([dbn, name, pct]) => ({ dbn, name, pct }));
const et = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

type Filter = "all" | "ns" | "new" | "missing" | "big";
const FILTERS: [Filter, string][] = [
  ["all", "All rows"],
  ["ns", "Not submitted"],
  ["new", "New vs. previous day"],
  ["missing", "Missing vs. previous day"],
  ["big", "Changed ≥ 10 pts"],
];

export default function AdminView({ log, sourceUrl }: { log: DayLog[]; sourceUrl: string }) {
  const [date, setDate] = useState(log[log.length - 1]?.date);
  const [files, setFiles] = useState<Record<string, Row[]>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [checking, setChecking] = useState(false);

  const idx = log.findIndex((d) => d.date === date);
  const prevDate = idx > 0 ? log[idx - 1].date : null;

  useEffect(() => {
    for (const d of [date, prevDate]) {
      if (!d || files[d]) continue;
      fetch(`/data/days/${d}.csv`)
        .then((r) => r.text())
        .then((t) => setFiles((f) => ({ ...f, [d]: toRows(t) })));
    }
  }, [date, prevDate, files]);

  const rows = useMemo(() => files[date] ?? [], [files, date]);
  const prev = useMemo(() => new Map((prevDate ? files[prevDate] ?? [] : []).map((r) => [r.dbn, r])), [files, prevDate]);

  const enriched = useMemo(() => {
    const here = new Set(rows.map((r) => r.dbn));
    const list = rows.map((r) => {
      const p = prev.get(r.dbn);
      const delta = p && r.pct && p.pct ? Number(r.pct) - Number(p.pct) : null;
      return { ...r, prevPct: p?.pct ?? null, delta, isNew: !!prevDate && !p, missing: false };
    });
    const gone = [...prev.values()]
      .filter((p) => !here.has(p.dbn))
      .map((p) => ({ dbn: p.dbn, name: p.name, pct: "", prevPct: p.pct, delta: null, isNew: false, missing: true }));
    return [...list, ...gone];
  }, [rows, prev, prevDate]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched.filter((r) => {
      if (needle && !r.dbn.toLowerCase().includes(needle) && !r.name.toLowerCase().includes(needle)) return false;
      if (filter === "ns") return !r.missing && r.pct === "";
      if (filter === "new") return r.isNew;
      if (filter === "missing") return r.missing;
      if (filter === "big") return r.delta !== null && Math.abs(r.delta) >= 10;
      return true;
    });
  }, [enriched, q, filter]);

  const counts = useMemo(
    () => ({
      ns: enriched.filter((r) => !r.missing && r.pct === "").length,
      new: enriched.filter((r) => r.isNew).length,
      missing: enriched.filter((r) => r.missing).length,
      big: enriched.filter((r) => r.delta !== null && Math.abs(r.delta) >= 10).length,
    }),
    [enriched],
  );

  async function checkLive() {
    setChecking(true);
    try {
      setLive(await fetch("/api/source", { cache: "no-store" }).then((r) => r.json()));
    } catch (e) {
      setLive({ error: (e as Error).message });
    }
    setChecking(false);
  }

  const liveCheck = useMemo(() => {
    if (!live || "error" in live) return null;
    const liveDate = live.rows[0]?.date;
    const archived = log.find((d) => d.date === liveDate);
    const stored = liveDate ? files[liveDate] : undefined;
    if (!archived || !stored) return { liveDate, archived: !!archived, loaded: !!stored, diffs: [] as { dbn: string; name: string; stored: string | null; live: string | null }[] };
    const storedMap = new Map(stored.map((r) => [r.dbn, r]));
    const liveMap = new Map(live.rows.map((r) => [r.dbn, r]));
    const diffs: { dbn: string; name: string; stored: string | null; live: string | null }[] = [];
    for (const r of live.rows) {
      const s = storedMap.get(r.dbn);
      if (!s || s.pct !== r.pct || s.name !== r.name) diffs.push({ dbn: r.dbn, name: r.name, stored: s ? s.pct || "NS" : null, live: r.pct || "NS" });
    }
    for (const s of stored) if (!liveMap.has(s.dbn)) diffs.push({ dbn: s.dbn, name: s.name, stored: s.pct || "NS", live: null });
    return { liveDate, archived: true, loaded: true, diffs };
  }, [live, log, files]);

  // Load the archived file for the live date so the comparison can run.
  useEffect(() => {
    const d = liveCheck?.liveDate;
    if (d && liveCheck?.archived && !files[d]) {
      fetch(`/data/days/${d}.csv`)
        .then((r) => r.text())
        .then((t) => setFiles((f) => ({ ...f, [d]: toRows(t) })));
    }
  }, [liveCheck, files]);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Collection log</h2>
          <a href="/data/citywide.csv" className="text-xs text-accent hover:underline">
            citywide.csv
          </a>
        </div>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-3">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">School day</th>
                <th className="px-4 py-2 text-right font-medium">Citywide</th>
                <th className="px-4 py-2 text-right font-medium">Schools</th>
                <th className="px-4 py-2 text-right font-medium">Reported</th>
                <th className="px-4 py-2 text-right font-medium">Not submitted</th>
                <th className="px-4 py-2 text-right font-medium">Last saved (ET)</th>
              </tr>
            </thead>
            <tbody>
              {[...log].reverse().map((d) => (
                <tr
                  key={d.date}
                  onClick={() => setDate(d.date)}
                  className={`cursor-pointer border-b border-border last:border-0 ${d.date === date ? "bg-page font-medium" : "hover:bg-page"}`}
                >
                  <td className="px-4 py-2">{day(d.date)}</td>
                  <td className="px-4 py-2 text-right">{d.citywide ? `${d.citywide}%` : "—"}</td>
                  <td className="px-4 py-2 text-right">{d.schools.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{d.reported.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{(d.schools - d.reported).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-ink-2">{et(d.fetchedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Check against the live DOE page</h2>
            <p className="text-xs text-ink-3">
              Fetches{" "}
              <a href={sourceUrl} className="text-accent hover:underline">
                the source
              </a>{" "}
              now and compares every row with the archive.
            </p>
          </div>
          <button
            onClick={checkLive}
            disabled={checking}
            className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {checking ? "Fetching…" : "Run check"}
          </button>
        </div>
        {live && "error" in live && <p className="mt-3 text-sm text-red-600">Couldn’t read the source: {live.error}</p>}
        {live && !("error" in live) && liveCheck && (
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Source shows", liveCheck.liveDate ? day(liveCheck.liveDate) : "—"],
                ["Source citywide", live.citywide ? `${live.citywide}%` : "—"],
                ["Source rows", live.rows.length.toLocaleString()],
                [
                  "Result",
                  !liveCheck.archived ? "Not archived yet" : !liveCheck.loaded ? "Loading…" : liveCheck.diffs.length ? `${liveCheck.diffs.length} differences` : "Exact match",
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-page px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-ink-3">{k}</div>
                  <div className="font-semibold">{v}</div>
                </div>
              ))}
            </div>
            {!liveCheck.archived && <p className="text-ink-2">The next hourly run will save this day.</p>}
            {liveCheck.diffs.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-3">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">DBN</th>
                      <th className="px-3 py-2 font-medium">School</th>
                      <th className="px-3 py-2 text-right font-medium">Archive</th>
                      <th className="px-3 py-2 text-right font-medium">Live</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveCheck.diffs.map((d) => (
                      <tr key={d.dbn} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 font-mono text-xs">{d.dbn}</td>
                        <td className="px-3 py-1.5">{d.name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{d.stored ?? "absent"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{d.live ?? "absent"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="mr-auto text-sm font-semibold">
            Raw rows · {date ? day(date) : "—"}
            {prevDate && <span className="font-normal text-ink-3"> · compared with {day(prevDate)}</span>}
          </h2>
          <select className="field" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {FILTERS.map(([k, label]) => (
              <option key={k} value={k} disabled={k !== "all" && k !== "ns" && !prevDate}>
                {label}
                {k !== "all" ? ` (${counts[k]})` : ""}
              </option>
            ))}
          </select>
          <input className="field w-48" placeholder="Search DBN or name…" value={q} onChange={(e) => setQ(e.target.value)} />
          <a href={`/data/days/${date}.csv`} className="text-xs text-accent hover:underline">
            {date}.csv
          </a>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-3">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-right font-medium">#</th>
                <th className="px-3 py-2 font-medium">DBN</th>
                <th className="px-3 py-2 font-medium">School name (as published)</th>
                <th className="px-3 py-2 text-right font-medium">%ATTD</th>
                <th className="px-3 py-2 text-right font-medium">Prev. day</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
                <th className="px-3 py-2 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.dbn} className="border-b border-border last:border-0 hover:bg-page">
                  <td className="px-3 py-1.5 text-right text-xs text-ink-3">{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.dbn}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.missing ? "" : r.pct || "NS"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink-2">{prevDate ? (r.prevPct === null ? "" : r.prevPct || "NS") : ""}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink-2">
                    {r.delta === null ? "" : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {r.missing && <span className="rounded bg-page px-1.5 py-0.5 text-ink-2">missing</span>}
                    {r.isNew && <span className="rounded bg-page px-1.5 py-0.5 text-ink-2">new</span>}
                    {!r.missing && r.pct === "" && <span className="rounded bg-page px-1.5 py-0.5 text-ink-2">not submitted</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!files[date] && <p className="p-4 text-sm text-ink-3">Loading…</p>}
        </div>
        <div className="border-t border-border px-4 py-2 text-xs text-ink-3">
          {shown.length.toLocaleString()} of {enriched.length.toLocaleString()} rows
        </div>
      </section>
    </div>
  );
}

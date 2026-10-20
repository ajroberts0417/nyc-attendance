import Explorer from "@/components/Explorer";
import TrendChart from "@/components/TrendChart";
import { fmtDate, fmtPct, getDay, getDays, getDistrictShapes, getSchools, mean } from "@/lib/data";

export default async function Home() {
  const [days, schools, shapes] = await Promise.all([getDays(), getSchools(), getDistrictShapes()]);
  const latest = days[days.length - 1];
  const latestDay = await getDay(latest.date);
  const updated = new Date(latest.fetchedAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main>
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">NYC School Attendance Tracker</h1>
        <p className="mt-1 italic text-ink-2">
          A daily archive of attendance at every NYC public school, saved before the DOE replaces it.
        </p>
        <p className="mt-2 text-sm text-ink-3">
          Last updated {updated} · Download:{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="/data/all-days.csv" download>
            all days (CSV)
          </a>
          ,{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="/data/citywide.csv" download>
            citywide (CSV)
          </a>{" "}
          ·{" "}
          <a className="text-accent underline-offset-2 hover:underline" href="https://www.nycenet.edu/PublicApps/Attendance.aspx">
            Source
          </a>
        </p>
      </header>

      <section
        className="mt-6 rounded-2xl p-6 text-white sm:p-8"
        style={{ background: "linear-gradient(135deg, var(--hero-from), var(--hero-to))" }}
      >
        <div className="text-5xl font-bold tracking-tight sm:text-6xl">{fmtPct(latest.citywide, 2)}</div>
        <div className="mt-1 text-white/85">citywide attendance · {fmtDate(latest.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-5 sm:grid-cols-4">
          {[
            [latest.schools.toLocaleString(), "Schools"],
            [latest.reported.toLocaleString(), "Reported"],
            [days.length.toLocaleString(), days.length === 1 ? "Day archived" : "Days archived"],
            [fmtDate(days[0].date, { month: "short", day: "numeric", year: "numeric" }), "Archive since"],
          ].map(([v, k]) => (
            <div key={k} className="flex flex-col-reverse">
              <dt className="text-[11px] uppercase tracking-wider text-white/70">{k}</dt>
              <dd className="text-xl font-semibold sm:text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card mt-6 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Citywide attendance by school day</h2>
        <div className="mt-3">
          <TrendChart
            series={[{ name: "Citywide", color: "var(--accent)", points: days.map((d) => ({ date: d.date, value: d.citywide })) }]}
          />
        </div>
      </section>

      <Explorer
        schools={schools.map((s) => ({
          dbn: s.dbn,
          name: s.name,
          borough: s.borough,
          district: s.district,
          avg: mean(s.history.map((h) => h.pct)),
        }))}
        dates={days.map((d) => d.date)}
        initialDate={latest.date}
        initialDay={Object.fromEntries(latestDay.map((r) => [r.dbn, r.pct]))}
        shapes={shapes}
      />

      <footer className="mt-10 text-xs text-ink-3">
        Data: NYC Public Schools, preliminary figures as of 4 pm. Collected hourly.
      </footer>
    </main>
  );
}

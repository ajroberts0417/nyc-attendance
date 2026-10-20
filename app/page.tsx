import Dashboard from "@/components/Dashboard";
import { getDay, getDays, getDistrictShapes, getSchools } from "@/lib/data";
import { SOURCE_URL } from "@/lib/source.mjs";

export default async function Home() {
  const [days, schools, shapes] = await Promise.all([getDays(), getSchools(), getDistrictShapes()]);
  const latest = days[days.length - 1];
  const latestDay = await getDay(latest.date);

  return (
    <main>
      <Dashboard
        days={days.map((d) => ({ date: d.date, citywide: d.citywide }))}
        schools={schools.map((s) => ({ dbn: s.dbn, name: s.name, district: s.district }))}
        initialDay={Object.fromEntries(latestDay.map((r) => [r.dbn, r.pct]))}
        shapes={shapes}
      />
      <footer className="mt-16 -ml-2 flex text-sm text-ink-2">
        <a href={SOURCE_URL} className="px-2 py-2.5 hover:text-ink">
          Source
        </a>
        <a href="/data/all-days.csv" download className="px-2 py-2.5 hover:text-ink">
          CSV
        </a>
        <a href="/admin" className="px-2 py-2.5 hover:text-ink">
          Admin
        </a>
      </footer>
    </main>
  );
}

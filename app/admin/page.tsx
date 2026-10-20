import Link from "next/link";
import AdminView from "@/components/AdminView";
import { getDays } from "@/lib/data";
import { SOURCE_URL } from "@/lib/source.mjs";

export const metadata = { title: "Source data · NYC School Attendance", robots: { index: false } };

export default async function Admin() {
  const days = await getDays();
  return (
    <main>
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Tracker
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-bold tracking-tight">Source data</h1>
      <AdminView
        sourceUrl={SOURCE_URL}
        log={days.map((d) => ({
          date: d.date,
          citywide: d.citywide === null ? "" : d.citywide.toFixed(2),
          schools: d.schools,
          reported: d.reported,
          fetchedAt: d.fetchedAt,
        }))}
      />
    </main>
  );
}

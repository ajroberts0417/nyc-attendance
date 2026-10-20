import { connection } from "next/server";
import { scrape } from "@/lib/source.mjs";

// Live read of the DOE page, for checking the archive against the source.
export async function GET() {
  await connection();
  try {
    const { citywide, rows } = await scrape();
    return Response.json({ fetchedAt: new Date().toISOString(), citywide, rows });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

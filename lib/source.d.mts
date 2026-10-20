export const SOURCE_URL: string;
export function scrape(): Promise<{
  citywide: string;
  rows: { dbn: string; name: string; date: string; pct: string }[];
}>;

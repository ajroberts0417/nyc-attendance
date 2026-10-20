// One-off: turns NYC school district shapes (NYC Open Data 8ugf-3d8u) into small SVG paths.
// Usage: node scripts/build-map.mjs <districts.geojson>
import { readFileSync, writeFileSync } from "node:fs";
import { geoMercator, geoPath } from "d3-geo";

const W = 600, H = 620;
const geo = JSON.parse(readFileSync(process.argv[2], "utf8"));
const projection = geoMercator().fitSize([W, H], geo);
const path = geoPath(projection).digits(1);

// Drop vertices closer than ~1.6px to keep the file small.
const simplify = (d) =>
  d.replace(/M[^Z]*Z/g, (ring) => {
    const pts = ring.slice(1, -1).split("L").map((p) => p.split(",").map(Number));
    const kept = [pts[0]];
    for (const p of pts.slice(1)) {
      const q = kept[kept.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.6) kept.push(p);
    }
    return kept.length < 3 ? "" : "M" + kept.map((p) => p.join(",")).join("L") + "Z";
  });

const out = {};
for (const f of geo.features) {
  const id = String(f.properties.schooldist).padStart(2, "0");
  const centroid = projection(geoPath().centroid(f)) ?? [0, 0];
  const d = simplify(path(f));
  out[id] = out[id] ? { ...out[id], d: out[id].d + d } : { d, cx: Math.round(centroid[0]), cy: Math.round(centroid[1]) };
}
writeFileSync("data/geo/districts.json", JSON.stringify({ width: W, height: H, districts: out }));
console.log(Object.keys(out).length, "districts,", JSON.stringify(out).length, "bytes");

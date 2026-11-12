import { formatUtc, type Optical, type Stats } from "./types";

const pct = (n: number | string) => `${(Number(n) * 100).toFixed(1)}%`;

// Caption per optical file; every figure comes from optical.json.
const CAPTIONS: Record<string, (c: Record<string, number | string>) => string> = {
  "hls_20260119.webp": (c) =>
    `Fmask flags ${pct(c.fmask_cloud_share)} as cloud` +
    (Number(c.fmask_snow_ice_share) > 0.5
      ? ` and ${pct(c.fmask_snow_ice_share)} as snow/ice: the cloud was misclassified as snow/ice.`
      : ".") +
    ` OPERA DSWx-HLS calls ${pct(c.dswx_hls_snow_ice_share)} snow/ice, impossible here, so this is thick cloud.` +
    ` Shares cover the ${pct(c.tile_covers_share_of_area)} of the area the tile covers.`,
  "landsat_20260120.webp": (c) =>
    `Cloud: ${pct(c.scene_cloud_share)} of the whole scene, ${pct(c.scene_land_cloud_share)} of its land (USGS metadata).`,
};

export default function CloudCard({ area, optical }: { area: Stats; optical: Optical }) {
  const after = area.scenes.find((s) => s.role === "after")!;
  const nisar = `hh_${after.start_utc.slice(0, 10).replace(/-/g, "")}.webp`;
  const tiles = [
    {
      file: nisar,
      title: formatUtc(after.start_utc),
      source: `NISAR L-band radar, HH (${area.release})`,
      caption: "Radar sees through cloud. Dark is open water.",
    },
    ...optical.images.map((im) => ({
      file: im.file,
      title: formatUtc(im.date_utc),
      source: im.source,
      caption: CAPTIONS[im.file]?.(im.cloud) ?? "",
    })),
  ];

  return (
    <section>
      <h2>Clouds: radar against optical</h2>
      <div className="cloud-grid">
        {tiles.map((t) => (
          <figure key={t.file}>
            <a href={`/data/${area.area_id}/${t.file}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- static WebP, no optimisation needed */}
              <img src={`/data/${area.area_id}/${t.file}`} alt={`${t.source}, ${t.title}`} />
            </a>
            <figcaption>
              <b>{t.title}</b>
              <br />
              {t.source}. {t.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      <p>{optical.note}</p>
    </section>
  );
}

import { buildingsLimit, formatUtc, type Stats } from "./types";

const ha = (n: number) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ha`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// What each area's agreement figure is, taken from its limits text.
export const IOU_TAG: Record<string, (s: Stats) => string> = {
  aoi05: (s) => `post-fix rerun; one clean test: ${s.method.parameters.aoi05_test.lightgbm_iou.toFixed(3)}`,
  aoi06: () => "in-sample",
  aoi01: () => "diagnostic",
};

const COVERAGE_NAMES: Record<string, string> = {
  evaluated: "Evaluated",
  outside_mapped_area: "Outside the Copernicus mapped area",
  unclear: "Unclear (HH rose)",
  edge_excluded: "Edge buffer, not scored",
  no_data: "No NISAR data",
};

export default function StatsPanel({ area: s }: { area: Stats }) {
  const r = s.results;
  const tag = IOU_TAG[s.area_id]?.(s);

  return (
    <>
      <h2>{s.name}</h2>
      <p className="banner">
        NISAR {s.release} data, as of {s.as_of_label}
      </p>

      <h2>NISAR scenes</h2>
      {s.scenes.map((sc) => (
        <p key={sc.granule_id}>
          {sc.role === "before" ? "Before" : "After"}: {formatUtc(sc.start_utc)}
          <br />
          <span className="mono">{sc.granule_id}</span>
        </p>
      ))}

      <h2>Reference</h2>
      <table>
        <tbody>
          <tr>
            <td>Source</td>
            <td>
              {s.reference.source}, {s.reference.activation} {s.reference.aoi}
            </td>
          </tr>
          <tr>
            <td>Product</td>
            <td>{s.reference.product}</td>
          </tr>
          <tr>
            <td>Sensor</td>
            <td>
              {s.reference.sensor}, {formatUtc(s.reference.observed_utc)}
            </td>
          </tr>
          <tr>
            <td>Observed flood</td>
            <td>{ha(s.reference.observed_ha)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Detected new water</h2>
      <table>
        <tbody>
          <tr>
            <td>Whole grid</td>
            <td>{ha(r.flooded_ha)}</td>
          </tr>
          <tr>
            <td>Inside the Copernicus mapped area</td>
            <td>{ha(r.flooded_ha_in_mapped_area)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Agreement with Copernicus</h2>
      <table>
        <tbody>
          <tr>
            <td>IoU</td>
            <td>
              {s.agreement.iou.toFixed(3)} {tag && <span className="tag">({tag})</span>}
            </td>
          </tr>
          <tr>
            <td>Precision</td>
            <td>{s.agreement.precision.toFixed(3)}</td>
          </tr>
          <tr>
            <td>Recall</td>
            <td>{s.agreement.recall.toFixed(3)}</td>
          </tr>
          <tr>
            <td>Area scored</td>
            <td>{ha(s.agreement.evaluated_ha)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Coverage of the grid</h2>
      <table>
        <tbody>
          {Object.entries(s.coverage).map(([k, v]) => (
            <tr key={k}>
              <td>{COVERAGE_NAMES[k] ?? k}</td>
              <td>{pct(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.osm_buildings_in_new_water !== undefined && (
        <>
          <h2>Buildings</h2>
          <p>
            {r.osm_buildings_in_new_water.toLocaleString("en-GB")} OpenStreetMap buildings in detected new water
            {r.osm_buildings_on_grid !== undefined &&
              `, of ${r.osm_buildings_on_grid.toLocaleString("en-GB")} on this grid`}
            .
          </p>
          <p>{buildingsLimit(s)}</p>
        </>
      )}
    </>
  );
}

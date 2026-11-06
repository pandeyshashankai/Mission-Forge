import { NASA_DATA, sourceFor } from "../../science/catalog";
export function SourceDetails({
  sourceId,
  field,
  units,
  conversion,
  sourceOverride,
}) {
  const source = sourceFor(sourceId) || sourceOverride;
  if (!source)
    return <small>Existing game input · not verified by this import.</small>;
  return (
    <details className="source-details" data-testid="source-details">
      <summary>Trace this value · source & units</summary>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{source.name}</dd>
        </div>
        <div>
          <dt>Field / input units</dt>
          <dd>
            {field} · {units}
          </dd>
        </div>
        <div>
          <dt>Conversion</dt>
          <dd>{conversion}</dd>
        </div>
        <div>
          <dt>Snapshot</dt>
          <dd>{source.commit || NASA_DATA.commit}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{source.retrievedAt}</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>{source.sha256}</dd>
        </div>
      </dl>
      <a href={source.repositoryUrl} target="_blank" rel="noreferrer">
        Open pinned original ↗
      </a>
      <a href={`/science/sources/${source.file}`} download>
        Download original snapshot
      </a>
      <a href="/science/planetary-data.json" download>
        Download provenance
      </a>
    </details>
  );
}

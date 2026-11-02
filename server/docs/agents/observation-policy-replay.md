# Observation policy replay

Use policy replay to compare proposed deterministic thresholds against a saved corpus without
refreshing charts, publishing observations, or changing production settings.

Run the included corpus from `server/`:

```bash
npm run observations:replay -- tests/fixtures/observation-replay-corpus.json
```

Compare a proposed threshold set:

```bash
npm run observations:replay -- tests/fixtures/observation-replay-corpus.json \
  --publish-score=0.7 \
  --minimum-relative-change=0.12 \
  --minimum-percentage-point-change=1.5
```

The command reports changed decisions, matches against expected outcomes, false positives, and
false negatives. It never writes to the database.

Add `--json` when another tool needs to consume the complete report.

## Corpus contract

A corpus is a JSON file with `version: 1` and a non-empty `scenarios` array. Each scenario contains:

- `id`: a stable scenario name.
- `expectedPublish`: optional expected publication decision.
- `monitor`: the saved monitor importance and metric format.
- `baseline`: the eligible baseline, current and comparison values, completeness, history values,
  and sample count passed to deterministic scoring.

Synthetic-data tools can keep their source-specific scenarios outside the OS repository and export
this neutral corpus contract for replay here.

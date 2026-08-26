#!/usr/bin/env node
/**
 * Checks .internal/data-model-config.json against live Dataverse metadata.
 *
 * The data layer is hand-maintained — nothing regenerates it now that this app
 * is developed outside Power Apps Vibe — so the mapping can silently disagree
 * with the tables it describes. Drift fails quietly at runtime: an unmapped
 * choice is dropped with only a logWarning, and a stale column is sent in the
 * write payload and rejected by Dataverse with a generic error.
 *
 * Two checks:
 *   1. Columns  — select every mapped column from each table. Dataverse names
 *                 any attribute that does not exist, and the lookup is
 *                 case-sensitive, so this validates exact logical names too.
 *   2. Choices  — compare each Choice/Choices column's options against the
 *                 `stringmap` table (value + label).
 *
 * Exits non-zero when anything drifts, so it can gate a deploy.
 * Requires an authenticated PAC CLI profile (`pac auth list`).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(
  readFileSync(join(appRoot, '.internal/data-model-config.json'), 'utf8'),
);
const work = mkdtempSync(join(tmpdir(), 'drift-'));
const findings = [];

/** Run FetchXML through the PAC CLI. Returns { ok, output }. */
function fetchXml(xml) {
  const file = join(work, 'q.xml');
  writeFileSync(file, xml);
  try {
    return {
      ok: true,
      output: execFileSync('pac', ['env', 'fetch', '-xf', file], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      }),
    };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

// Dataverse reports one missing attribute at a time, so drop it and retry to
// find the rest rather than stopping at the first.
const MISSING_ATTR = /doesn't contain attribute with Name = '([^']+)'/;
// The PAC CLI prints query errors to stdout and still exits 0, so the exit
// code alone cannot be trusted — always inspect the output.
const FETCH_ERROR = /^Error: /m;

function checkColumns(table) {
  let remaining = table.columns.map((c) => c.apiPropertyName);
  for (;;) {
    const attrs = remaining.map((n) => `<attribute name="${n}"/>`).join('');
    const result = fetchXml(
      `<fetch><entity name="${table.apiMetadataTableId}">${attrs}</entity></fetch>`,
    );
    if (result.ok && !FETCH_ERROR.test(result.output)) return;
    const match = result.output.match(MISSING_ATTR);
    if (!match) {
      findings.push(
        `QUERY FAILED       ${table.apiMetadataTableId} — ${result.output.trim().split('\n').pop()}`,
      );
      return;
    }
    findings.push(
      `COLUMN NOT IN DATAVERSE  ${table.apiMetadataTableId}.${match[1]}`,
    );
    remaining = remaining.filter((n) => n !== match[1]);
    if (remaining.length === 0) return;
  }
}

function liveChoices(names) {
  if (names.length === 0) return {};
  const values = names.map((n) => `<value>${n}</value>`).join('');
  const result = fetchXml(
    `<fetch><entity name="stringmap"><attribute name="attributename"/>` +
      `<attribute name="value"/><attribute name="attributevalue"/>` +
      `<filter><condition attribute="attributename" operator="in">${values}</condition></filter>` +
      `</entity></fetch>`,
  );
  if (!result.ok || FETCH_ERROR.test(result.output)) {
    findings.push(`QUERY FAILED       stringmap — could not read choice options`);
    return {};
  }
  const live = {};
  for (const line of result.output.split(/\r?\n/)) {
    const match = line.match(/^(\w+)\s+(.+?)\s+(\d[\d,]*)\s+/);
    if (!match) continue;
    const [, attribute, label, value] = match;
    (live[attribute] ??= new Map()).set(
      Number(value.replace(/,/g, '')),
      label.trim(),
    );
  }
  return live;
}

function checkChoices(tables) {
  const choiceColumns = tables.flatMap((table) =>
    table.columns
      .filter((c) => c.type === 'Choice' || c.type === 'Choices')
      .map((column) => ({ table, column })),
  );
  const live = liveChoices([
    ...new Set(choiceColumns.map((c) => c.column.apiPropertyName)),
  ]);

  for (const { table, column } of choiceColumns) {
    const where = `${table.apiMetadataTableId}.${column.apiPropertyName}`;
    const configured = new Map(
      column.optionSetMetadata.options.map((o) => [Number(o.apiValue), o.label]),
    );
    const actual = live[column.apiPropertyName];
    if (!actual) {
      findings.push(`NO OPTIONS IN DATAVERSE  ${where}`);
      continue;
    }
    for (const [value, label] of actual) {
      if (!configured.has(value)) {
        findings.push(`OPTION MISSING IN CONFIG ${where}  ${value} = "${label}"`);
      } else if (configured.get(value) !== label) {
        findings.push(
          `LABEL DIFFERS            ${where}  ${value}  config="${configured.get(value)}" live="${label}"`,
        );
      }
    }
    for (const [value, label] of configured) {
      if (!actual.has(value)) {
        findings.push(`OPTION STALE IN CONFIG   ${where}  ${value} = "${label}"`);
      }
    }
  }
}

const tables = config.tableMappings.filter(
  (t) => t.dataSourceType === 'Dataverse',
);
console.log(
  `Checking ${tables.length} Dataverse tables against the live environment...\n`,
);
for (const table of tables) checkColumns(table);
checkChoices(tables);
rmSync(work, { recursive: true, force: true });

if (findings.length === 0) {
  console.log('No drift. data-model-config.json matches Dataverse.');
  process.exit(0);
}
for (const finding of findings) console.log(finding);
console.log(`\n${findings.length} finding(s).`);
process.exit(1);

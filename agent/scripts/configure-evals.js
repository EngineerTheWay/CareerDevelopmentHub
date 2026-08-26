#!/usr/bin/env node

// Manages the agent's evaluation set (Copilot Studio "Test cases").
//
// A test case is a botcomponent with componenttype 19, schemaname mspva_<guid>,
// name = the prompt text, and data in this shape (copied from an existing one
// created through the portal):
//
//   kind: EvaluationData
//   rows:
//     - source: Manual
//       input: <prompt>
//
//   extensionData:
//     displayOrder: "<sortable number>"
//
// Existing cases are rewritten in place where possible rather than deleted, so
// nothing the portal is tracking gets orphaned. Extra cases are appended.
//
// Usage:
//   node configure-evals.js list
//   node configure-evals.js apply     rewrite/extend from evals.json

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENV_URL = 'https://<ORG_NAME>.crm.dynamics.com';
const DV_REQUEST = '<PAC_SKILLS_PATH>/model-apps/2.4.4/scripts/dataverse-request.js';
const BOT_ID = '<AGENT_BOT_ID>';
const COMPONENT_TYPE_TEST_CASE = 19;

function dv(method, apiPath, body) {
  const args = [DV_REQUEST, ENV_URL, method, apiPath];
  if (body !== undefined) args.push('--body', JSON.stringify(body));
  if (method === 'POST') args.push('--include-headers');
  const out = execFileSync('node', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const parsed = JSON.parse(out);
  if (parsed.status >= 400) {
    const message = parsed.data && parsed.data.error ? parsed.data.error.message : JSON.stringify(parsed.data);
    throw new Error(`${method} ${apiPath} -> ${parsed.status}: ${message}`);
  }
  return parsed;
}

function listCases() {
  const res = dv('GET', `botcomponents?$select=botcomponentid,name,schemaname,data&$filter=_parentbotid_value eq ${BOT_ID} and componenttype eq ${COMPONENT_TYPE_TEST_CASE}`);
  return (res.data && res.data.value) || [];
}

// The prompt appears twice — as the component name and inside the YAML — so both
// have to be kept in step or the portal shows a stale title.
function buildData(input, order) {
  return [
    'kind: EvaluationData',
    'rows:',
    '  - source: Manual',
    `    input: ${JSON.stringify(input)}`,
    '',
    'extensionData:',
    `  displayOrder: "${order}"`,
    '',
  ].join('\n');
}

function cmdList() {
  const cases = listCases();
  process.stdout.write(`${cases.length} test case(s):\n`);
  cases.forEach((c) => {
    const input = (String(c.data).match(/input:\s*(.+)/) || [])[1] || '';
    process.stdout.write(`  ${input.replace(/^"|"$/g, '')}\n`);
  });
}

function cmdApply() {
  const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'evals.json'), 'utf8'));
  const existing = listCases();
  const base = Date.now();
  let rewritten = 0;
  let added = 0;

  specs.forEach((spec, i) => {
    const data = buildData(spec.input, base + i);
    if (i < existing.length) {
      dv('PATCH', `botcomponents(${existing[i].botcomponentid})`, { name: spec.input, data });
      rewritten++;
    } else {
      dv('POST', 'botcomponents', {
        name: spec.input,
        schemaname: `mspva_${crypto.randomUUID()}`,
        componenttype: COMPONENT_TYPE_TEST_CASE,
        statecode: 0,
        statuscode: 1,
        'parentbotid@odata.bind': `/bots(${BOT_ID})`,
        data,
      });
      added++;
    }
  });

  // Any leftovers are stale fictional cases with no counterpart in evals.json.
  const leftover = existing.slice(specs.length);
  leftover.forEach((c) => dv('DELETE', `botcomponents(${c.botcomponentid})`));

  process.stdout.write(`${rewritten} rewritten, ${added} added, ${leftover.length} removed — ${specs.length} total\n`);
}

const command = process.argv[2];
if (command === 'list') cmdList();
else if (command === 'apply') cmdApply();
else {
  process.stderr.write('Usage: node configure-evals.js list | apply\n');
  process.exit(1);
}

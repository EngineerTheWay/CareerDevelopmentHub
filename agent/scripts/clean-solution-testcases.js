#!/usr/bin/env node

// Removes Copilot Studio test cases (botcomponent componenttype 19) from the
// CareerDevelopmentHub solution.
//
// Test cases are dev-time artifacts. They get picked up as solution components
// automatically, and the solution explorer then fails to render them with
// "Entity 'botcomponent' With Id = ... Does Not Exist" even though the record is
// perfectly fine. Removing solution MEMBERSHIP fixes the view; the test cases
// themselves stay on the agent and keep working.
//
// Usage:
//   node clean-solution-testcases.js list
//   node clean-solution-testcases.js remove

const { execFileSync } = require('child_process');

const ENV_URL = 'https://<ORG_NAME>.crm.dynamics.com';
const DV_REQUEST = '<PAC_SKILLS_PATH>/model-apps/2.4.4/scripts/dataverse-request.js';
const SOLUTION = 'CareerDevelopmentHub';
const SOLUTION_ID = '<SOLUTION_ID>';
const BOT_ID = '<AGENT_BOT_ID>';
const COMPONENT_TYPE_BOTCOMPONENT = 10214;
const BOTCOMPONENT_TYPE_TEST_CASE = 19;

function dv(method, apiPath, body) {
  const args = [DV_REQUEST, ENV_URL, method, apiPath];
  if (body !== undefined) args.push('--body', JSON.stringify(body));
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

function testCaseComponents() {
  const sc = dv('GET', `solutioncomponents?$select=objectid&$filter=_solutionid_value eq ${SOLUTION_ID} and componenttype eq ${COMPONENT_TYPE_BOTCOMPONENT}`);
  const inSolution = new Set(((sc.data && sc.data.value) || []).map((r) => String(r.objectid).toLowerCase()));

  const bc = dv('GET', `botcomponents?$select=botcomponentid,name,componenttype&$filter=_parentbotid_value eq ${BOT_ID} and componenttype eq ${BOTCOMPONENT_TYPE_TEST_CASE}`);
  return ((bc.data && bc.data.value) || [])
    .filter((c) => inSolution.has(String(c.botcomponentid).toLowerCase()))
    .map((c) => ({ id: c.botcomponentid, name: c.name }));
}

function cmdList() {
  const rows = testCaseComponents();
  rows.forEach((r) => process.stdout.write(`  ${r.id}  ${String(r.name).slice(0, 60)}\n`));
  process.stdout.write(`${rows.length} test case(s) are solution components\n`);
}

function cmdRemove() {
  const rows = testCaseComponents();
  let removed = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      // RemoveSolutionComponent wants the COMPONENT's objectid in the
      // solutioncomponentid slot, not the solutioncomponent row id.
      dv('POST', 'RemoveSolutionComponent', {
        SolutionComponent: {
          '@odata.type': 'Microsoft.Dynamics.CRM.solutioncomponent',
          solutioncomponentid: r.id,
        },
        ComponentType: COMPONENT_TYPE_BOTCOMPONENT,
        SolutionUniqueName: SOLUTION,
      });
      removed++;
    } catch (err) {
      failed++;
      process.stderr.write(`  FAILED ${r.id}: ${err.message.slice(0, 140)}\n`);
    }
  }

  process.stdout.write(`${removed} removed from the solution, ${failed} failed\n`);
  process.stdout.write('Test case records themselves are untouched and still on the agent.\n');
}

const command = process.argv[2];
if (command === 'list') cmdList();
else if (command === 'remove') cmdRemove();
else {
  process.stderr.write('Usage: node clean-solution-testcases.js list | remove\n');
  process.exit(1);
}

#!/usr/bin/env node

// Verification harness for the agent flows.
//
// The production flows use the Skills trigger ("When an agent calls the flow").
// That trigger only accepts a body from a Copilot Studio agent or from an
// API-hub-authenticated callback URL, so the Flow API's manual /run endpoint
// rejects it with TriggerInputSchemaMismatch and the flows can't be exercised
// directly.
//
// This deploys a throwaway twin of a flow with the trigger swapped to a manual
// Button trigger (same input schema, byte-identical actions), which /run does
// accept. Verifying the twin verifies the real logic: only the trigger kind
// differs, and the trigger does no work beyond supplying the body.
//
// Usage:
//   node test-flow.js deploy <definition.json> '<input-json>'  -> creates ZZTest twin, prints id
//   node test-flow.js clean                      -> removes every ZZTest twin

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Locate the plugin's dataverse-request.js without pinning a user profile or a
// plugin version — both change between machines and plugin updates. Set the
// DV_REQUEST env var to override if the plugin cache lives somewhere else.
function resolveDvRequest() {
  if (process.env.DV_REQUEST) return process.env.DV_REQUEST;
  const base = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'power-platform-skills', 'model-apps');
  let entries = [];
  try {
    entries = fs.readdirSync(base);
  } catch {
    throw new Error(`Cannot find the power-platform-skills plugin cache at ${base}. Set DV_REQUEST to the full path of dataverse-request.js.`);
  }
  const found = entries
    .map((version) => ({ version, file: path.join(base, version, 'scripts', 'dataverse-request.js') }))
    .filter((candidate) => fs.existsSync(candidate.file))
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  if (!found.length) {
    throw new Error(`No scripts/dataverse-request.js under ${base}. Set DV_REQUEST to the full path.`);
  }
  return found[found.length - 1].file;
}

const ENV_URL = 'https://<ORG_NAME>.crm.dynamics.com';
const SOLUTION = 'CareerDevelopmentHub';
const COMPONENT_TYPE_WORKFLOW = 29;
const DV_REQUEST = resolveDvRequest();
const DEFS_DIR = path.join(__dirname, 'definitions');
const TEST_PREFIX = 'ZZTest — ';

const ALL_CONNECTION_REFERENCES = {
  shared_commondataserviceforapps: {
    runtimeSource: 'embedded',
    connection: { connectionReferenceLogicalName: 'cws_careeragentdataverse' },
    api: { name: 'shared_commondataserviceforapps' },
  },
  shared_office365: {
    runtimeSource: 'embedded',
    connection: { connectionReferenceLogicalName: 'cws_careeragentoffice365' },
    api: { name: 'shared_office365' },
  },
};

// Mirrors deploy-flow.js: only reference connectors the flow actually uses.
function connectionRefsFor(definition) {
  const used = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'OpenApiConnection' && node.inputs && node.inputs.host) {
      used.add(node.inputs.host.connectionName);
    }
    Object.values(node).forEach(walk);
  };
  walk(definition.actions);
  const refs = {};
  for (const name of used) refs[name] = ALL_CONNECTION_REFERENCES[name];
  return refs;
}

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

function toManualTrigger(definition, testInput) {
  // The Flow API's manual /run endpoint does not forward a request body, so a
  // Button trigger receives nothing and the schema check fails. Instead the twin
  // carries the test input as a literal Compose and every triggerBody() reference
  // is repointed at it. Everything downstream — the OData filter construction,
  // the Dataverse calls, the match logic, the response shape — runs unchanged.
  let serialized = JSON.stringify(definition);
  serialized = serialized.split("triggerBody()?[").join("outputs('Test_inputs')?[");
  const clone = JSON.parse(serialized);

  const triggerKey = Object.keys(clone.triggers)[0];
  delete clone.triggers[triggerKey];
  clone.triggers.manual = {
    type: 'Request',
    kind: 'Button',
    inputs: { schema: { type: 'object', properties: {} } },
  };

  // Root actions must now wait on the injected input.
  for (const action of Object.values(clone.actions)) {
    if (action.runAfter && Object.keys(action.runAfter).length === 0) {
      action.runAfter = { Test_inputs: ['Succeeded'] };
    }
  }
  clone.actions.Test_inputs = { type: 'Compose', inputs: testInput, runAfter: {} };
  // The platform rejects a Skills "Respond to the agent" action unless the flow
  // also carries the Skills trigger (SkillsResponseActionRequiresSkillsTrigger),
  // so the twin's response becomes a plain HTTP response. Same body, same
  // expressions — only the envelope differs.
  //
  // A Response action is also skipped on a manual run, and the Flow API does not
  // return action outputs, so the twin would run green while telling us nothing.
  // Converting the response into a Compose plus a Terminate carrying the
  // serialized payload pushes the actual returned values into the run's
  // errorMessage, which IS readable. A "Failed" run here means "here is the
  // result", not a defect — the payload is the point.
  const demoteResponses = (actions, container) => {
    for (const [name, action] of Object.entries(actions)) {
      if (action.type === 'Response') {
        container[name] = {
          type: 'Compose',
          inputs: action.inputs.body,
          runAfter: action.runAfter,
        };
        container.Test_result = {
          type: 'Terminate',
          inputs: {
            runStatus: 'Failed',
            runError: { code: 'TEST_RESULT', message: `@string(outputs('${name}'))` },
          },
          runAfter: { [name]: ['Succeeded'] },
        };
      }
      if (action.actions) demoteResponses(action.actions, action.actions);
      if (action.else && action.else.actions) demoteResponses(action.else.actions, action.else.actions);
    }
  };
  demoteResponses(clone.actions, clone.actions);

  // Actions reference the trigger only through triggerBody(), which is
  // trigger-name agnostic, so nothing downstream needs rewriting.
  return clone;
}

function deployTwin(defFile, testInput) {
  const spec = JSON.parse(fs.readFileSync(defFile, 'utf8'));
  const name = TEST_PREFIX + spec.name;
  const definition = toManualTrigger(spec.definition, testInput);
  const clientdata = JSON.stringify({
    properties: { connectionReferences: connectionRefsFor(definition), definition },
    schemaVersion: '1.0.0.0',
  });

  const found = dv('GET', `workflows?$select=workflowid,statecode&$filter=name eq '${name.replace(/'/g, "''")}' and category eq 5`);
  const rows = (found.data && found.data.value) || [];
  let workflowId;

  if (rows.length) {
    workflowId = rows[0].workflowid;
    if (rows[0].statecode === 1) dv('PATCH', `workflows(${workflowId})`, { statecode: 0, statuscode: 1 });
    dv('PATCH', `workflows(${workflowId})`, { clientdata });
  } else {
    const res = dv('POST', 'workflows', {
      name,
      category: 5,
      type: 1,
      primaryentity: 'none',
      statecode: 0,
      statuscode: 1,
      clientdata,
    });
    workflowId = ((res.headers['odata-entityid'] || '').match(/workflows\(([^)]+)\)/) || [])[1];
    if (!workflowId) throw new Error(`${name}: could not read new workflow id`);
  }

  // The twin must be solution-aware or environment variables will not resolve:
  // @parameters('cws_TimeZone (cws_TimeZone)') is only bound for flows that belong
  // to a solution, so a twin outside one fails for the wrong reason. `clean`
  // deletes these workflow rows, which removes them from the solution too — always
  // run it before exporting.
  try {
    dv('POST', 'AddSolutionComponent', {
      ComponentId: workflowId,
      ComponentType: COMPONENT_TYPE_WORKFLOW,
      SolutionUniqueName: SOLUTION,
      AddRequiredComponents: false,
    });
  } catch (err) {
    if (!/already exists|duplicate/i.test(err.message)) throw err;
  }

  dv('PATCH', `workflows(${workflowId})`, { statecode: 1, statuscode: 2 });
  process.stdout.write(`${workflowId}\n`);
}

function clean() {
  const found = dv('GET', `workflows?$select=workflowid,name,statecode&$filter=startswith(name,'${TEST_PREFIX.replace(/'/g, "''")}') and category eq 5`);
  const rows = (found.data && found.data.value) || [];
  for (const row of rows) {
    if (row.statecode === 1) dv('PATCH', `workflows(${row.workflowid})`, { statecode: 0, statuscode: 1 });
    dv('DELETE', `workflows(${row.workflowid})`);
    process.stdout.write(`  removed  ${row.name}\n`);
  }
  process.stdout.write(`${rows.length} test twin(s) removed\n`);
}

const [command, arg, inputJson] = process.argv.slice(2);
if (command === 'deploy') {
  const testInput = JSON.parse(inputJson || '{}');
  deployTwin(path.isAbsolute(arg || '') ? arg : path.join(DEFS_DIR, arg), testInput);
} else if (command === 'clean') {
  clean();
} else {
  process.stderr.write('Usage: node test-flow.js deploy <definition.json> | clean\n');
  process.exit(1);
}

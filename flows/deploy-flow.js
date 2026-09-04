#!/usr/bin/env node

// Deploys an agent flow to Dataverse as a solution-aware workflow record.
//
// The Power Automate Flow API path (flowagent create_flow) binds new flows to an
// embedded CONNECTION rather than a connection REFERENCE, which is what previously
// let the managed aib_sharedcommondataserviceforapps_447d4 reference get auto-bound
// and poison solution export. Writing the workflow record directly keeps the flow
// solution-aware and pinned to cws_careeragentdataverse from birth.
//
// Shape mirrors the working "Daily Brief — Career Development Hub" flow exactly:
//   clientdata = { properties: { connectionReferences, definition }, schemaVersion }
//   workflow   = category 5, type 1, primaryentity "none"
//   OpenApiConnection actions carry NO "authentication" property.
//
// Usage:
//   node deploy-flow.js <definition-file.json> [--activate]
//   node deploy-flow.js --all [--activate]

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
const DV_REQUEST = resolveDvRequest();
const COMPONENT_TYPE_WORKFLOW = 29;
// workflow.modernflowtype: 0 = PowerAutomateFlow, 1 = CopilotStudioFlow, 2 = M365CopilotAgentFlow.
// Setting 1 at creation makes the flow an AGENT FLOW from birth, so it is managed and
// billed by Copilot Studio and needs no manual "change plan" conversion in the portal.
// Same switch the UI performs, and same caveat: it is effectively one-way for billing.
const MODERN_FLOW_TYPE_COPILOT_STUDIO = 1;
const DEFS_DIR = path.join(__dirname, 'definitions');

// Every connector this project can use, keyed by the connectionName that appears
// in an action's host block. Only the ones a flow actually references get written
// into its clientdata — an unused connection reference would still demand a live
// connection at runtime.
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

// ALL_CONNECTION_REFERENCES above describes the AGENT flows. Anything else — the
// scheduled brief, for one — binds to its own connection references and must
// declare them, or it would be silently repointed at the agent's connections.
// A spec's "connectionReferences" maps connectorName -> connectionReferenceLogicalName.
function connectionRefsFor(definition, specRefs) {
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
  for (const name of used) {
    const declared = specRefs && specRefs[name];
    if (declared) {
      refs[name] = {
        runtimeSource: 'embedded',
        connection: { connectionReferenceLogicalName: declared },
        api: { name },
      };
      continue;
    }
    if (!ALL_CONNECTION_REFERENCES[name]) {
      throw new Error(
        `No connection reference configured for connector "${name}". ` +
        `Add it to ALL_CONNECTION_REFERENCES, or declare "connectionReferences": { "${name}": "<logical name>" } in the spec.`
      );
    }
    refs[name] = ALL_CONNECTION_REFERENCES[name];
  }
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

// Dataverse rejects a bare apostrophe in an OData string literal; it must be doubled.
function odataQuote(value) {
  return value.replace(/'/g, "''");
}

function findWorkflowByName(name) {
  const res = dv('GET', `workflows?$select=workflowid,name,statecode,modernflowtype&$filter=name eq '${odataQuote(name)}' and category eq 5`);
  const rows = (res.data && res.data.value) || [];
  return rows.length ? rows[0] : null;
}

// Copilot Studio only treats a trigger/response property as a real agent-facing
// PARAMETER when it carries "x-ms-dynamically-added": true — the marker the agent
// flow designer stamps on anything you add through the UI. A plain typed JSON
// schema (what this pipeline emitted originally) binds as a tool but exposes zero
// inputs and zero outputs, so the agent can neither pass arguments nor read results.
//
// Shape below is copied from a flow that was round-tripped through the designer:
//   { title, description, type: "string", x-ms-content-hint: "TEXT",
//     x-ms-dynamically-added: true }
// plus "additionalProperties": {} on the schema object.
//
// Everything is declared as TEXT because that is the one variant observed working.
// Non-scalar values are serialized with string() so arrays/objects survive as JSON
// text, which the agent reads fine — better a verified single pattern than a guess
// at ARRAY/OBJECT content hints.
function declareParameter(name, spec) {
  return {
    title: spec.title || name,
    description: spec.description || '',
    type: 'string',
    'x-ms-content-hint': 'TEXT',
    'x-ms-dynamically-added': true,
  };
}

// "@expr" -> "@{expr}"; non-scalars get wrapped in string() first. Literals and
// already-interpolated values pass through untouched.
function toTextExpression(value, sourceType) {
  if (typeof value !== 'string') return String(value);
  if (!value.startsWith('@') || value.startsWith('@{')) return value;
  const expr = value.slice(1);
  const needsStringify = sourceType === 'array' || sourceType === 'object';
  return needsStringify ? `@{string(${expr})}` : `@{${expr}}`;
}

function normalizeAgentIO(definition) {
  const def = JSON.parse(JSON.stringify(definition));

  // --- trigger inputs ---
  const triggerKey = Object.keys(def.triggers)[0];
  const trigger = def.triggers[triggerKey];
  const inSchema = trigger.inputs.schema;
  for (const [name, spec] of Object.entries(inSchema.properties || {})) {
    inSchema.properties[name] = {
      ...declareParameter(name, spec),
      // Required-ness is expressed by the schema's own required[] list.
    };
  }
  inSchema.additionalProperties = {};
  // The designer names the agent trigger "manual"; match it so both authoring
  // paths produce identical definitions. triggerBody() is name-agnostic.
  if (triggerKey !== 'manual') {
    delete def.triggers[triggerKey];
    def.triggers.manual = trigger;
  }

  // --- response outputs ---
  for (const action of Object.values(def.actions)) {
    if (action.type !== 'Response') continue;
    const outSchema = action.inputs.schema;
    const body = action.inputs.body || {};
    const newBody = {};
    for (const [name, spec] of Object.entries(outSchema.properties || {})) {
      const sourceType = spec.type;
      outSchema.properties[name] = declareParameter(name, spec);
      if (Object.prototype.hasOwnProperty.call(body, name)) {
        newBody[name] = toTextExpression(body[name], sourceType);
      }
    }
    outSchema.additionalProperties = {};
    action.inputs.body = newBody;
  }

  return def;
}

// normalizeAgentIO reshapes the Skills trigger/response contract, which only agent
// flows have. A non-agent flow (modernflowtype 0, e.g. the scheduled brief) must be
// left alone, exactly as --raw does.
function buildClientData(spec, raw) {
  const definition = spec.definition;
  const isAgentFlow = spec.modernflowtype === undefined || spec.modernflowtype === MODERN_FLOW_TYPE_COPILOT_STUDIO;
  return JSON.stringify({
    properties: {
      connectionReferences: connectionRefsFor(definition, spec.connectionReferences),
      definition: raw || !isAgentFlow ? definition : normalizeAgentIO(definition),
    },
    schemaVersion: '1.0.0.0',
  });
}

function deploy(defFile, activate, raw, allowFlowTypeChange) {
  const spec = JSON.parse(fs.readFileSync(defFile, 'utf8'));
  if (!spec.name || !spec.definition) {
    throw new Error(`${path.basename(defFile)}: spec needs "name" and "definition"`);
  }

  const clientdata = buildClientData(spec, raw);
  const existing = findWorkflowByName(spec.name);
  let workflowId;

  if (existing) {
    // GUARD: never silently change an existing flow's modernflowtype. Switching a
    // plain Power Automate flow (0) to a Copilot Studio agent flow (1) is one-way
    // for billing, and this script used to stamp 1 on every update — which would
    // have converted flows/scheduled/daily-brief.json the first time anyone
    // deployed it. On update we only set the type when the spec asks for a change,
    // and even then only with --allow-flow-type-change.
    const patch = { clientdata };
    if (spec.modernflowtype !== undefined && spec.modernflowtype !== existing.modernflowtype) {
      if (!allowFlowTypeChange) {
        throw new Error(
          `${spec.name}: spec declares modernflowtype ${spec.modernflowtype} but the deployed flow is ${existing.modernflowtype}. ` +
          `Changing it is effectively one-way for billing. Re-run with --allow-flow-type-change if you really mean it.`
        );
      }
      patch.modernflowtype = spec.modernflowtype;
      process.stdout.write(`  WARNING  ${spec.name}: changing modernflowtype ${existing.modernflowtype} -> ${spec.modernflowtype} (one-way)\n`);
    }

    // An activated flow must be drafted before its definition can be rewritten.
    if (existing.statecode === 1) {
      dv('PATCH', `workflows(${existing.workflowid})`, { statecode: 0, statuscode: 1 });
    }
    dv('PATCH', `workflows(${existing.workflowid})`, patch);
    workflowId = existing.workflowid;
    process.stdout.write(`  updated  ${spec.name}\n`);
  } else {
    // New flows default to the Copilot Studio agent-flow type, which is what every
    // definition in definitions/ is. A spec can opt out by declaring modernflowtype
    // (scheduled/daily-brief.json declares 0).
    const newType = spec.modernflowtype !== undefined ? spec.modernflowtype : MODERN_FLOW_TYPE_COPILOT_STUDIO;
    const res = dv('POST', 'workflows', {
      name: spec.name,
      description: spec.description || '',
      category: 5,
      type: 1,
      primaryentity: 'none',
      statecode: 0,
      statuscode: 1,
      modernflowtype: newType,
      clientdata,
    });
    const location = (res.headers && res.headers['odata-entityid']) || '';
    const match = location.match(/workflows\(([^)]+)\)/);
    if (!match) throw new Error(`${spec.name}: could not read new workflow id from response`);
    workflowId = match[1];
    process.stdout.write(`  created  ${spec.name}\n`);
  }

  try {
    dv('POST', 'AddSolutionComponent', {
      ComponentId: workflowId,
      ComponentType: COMPONENT_TYPE_WORKFLOW,
      SolutionUniqueName: SOLUTION,
      AddRequiredComponents: false,
    });
  } catch (err) {
    // Already a member of the solution — not an error on redeploy.
    if (!/already exists|duplicate/i.test(err.message)) throw err;
  }

  if (activate) {
    dv('PATCH', `workflows(${workflowId})`, { statecode: 1, statuscode: 2 });
    process.stdout.write(`  activated\n`);
  }

  return { name: spec.name, workflowId };
}

function main() {
  const args = process.argv.slice(2);
  const activate = args.includes('--activate');
  const targets = args.filter((a) => !a.startsWith('--'));

  let files;
  if (args.includes('--all')) {
    files = fs.readdirSync(DEFS_DIR).filter((f) => f.endsWith('.json')).sort()
      .map((f) => path.join(DEFS_DIR, f));
  } else if (targets.length) {
    files = targets.map((t) => (path.isAbsolute(t) ? t : path.join(DEFS_DIR, t)));
  } else {
    process.stderr.write('Usage: node deploy-flow.js <definition.json | --all> [--activate] [--allow-flow-type-change]\n');
    process.exit(1);
  }

  const results = [];
  let failed = 0;
  for (const file of files) {
    try {
      results.push(deploy(file, activate, args.includes('--raw'), args.includes('--allow-flow-type-change')));
    } catch (err) {
      failed++;
      process.stderr.write(`  FAILED   ${path.basename(file)}: ${err.message}\n`);
    }
  }

  process.stdout.write(`\n${results.length} deployed, ${failed} failed\n`);
  results.forEach((r) => process.stdout.write(`  ${r.workflowId}  ${r.name}\n`));
  if (failed) process.exit(1);
}

main();

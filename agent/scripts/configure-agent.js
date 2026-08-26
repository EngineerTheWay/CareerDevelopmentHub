#!/usr/bin/env node

// Wires the Agent — * flows into a standard-harness agent as tools, by writing
// botcomponent records directly.
//
// Copilot Studio's "Add a tool -> Flow" picker was only surfacing some of the
// flows even though all eight meet the documented criteria (solution flow,
// Skills trigger, Respond to the agent, published, typed outputs). A tool is
// just a botcomponent, so we can bind them without the picker.
//
// The YAML shape below is copied verbatim from the one tool that WAS added
// through the UI (cws_TestAgent.action.AgentGetDashboard), so it is the
// platform's own format rather than a guess.
//
// Usage:
//   node configure-agent.js list          show current tools on the agent
//   node configure-agent.js tools         create/update a tool per flow
//   node configure-agent.js instructions  write the agent instructions

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_URL = 'https://<ORG_NAME>.crm.dynamics.com';
const DV_REQUEST = '<PAC_SKILLS_PATH>/model-apps/2.4.4/scripts/dataverse-request.js';
const DEFS_DIR = path.join(__dirname, '..', 'flows', 'definitions');

const BOT_ID = '<AGENT_BOT_ID>'; // Career Copilot SH
const BOT_PREFIX = 'cws_TestAgent';
const COMPONENT_TYPE_TOPIC = 9;   // topics AND actions/tools both use 9
const COMPONENT_TYPE_GPT = 15;    // agent instructions / model settings

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

function listComponents() {
  const res = dv('GET', `botcomponents?$select=botcomponentid,name,schemaname,componenttype,statecode,data&$filter=_parentbotid_value eq ${BOT_ID}`);
  return (res.data && res.data.value) || [];
}

function findWorkflow(name) {
  const res = dv('GET', `workflows?$select=workflowid,name,statecode&$filter=name eq '${name.replace(/'/g, "''")}' and category eq 5`);
  const rows = (res.data && res.data.value) || [];
  return rows.length ? rows[0] : null;
}

// "Agent — GetDashboard" -> "AgentGetDashboard", matching how the UI named the
// one tool that already exists.
function toSchemaSuffix(displayName) {
  return displayName.replace(/[^A-Za-z0-9]/g, '');
}

// A tool binding must declare its INPUTS as well as its outputs. Without the
// inputs block the agent has no way to pass arguments, so the tool either fails
// or silently calls the flow with nothing — the same class of bug as the missing
// x-ms-dynamically-added markers on the flow side.
//
// Shape copied from a tool added through the Copilot Studio UI
// (cws_TestAgent.action.AgentCreateContact), which is the platform's own format:
//   inputs:
//     - kind: AutomaticTaskInput
//       propertyName: <trigger property>
// "Automatic" means the orchestrator fills the value from conversation context.
// Copilot Studio parses { } in instructions and tool descriptions as Power Fx
// expression segments, so a literal JSON example like {"cws_city":"Denver"} blows
// up at runtime with ContentValidationError / "Unexpected characters" pointing at
// the colon. Nothing agent-facing may contain braces — describe JSON in prose.
function assertNoBraces(text, where) {
  if (/[{}]/.test(text)) {
    throw new Error(
      `${where}: contains { or }, which Copilot Studio parses as a Power Fx expression. ` +
      'Describe the shape in words instead of showing literal JSON.'
    );
  }
}

// An input listed here is left OUT of the tool binding entirely. Copilot Studio
// asks the user for any AutomaticTaskInput it cannot infer a value for, and no
// amount of "this is optional, leave it empty" in the description prevents that
// — verified: the agent quoted the reworded description back while still asking.
// Omitting the input is the only lever available without a verified YAML shape
// for the documented "Custom value" fill setting. The flow keeps the parameter
// in its own schema and treats it as empty, so nothing breaks; the agent simply
// can no longer supply it.
const OMIT_INPUTS = {
  'Agent — ResolveRecord': ['scope', 'allowCreate'],
  // Always stamp the append with today's date; the flow defaults timestamp to true.
  // Exposing it made the agent interrogate the user and refuse to accept "no".
  'Agent — AppendNotes': ['timestamp'],
  // Completing a follow-up should always record today. The flow already does that
  // when completedDate is absent; exposing it only produced a pointless question.
  'Agent — SetFollowUpStatus': ['completedDate'],
};

function buildToolYaml(spec, flowId, outputNames, inputNames) {
  assertNoBraces(spec.description, `${spec.name} description`);
  const lines = [];
  lines.push('kind: TaskDialog');
  if (inputNames.length) {
    lines.push('inputs:');
    for (const name of inputNames) {
      lines.push('  - kind: AutomaticTaskInput');
      lines.push(`    propertyName: ${name}`);
      lines.push('');
    }
  }
  lines.push(`modelDisplayName: ${spec.name.replace(/^Agent\s*[—-]\s*/, '')}`);
  lines.push(`modelDescription: ${JSON.stringify(spec.description)}`);
  lines.push('outputs:');
  // The UI appends a generic "output" alongside the declared schema properties;
  // mirrored here so the two paths produce identical components.
  for (const name of outputNames.concat(['output'])) {
    lines.push(`  - propertyName: ${name}`);
    lines.push('');
  }
  lines.push('action:');
  lines.push('  kind: InvokeFlowTaskAction');
  lines.push(`  flowId: ${flowId}`);
  lines.push('  connectionProperties:');
  lines.push('    $kind: ConnectionProperties');
  lines.push('    diagnostics:');
  lines.push('    mode: Invoker');
  lines.push('');
  lines.push('outputMode: All');
  return lines.join('\n');
}

function readSpecs() {
  return fs.readdirSync(DEFS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const spec = JSON.parse(fs.readFileSync(path.join(DEFS_DIR, f), 'utf8'));
      const response = Object.values(spec.definition.actions).find((a) => a.type === 'Response');
      const props = response && response.inputs.schema && response.inputs.schema.properties
        ? Object.keys(response.inputs.schema.properties)
        : [];
      const trigger = spec.definition.triggers[Object.keys(spec.definition.triggers)[0]];
      const allInputs = trigger && trigger.inputs.schema && trigger.inputs.schema.properties
        ? Object.keys(trigger.inputs.schema.properties)
        : [];
      const omit = OMIT_INPUTS[spec.name] || [];
      const inputs = allInputs.filter((n) => !omit.includes(n));
      return { file: f, name: spec.name, description: spec.description, outputs: props, inputs };
    });
}

function cmdList() {
  const comps = listComponents();
  const tools = comps.filter((c) => (c.schemaname || '').includes('.action.'));
  process.stdout.write(`${comps.length} components, ${tools.length} tools:\n`);
  tools.forEach((t) => {
    const flow = (String(t.data).match(/flowId:\s*([0-9a-f-]+)/) || [])[1] || '?';
    process.stdout.write(`  ${t.name}  ->  ${flow}\n`);
  });
}

function cmdTools() {
  const existing = listComponents();
  let created = 0;
  let skipped = 0;

  for (const spec of readSpecs()) {
    const schemaname = `${BOT_PREFIX}.action.${toSchemaSuffix(spec.name)}`;
    const already = existing.find((c) => c.schemaname === schemaname);

    const flow = findWorkflow(spec.name);
    if (!flow) {
      process.stderr.write(`  NO FLOW  ${spec.name}\n`);
      continue;
    }
    if (flow.statecode !== 1) {
      process.stderr.write(`  DRAFT    ${spec.name} — activate it before binding\n`);
      continue;
    }

    // Rewrite rather than skip: bindings created before the inputs block existed
    // need to be brought up to the current shape, and regenerating everything from
    // one place keeps all 14 identical regardless of how they were first created.
    const data = buildToolYaml(spec, flow.workflowid, spec.outputs, spec.inputs);
    const counts = `(${spec.inputs.length} in / ${spec.outputs.length} out)`;

    if (already) {
      dv('PATCH', `botcomponents(${already.botcomponentid})`, { data });
      process.stdout.write(`  rebound  ${spec.name}  ${counts}\n`);
      skipped++;
    } else {
      dv('POST', 'botcomponents', {
        name: spec.name,
        schemaname,
        componenttype: COMPONENT_TYPE_TOPIC,
        statecode: 0,
        statuscode: 1,
        'parentbotid@odata.bind': `/bots(${BOT_ID})`,
        data,
      });
      process.stdout.write(`  bound    ${spec.name}  ${counts}\n`);
      created++;
    }
  }

  process.stdout.write(`\n${created} newly bound, ${skipped} rebound\n`);
}

function cmdInstructions() {
  const instructionsFile = path.join(__dirname, 'instructions.md');
  const text = fs.readFileSync(instructionsFile, 'utf8').trimEnd();
  assertNoBraces(text, 'instructions.md');

  const gpt = listComponents().find((c) => c.componenttype === COMPONENT_TYPE_GPT);
  if (!gpt) throw new Error('No GptComponentMetadata component found on the agent');

  // Re-emit the component with the instructions block filled in, preserving the
  // model hint the agent already carries.
  const current = String(gpt.data);
  const modelHint = (current.match(/modelNameHint:\s*(\S+)/) || [])[1] || 'Sonnet46';
  const indented = text.split('\n').map((l) => (l.length ? `  ${l}` : '')).join('\n');

  // The bot table has no description column, so the agent description lives here
  // alongside displayName and instructions. Preserve whatever displayName the
  // portal currently holds — renaming the agent in the UI updates it.
  const displayName = (current.match(/displayName:\s*(.+)/) || [])[1] || 'Career Copilot';
  const descriptionFile = path.join(__dirname, 'description.txt');
  const description = fs.existsSync(descriptionFile)
    ? fs.readFileSync(descriptionFile, 'utf8').trim().replace(/\s*\n\s*/g, ' ')
    : '';

  const data = [
    'kind: GptComponentMetadata',
    `displayName: ${displayName.trim()}`,
    ...(description ? [`description: ${JSON.stringify(description)}`] : []),
    'instructions: |-',
    indented,
    'gptCapabilities: {}',
    'aISettings:',
    '  model:',
    `    modelNameHint: ${modelHint}`,
    '',
  ].join('\n');

  const res = dv('GET', `botcomponents?$select=botcomponentid&$filter=_parentbotid_value eq ${BOT_ID} and componenttype eq ${COMPONENT_TYPE_GPT}`);
  const id = res.data.value[0].botcomponentid;
  dv('PATCH', `botcomponents(${id})`, { data });
  process.stdout.write(`instructions written (${text.length} chars, model ${modelHint})\n`);
}

const command = process.argv[2];
if (command === 'list') cmdList();
else if (command === 'tools') cmdTools();
else if (command === 'instructions') cmdInstructions();
else {
  process.stderr.write('Usage: node configure-agent.js list | tools | instructions\n');
  process.exit(1);
}

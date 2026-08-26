#!/usr/bin/env node

// Trims the stock Copilot Studio system topics down to the few that earn their
// place on a generative-orchestration agent.
//
// The default topics are written for classic orchestration, where a canned
// response to "thanks" or "bye" is the whole point. With generative
// orchestration they fire on trigger phrases mid-conversation and cut across
// the orchestrator — "Greeting" even calls CancelAllDialogs, which kills work in
// progress, and "Goodbye" chains into "End of Conversation" and its CSAT survey.
//
// Disabling sets statecode 1 (verified to persist). The topics stay in the agent
// and can be re-enabled from the portal, so nothing is destroyed.
//
// Usage:
//   node lean-topics.js status
//   node lean-topics.js apply

const { execFileSync } = require('child_process');

const ENV_URL = 'https://<ORG_NAME>.crm.dynamics.com';
const DV_REQUEST = '<PAC_SKILLS_PATH>/model-apps/2.4.4/scripts/dataverse-request.js';
const BOT_ID = '<AGENT_BOT_ID>';
const PREFIX = 'cws_TestAgent';

// Canned conversational filler that competes with the orchestrator.
const DISABLE = {
  ThankYou: 'canned "You\'re welcome" hijacks a natural thanks',
  Greeting: 'canned hello, and calls CancelAllDialogs which kills in-progress work',
  Goodbye: 'asks to end the conversation, then chains into the CSAT survey',
  StartOver: 'canned "are you sure you want to restart"',
  ResetConversation: 'canned reset message',
  EndofConversation: 'fires a CSAT survey — wrong for a personal assistant',
  Escalate: 'offers to transfer to a human, which does not exist here',
  MultipleTopicsMatched: 'disambiguation for classic orchestration only',
  Fallback: 'canned "I am not sure how to help", and redirects to Escalate',
};

// Kept on purpose:
//   OnError            - surfaces real errors; it is how several bugs were caught
//   Search             - "Conversational boosting", the generative-answers path
//   Signin             - needed whenever user authentication is on
//   ConversationStart  - kept, but rewritten to say what the agent can actually do
const GREETING =
  "Hi — I can show what's due, look up a contact or application, log an interaction, " +
  'draft an email, or schedule something. What do you need?';

function dv(method, apiPath, body) {
  const args = [DV_REQUEST, ENV_URL, method, apiPath];
  if (body !== undefined) args.push('--body', JSON.stringify(body));
  const out = execFileSync('node', args, {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const parsed = JSON.parse(out);
  if (parsed.status >= 400) {
    const m = parsed.data && parsed.data.error ? parsed.data.error.message : JSON.stringify(parsed.data);
    throw new Error(`${method} ${apiPath} -> ${parsed.status}: ${m}`);
  }
  return parsed;
}

function topics() {
  const res = dv('GET', `botcomponents?$select=botcomponentid,name,schemaname,statecode,data&$filter=_parentbotid_value eq ${BOT_ID} and componenttype eq 9`);
  return ((res.data && res.data.value) || []).filter((c) => (c.schemaname || '').includes('.topic.'));
}

function shortName(schemaname) {
  return String(schemaname).split('.topic.')[1] || '';
}

function cmdStatus() {
  topics().forEach((t) => {
    const key = shortName(t.schemaname);
    const intent = DISABLE[key] ? 'disable' : 'KEEP';
    process.stdout.write(`  ${t.statecode === 1 ? 'off' : 'ON '}  ${intent.padEnd(8)} ${t.name}\n`);
  });
}

function cmdApply() {
  let off = 0;
  let kept = 0;

  for (const t of topics()) {
    const key = shortName(t.schemaname);
    if (DISABLE[key]) {
      if (t.statecode !== 1) {
        dv('PATCH', `botcomponents(${t.botcomponentid})`, { statecode: 1, statuscode: 2 });
        process.stdout.write(`  disabled  ${t.name} — ${DISABLE[key]}\n`);
      }
      off++;
      continue;
    }

    if (key === 'ConversationStart') {
      // Replace only the text the user sees; leave the dialog structure alone.
      const data = String(t.data).replace(
        /- Hello, I'm \{System\.Bot\.Name\}\. How can I help\?/,
        `- ${GREETING}`
      );
      if (data !== String(t.data)) {
        dv('PATCH', `botcomponents(${t.botcomponentid})`, { data });
        process.stdout.write(`  rewrote   ${t.name} greeting\n`);
      }
    }
    kept++;
  }

  process.stdout.write(`\n${off} disabled, ${kept} kept\n`);
}

const cmd = process.argv[2];
if (cmd === 'status') cmdStatus();
else if (cmd === 'apply') cmdApply();
else {
  process.stderr.write('Usage: node lean-topics.js status | apply\n');
  process.exit(1);
}

// End-to-end check of the restore path: write a workbook exactly the way the
// export does, read it back, plan against a pre-populated environment, execute
// against fake creators, and assert the relationships rewired onto NEW ids.
import writeXlsxFile from 'write-excel-file/node';
import readXlsxFile from 'read-excel-file/node';
import { buildPlan, type Workbook } from './src/lib/restore-import';
import { executePlan } from './src/lib/restore-execute';

const FILE = 'restore-roundtrip.xlsx';

const sheets = [
  { sheet: 'Companies', data: [
    ['ID', 'Company', 'Contacts', 'Applications', 'Business Groups', 'Total Linked Records'],
    ['SRC-CO-1', 'Blue Ridge Health', 2, 1, 1, 4],
    ['SRC-CO-2', 'Summit Cloud', 1, 1, 0, 2],
  ]},
  { sheet: 'Business Groups', data: [
    ['ID', 'Business Group', 'Company', 'Contacts', 'Applications', 'Total Linked Records'],
    ['SRC-BG-1', 'Clinical Operations', 'Blue Ridge Health', 1, 1, 2],
  ]},
  { sheet: 'Applications', data: [
    ['ID', 'Role', 'Company', 'Business Group', 'Stage', 'Arrangement', 'City', 'Date Applied', 'Job ID', 'Job Link', 'Associated Contacts', 'Notes'],
    ['SRC-AP-1', 'Cloud Adoption Manager', 'Blue Ridge Health', 'Clinical Operations', 'Interviewing', 'Remote', 'Denver', '2026-07-18', 'J-1', '', '', 'note a'],
    ['SRC-AP-2', 'Revenue Strategy Manager', 'Summit Cloud', '', 'Applied', '', '', '2026-08-03', '', '', '', ''],
  ]},
  { sheet: 'Contacts', data: [
    ['ID', 'Name', 'Role', 'Company', 'Business Group', 'Relationship', 'Email', 'City', 'Associated Applications', 'Notes'],
    // Already exists in the target environment -> must be REUSED
    ['SRC-NC-1', 'Nadia Hassan', 'Program Manager', 'Blue Ridge Health', 'Clinical Operations', 'Warm', 'nadia@example.com', 'Denver', '', 'existing'],
    // New
    ['SRC-NC-2', 'Mina Rao', 'Operations Lead', 'Summit Cloud', '', 'Mentor', 'mina@example.com', 'Seattle', '', 'new'],
  ]},
  { sheet: 'Interactions', data: [
    ['ID', 'Interaction', 'Date', 'Type', 'Contact ID', 'Contact', 'Application ID', 'Application Role', 'Notes'],
    ['SRC-IN-1', 'Coffee chat', '2026-08-20', 'NetworkingChat', 'SRC-NC-1', 'Nadia Hassan', 'SRC-AP-1', 'Cloud Adoption Manager', 'Talked roles'],
    ['SRC-IN-2', 'Call', '2026-08-22', 'Call', 'SRC-NC-2', 'Mina Rao', '', '', 'Quick sync'],
  ]},
  // NOTE: this sheet references its contact/application by NAME and ROLE, not by id
  // - unlike the Interactions sheet. That asymmetry is real, and reading these as
  // ids is what previously orphaned every restored follow-up.
  { sheet: 'Follow-ups', data: [
    ['ID', 'Title', 'Status', 'Due Date', 'Completed Date', 'Related Type', 'Related Contact', 'Related Application', 'Reminder Enabled'],
    ['SRC-FU-1', 'Send thank-you', 'Open', '2026-09-03', '', 'Contact', 'Nadia Hassan', '', ''],
    ['SRC-FU-2', 'Prep questions', 'Open', '2026-09-10', '', 'Application', 'Mina Rao', 'Revenue Strategy Manager', ''],
  ]},
  { sheet: 'Associations', data: [
    ['ID', 'Association Name', 'Contact ID', 'Contact Name', 'Application ID', 'Application Role'],
    ['SRC-CA-1', 'Nadia - Cloud Adoption Manager', 'SRC-NC-1', 'Nadia Hassan', 'SRC-AP-1', 'Cloud Adoption Manager'],
  ]},
];

// The target environment already has one company and one contact.
const existing = {
  companies: [{ id: 'EXIST-CO-1', companyName: 'Blue Ridge Health' }],
  businessGroups: [],
  applications: [],
  contacts: [{
    id: 'EXIST-NC-1', contactName: 'Nadia Hassan', relationshipKey: 'Warm' as const,
    email: 'nadia@example.com', company: { id: 'EXIST-CO-1', companyName: 'Blue Ridge Health' },
  }],
  // Same interaction, already present -> must be reused, not duplicated.
  interactions: [{
    id: 'EXIST-IN-1', interactionName: 'Coffee chat', interactionDate: '2026-08-20',
    interactionTypeKey: 'NetworkingChat' as const,
    contact: { id: 'EXIST-NC-1', contactName: 'Nadia Hassan' },
  }],
  // Deliberately stored at PDT midnight, the legacy shape. Matching must be
  // date-only or this will not be recognised as the same day.
  followUps: [{
    id: 'EXIST-FU-1', title: 'Send thank-you', dueDate: '2026-09-03T07:00:00Z',
    statusKey: 'Open' as const, relatedTypeKey: 'Contact' as const,
  }],
  associations: [],
} as unknown as Parameters<typeof buildPlan>[1];

function assert(label: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  await (writeXlsxFile as never as (s: unknown) => { toFile: (f: string) => Promise<void> })(sheets).toFile(FILE);

  const all = await (readXlsxFile as never as (f: string) => Promise<Array<{ sheet: string; data: unknown[][] }>>)(FILE);
  const book: Workbook = {};
  all.forEach((s) => { book[s.sheet] = s.data as Workbook[string]; });

  console.log('sheets read: ' + Object.keys(book).join(', '));

  const plan = buildPlan(book, existing);
  console.log('\n=== plan ===');
  console.log('  totalCreate=' + plan.totalCreate + '  totalReuse=' + plan.totalReuse + '  issues=' + plan.issues.length);
  plan.issues.forEach((i) => console.log('   issue: ' + i.sheet + ' row ' + i.row + ' - ' + i.reason));

  console.log('\n=== dedup expectations ===');
  assert('Blue Ridge Health reused', plan.counts.companies.reuse === 1);
  assert('Summit Cloud created', plan.counts.companies.create === 1);
  assert('Nadia Hassan reused (matched on email)', plan.counts.contacts.reuse === 1);
  assert('Mina Rao created', plan.counts.contacts.create === 1);
  assert('no rows skipped', plan.issues.length === 0, JSON.stringify(plan.issues));

  // Fake creators hand back predictable new ids.
  let n = 0;
  const newId = (p: string) => `${p}-NEW-${++n}`;
  const written: Record<string, unknown[]> = { company: [], businessGroup: [], application: [], contact: [], interaction: [], followUp: [], association: [] };
  const record = (kind: string, value: unknown) => { written[kind].push(value); return value; };

  const result = await executePlan(plan, {
    company: async (d) => record('company', { ...d, id: newId('CO') }) as never,
    businessGroup: async (d) => record('businessGroup', { ...d, id: newId('BG') }) as never,
    application: async (d) => record('application', { ...d, id: newId('AP') }) as never,
    contact: async (d) => record('contact', { ...d, id: newId('NC') }) as never,
    interaction: async (d) => record('interaction', { ...d, id: newId('IN') }) as never,
    followUp: async (d) => record('followUp', { ...d, id: newId('FU') }) as never,
    association: async (d) => record('association', { ...d, id: newId('CA') }) as never,
  }, { existingAssociations: new Set<string>() });

  console.log('\n=== execute ===');
  console.log('  created=' + result.created + ' reused=' + result.reused + ' skipped=' + result.skipped + ' failures=' + result.failures.length);
  result.failures.forEach((f) => console.log('   failure: ' + f.item + ' - ' + f.reason));

  console.log('\n=== relationship rewiring ===');
  assert('no failures', result.failures.length === 0);
  assert('no skips', result.skipped === 0);

  const apps = written.application as Array<{ role: string; company: { id: string }; businessGroup?: { id: string } }>;
  const cloudApp = apps.find((a) => a.role === 'Cloud Adoption Manager');
  assert('application bound to EXISTING company', cloudApp?.company.id === 'EXIST-CO-1', cloudApp?.company.id);
  assert('application bound to newly created business group', Boolean(cloudApp?.businessGroup?.id?.startsWith('BG-NEW')), cloudApp?.businessGroup?.id);

  const ints = written.interaction as Array<{ interactionName: string; contact: { id: string }; relatedApplication?: { id: string } }>;
  // 'Coffee chat' already exists on the same date, so it must be reused and never written.
  assert('duplicate interaction was NOT written', !ints.some((i) => i.interactionName === 'Coffee chat'));

  const call = ints.find((i) => i.interactionName === 'Call');
  assert('second interaction bound to newly created contact', Boolean(call?.contact.id.startsWith('NC-NEW')), call?.contact.id);

  console.log('\n=== interaction / follow-up dedup on name+date ===');
  assert('duplicate interaction reused, not recreated', plan.counts.interactions.reuse === 1, JSON.stringify(plan.counts.interactions));
  assert('new interaction still created', plan.counts.interactions.create === 1);
  assert('duplicate follow-up reused despite legacy T07:00:00Z date', plan.counts.followUps.reuse === 1, JSON.stringify(plan.counts.followUps));
  assert('new follow-up still created', plan.counts.followUps.create === 1);
  assert('only one interaction written', (written.interaction as unknown[]).length === 1);

  console.log('\n=== follow-up links resolved by NAME (the sheet has no ids) ===');
  const fus = written.followUp as Array<{ title: string; relatedContact?: { id: string }; relatedApplication?: { id: string }; dueDate: string }>;
  const prep = fus.find((f) => f.title === 'Prep questions');
  assert('follow-up bound to contact resolved from a name', Boolean(prep?.relatedContact?.id?.startsWith('NC-NEW')), prep?.relatedContact?.id);
  assert('follow-up bound to application resolved from a role', Boolean(prep?.relatedApplication?.id?.startsWith('AP-NEW')), prep?.relatedApplication?.id);
  assert('follow-up due date survived round trip', prep?.dueDate === '2026-09-10', prep?.dueDate);

  const assoc = written.association as Array<{ networkingContact: { id: string }; jobApplication: { id: string } }>;
  assert('association links existing contact to new application', assoc[0]?.networkingContact.id === 'EXIST-NC-1' && assoc[0]?.jobApplication.id.startsWith('AP-NEW'));

  console.log('\n=== no duplicate company created ===');
  const cos = written.company as Array<{ companyName: string }>;
  assert('only Summit Cloud was created', cos.length === 1 && cos[0].companyName === 'Summit Cloud', JSON.stringify(cos));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

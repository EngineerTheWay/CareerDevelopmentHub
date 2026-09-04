// Restore-from-export planning.
//
// Pure logic, deliberately free of React and of the data layer, so it can be
// reasoned about (and tested) on its own. It turns the sheets of a workbook this
// app exported into an ordered plan of "create this" / "reuse that", which the
// caller then executes.
//
// Why a plan rather than importing directly:
//  - The user gets to see what will happen before anything is written.
//  - The IDs in the file are NOT identity in this environment. Dataverse issues
//    new GUIDs on create, and the code-app SDK cannot supply one (every generated
//    service takes Omit<T, 'id'>). The old IDs are only join keys *within the
//    file*, so the executor keeps an old-id -> new-id map as it goes.

import type { Company } from '@/generated/models/company-model';
import type { BusinessGroup } from '@/generated/models/business-group-model';
import type { NetworkingContact, NetworkingContactRelationshipKey } from '@/generated/models/networking-contact-model';
import { NetworkingContactRelationshipKeyToLabel } from '@/generated/models/networking-contact-model';
import type { JobApplication, JobApplicationStageKey, JobApplicationArrangementKey } from '@/generated/models/job-application-model';
import { JobApplicationStageKeyToLabel, JobApplicationArrangementKeyToLabel } from '@/generated/models/job-application-model';
import type { Interaction, InteractionInteractionTypeKey } from '@/generated/models/interaction-model';
import { InteractionInteractionTypeKeyToLabel } from '@/generated/models/interaction-model';
import type { FollowUp, FollowUpStatusKey, FollowUpRelatedTypeKey } from '@/generated/models/follow-up-model';
import { FollowUpStatusKeyToLabel, FollowUpRelatedTypeKeyToLabel } from '@/generated/models/follow-up-model';
import type { ContactApplication } from '@/generated/models/contact-application-model';

export const SHEETS = {
  companies: 'Companies',
  businessGroups: 'Business Groups',
  applications: 'Applications',
  contacts: 'Contacts',
  interactions: 'Interactions',
  followUps: 'Follow-ups',
  associations: 'Associations',
} as const;

// The order records must be created in, because each depends on the ones above it.
export const IMPORT_ORDER = [
  'companies', 'businessGroups', 'applications', 'contacts', 'interactions', 'followUps', 'associations',
] as const;
export type SheetKey = (typeof IMPORT_ORDER)[number];

export const SHEET_LABEL: Record<SheetKey, string> = {
  companies: 'Companies',
  businessGroups: 'Business groups',
  applications: 'Applications',
  contacts: 'Contacts',
  interactions: 'Interactions',
  followUps: 'Follow-ups',
  associations: 'Associations',
};

export type Cell = string | number | boolean | Date | null | undefined;
export type SheetRows = Cell[][];
export type Workbook = Partial<Record<string, SheetRows>>;

export type PlanCounts = { create: number; reuse: number; skip: number };
export type PlanIssue = { sheet: SheetKey; row: number; reason: string };

export type ImportPlan = {
  counts: Record<SheetKey, PlanCounts>;
  issues: PlanIssue[];
  items: PlanItem[];
  totalCreate: number;
  totalReuse: number;
};

// One unit of work. `existingId` set means "already here, reuse it, create nothing".
export type PlanItem =
  | { kind: 'company'; sourceId: string; existingId?: string; data: { companyName: string } }
  | { kind: 'businessGroup'; sourceId: string; existingId?: string; data: { businessGroupName: string; companySourceId: string } }
  | { kind: 'application'; sourceId: string; existingId?: string; data: ApplicationDraft }
  | { kind: 'contact'; sourceId: string; existingId?: string; data: ContactDraft }
  | { kind: 'interaction'; sourceId: string; existingId?: string; data: InteractionDraft }
  | { kind: 'followUp'; sourceId: string; existingId?: string; data: FollowUpDraft }
  | { kind: 'association'; sourceId: string; existingId?: string; data: { contactSourceId: string; applicationSourceId: string } };

export type ApplicationDraft = {
  role: string; companySourceId: string; businessGroupName?: string;
  stageKey: JobApplicationStageKey; arrangementKey?: JobApplicationArrangementKey;
  city?: string; dateApplied?: string; jobID?: string; jobLink?: string; notes?: string;
};
export type ContactDraft = {
  contactName: string; role?: string; companySourceId: string; businessGroupName?: string;
  relationshipKey: NetworkingContactRelationshipKey; email?: string; city?: string; notes?: string;
};
export type InteractionDraft = {
  interactionName: string; interactionDate: string; interactionTypeKey: InteractionInteractionTypeKey;
  contactSourceId: string; applicationSourceId?: string; notes?: string;
};
export type FollowUpDraft = {
  title: string; statusKey: FollowUpStatusKey; dueDate: string; completedDate?: string;
  relatedTypeKey: FollowUpRelatedTypeKey; contactSourceId?: string; applicationSourceId?: string;
};

export type ExistingData = {
  companies: Company[];
  businessGroups: BusinessGroup[];
  applications: JobApplication[];
  contacts: NetworkingContact[];
  interactions: Interaction[];
  followUps: FollowUp[];
  associations: ContactApplication[];
};

// ---------- cell helpers ----------
export const normalizeName = (value: string) => value.trim().toLowerCase();

const text = (cell: Cell): string => {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return dateKey(cell);
  return String(cell).trim();
};

// The workbook stores dates as yyyy-MM-dd strings, but a reader may hand back a
// Date for a cell Excel decided was a date. Normalise both to a plain date key
// with no timezone shift - these columns are timezone-independent in Dataverse.
const dateKey = (value: Date): string => {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const dateText = (cell: Cell): string => {
  const raw = text(cell);
  return raw ? raw.slice(0, 10) : '';
};

const enumKey = <T extends string>(cell: Cell, valid: Record<string, string>, fallback: T): T => {
  const raw = text(cell);
  return (raw && raw in valid ? raw : fallback) as T;
};

// Header row is row 0; data starts at row 1. Returns [] for a missing sheet so a
// workbook without, say, Associations still imports everything else.
const dataRows = (book: Workbook, sheet: string): SheetRows => {
  const rows = book[sheet];
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).filter((r) => r.some((c) => text(c) !== ''));
};

// ---------- planning ----------
export function buildPlan(book: Workbook, existing: ExistingData): ImportPlan {
  const items: PlanItem[] = [];
  const issues: PlanIssue[] = [];
  const counts = Object.fromEntries(
    IMPORT_ORDER.map((k) => [k, { create: 0, reuse: 0, skip: 0 }]),
  ) as Record<SheetKey, PlanCounts>;

  const bump = (sheet: SheetKey, field: keyof PlanCounts) => { counts[sheet][field] += 1; };

  // --- lookups over what is already in this environment ---
  const companyByName = new Map(existing.companies.map((c) => [normalizeName(c.companyName ?? ''), c]));
  const groupByKey = new Map(existing.businessGroups.map((g) => [`${normalizeName(g.businessGroupName ?? '')}::${g.company?.id ?? ''}`, g]));
  const applicationByKey = new Map(existing.applications.map((a) => [`${normalizeName(a.role ?? '')}::${a.company?.id ?? ''}`, a]));
  const contactByEmail = new Map(existing.contacts.filter((c) => c.email).map((c) => [normalizeName(c.email ?? ''), c]));
  const contactByKey = new Map(existing.contacts.map((c) => [`${normalizeName(c.contactName ?? '')}::${c.company?.id ?? ''}`, c]));
  const associationByKey = new Set(existing.associations.map((a) => `${a.networkingContact?.id ?? ''}::${a.jobApplication?.id ?? ''}`));
  // Interactions and follow-ups match on name/title + date. Dates are compared
  // date-only: rows written before the columns became TimeZoneIndependent sit at
  // local midnight expressed as UTC (07:00:00Z in Pacific), newer ones at 00:00:00Z,
  // so the raw strings differ for what is the same day.
  const interactionByKey = new Map(existing.interactions.map((i) => [`${normalizeName(i.interactionName ?? '')}::${(i.interactionDate ?? '').slice(0, 10)}`, i]));
  const followUpByKey = new Map(existing.followUps.map((f) => [`${normalizeName(f.title ?? '')}::${(f.dueDate ?? '').slice(0, 10)}`, f]));

  // Resolved company id per SOURCE id, for matching children against existing data.
  const companyIdBySource = new Map<string, string>();
  // Business group name per source id, so children can carry the name forward.
  const groupNameBySource = new Map<string, string>();

  // The Follow-ups sheet references its contact and application by name/role rather
  // than by id, so build name -> source id lookups from the sheets that do carry ids.
  // First occurrence wins if a name repeats; that is rare and better than dropping
  // the link entirely, which is what the previous behaviour did.
  const contactSourceIdByName = new Map<string, string>();
  for (const row of dataRows(book, SHEETS.contacts)) {
    const key = normalizeName(text(row[1]));
    if (key && !contactSourceIdByName.has(key)) contactSourceIdByName.set(key, text(row[0]));
  }
  const applicationSourceIdByRole = new Map<string, string>();
  for (const row of dataRows(book, SHEETS.applications)) {
    const key = normalizeName(text(row[1]));
    if (key && !applicationSourceIdByRole.has(key)) applicationSourceIdByRole.set(key, text(row[0]));
  }

  // --- Companies ---
  for (const [i, row] of dataRows(book, SHEETS.companies).entries()) {
    const sourceId = text(row[0]);
    const companyName = text(row[1]);
    if (!companyName) { issues.push({ sheet: 'companies', row: i + 2, reason: 'Missing company name' }); bump('companies', 'skip'); continue; }
    const found = companyByName.get(normalizeName(companyName));
    if (found) {
      items.push({ kind: 'company', sourceId, existingId: found.id, data: { companyName } });
      companyIdBySource.set(sourceId, found.id);
      bump('companies', 'reuse');
    } else {
      items.push({ kind: 'company', sourceId, data: { companyName } });
      bump('companies', 'create');
    }
  }

  // --- Business groups ---
  for (const [i, row] of dataRows(book, SHEETS.businessGroups).entries()) {
    const sourceId = text(row[0]);
    const name = text(row[1]);
    const companyName = text(row[2]);
    if (!name) { issues.push({ sheet: 'businessGroups', row: i + 2, reason: 'Missing business group name' }); bump('businessGroups', 'skip'); continue; }
    const companySourceId = findCompanySourceId(book, companyName);
    if (!companySourceId) { issues.push({ sheet: 'businessGroups', row: i + 2, reason: `No company "${companyName}" in the workbook` }); bump('businessGroups', 'skip'); continue; }
    groupNameBySource.set(sourceId, name);
    const resolvedCompanyId = companyIdBySource.get(companySourceId);
    const found = resolvedCompanyId ? groupByKey.get(`${normalizeName(name)}::${resolvedCompanyId}`) : undefined;
    if (found) {
      items.push({ kind: 'businessGroup', sourceId, existingId: found.id, data: { businessGroupName: name, companySourceId } });
      bump('businessGroups', 'reuse');
    } else {
      items.push({ kind: 'businessGroup', sourceId, data: { businessGroupName: name, companySourceId } });
      bump('businessGroups', 'create');
    }
  }

  // --- Applications ---
  for (const [i, row] of dataRows(book, SHEETS.applications).entries()) {
    const sourceId = text(row[0]);
    const role = text(row[1]);
    const companyName = text(row[2]);
    if (!role) { issues.push({ sheet: 'applications', row: i + 2, reason: 'Missing role' }); bump('applications', 'skip'); continue; }
    const companySourceId = findCompanySourceId(book, companyName);
    if (!companySourceId) { issues.push({ sheet: 'applications', row: i + 2, reason: `No company "${companyName}" in the workbook` }); bump('applications', 'skip'); continue; }
    const draft: ApplicationDraft = {
      role,
      companySourceId,
      businessGroupName: text(row[3]) || undefined,
      stageKey: enumKey(row[4], JobApplicationStageKeyToLabel, 'Researching'),
      arrangementKey: text(row[5]) in JobApplicationArrangementKeyToLabel ? (text(row[5]) as JobApplicationArrangementKey) : undefined,
      city: text(row[6]) || undefined,
      dateApplied: dateText(row[7]) || undefined,
      jobID: text(row[8]) || undefined,
      jobLink: text(row[9]) || undefined,
      notes: text(row[11]) || undefined,
    };
    const resolvedCompanyId = companyIdBySource.get(companySourceId);
    const found = resolvedCompanyId ? applicationByKey.get(`${normalizeName(role)}::${resolvedCompanyId}`) : undefined;
    if (found) {
      items.push({ kind: 'application', sourceId, existingId: found.id, data: draft });
      bump('applications', 'reuse');
    } else {
      items.push({ kind: 'application', sourceId, data: draft });
      bump('applications', 'create');
    }
  }

  // --- Contacts ---
  for (const [i, row] of dataRows(book, SHEETS.contacts).entries()) {
    const sourceId = text(row[0]);
    const contactName = text(row[1]);
    const companyName = text(row[3]);
    if (!contactName) { issues.push({ sheet: 'contacts', row: i + 2, reason: 'Missing contact name' }); bump('contacts', 'skip'); continue; }
    const companySourceId = findCompanySourceId(book, companyName);
    if (!companySourceId) { issues.push({ sheet: 'contacts', row: i + 2, reason: `No company "${companyName}" in the workbook` }); bump('contacts', 'skip'); continue; }
    const email = text(row[6]);
    const draft: ContactDraft = {
      contactName,
      role: text(row[2]) || undefined,
      companySourceId,
      businessGroupName: text(row[4]) || undefined,
      relationshipKey: enumKey(row[5], NetworkingContactRelationshipKeyToLabel, 'New'),
      email: email || undefined,
      city: text(row[7]) || undefined,
      notes: text(row[9]) || undefined,
    };
    const resolvedCompanyId = companyIdBySource.get(companySourceId);
    // Email is the stronger signal and is company-independent; fall back to
    // name scoped to the company, since two people can share a name.
    const found = (email ? contactByEmail.get(normalizeName(email)) : undefined)
      ?? (resolvedCompanyId ? contactByKey.get(`${normalizeName(contactName)}::${resolvedCompanyId}`) : undefined);
    if (found) {
      items.push({ kind: 'contact', sourceId, existingId: found.id, data: draft });
      bump('contacts', 'reuse');
    } else {
      items.push({ kind: 'contact', sourceId, data: draft });
      bump('contacts', 'create');
    }
  }

  // --- Interactions: deduped on name + date ---
  for (const [i, row] of dataRows(book, SHEETS.interactions).entries()) {
    const sourceId = text(row[0]);
    const interactionName = text(row[1]);
    const contactSourceId = text(row[4]);
    if (!interactionName) { issues.push({ sheet: 'interactions', row: i + 2, reason: 'Missing interaction name' }); bump('interactions', 'skip'); continue; }
    if (!contactSourceId) { issues.push({ sheet: 'interactions', row: i + 2, reason: 'Missing contact reference' }); bump('interactions', 'skip'); continue; }
    const interactionDate = dateText(row[2]);
    const draft: InteractionDraft = {
      interactionName,
      interactionDate,
      interactionTypeKey: enumKey(row[3], InteractionInteractionTypeKeyToLabel, 'Other'),
      contactSourceId,
      applicationSourceId: text(row[6]) || undefined,
      notes: text(row[8]) || undefined,
    };
    const found = interactionByKey.get(`${normalizeName(interactionName)}::${interactionDate}`);
    if (found) {
      items.push({ kind: 'interaction', sourceId, existingId: found.id, data: draft });
      bump('interactions', 'reuse');
    } else {
      items.push({ kind: 'interaction', sourceId, data: draft });
      bump('interactions', 'create');
    }
  }

  // --- Follow-ups: deduped on title + due date ---
  //
  // Note the columns. The Interactions sheet exports Contact ID / Application ID,
  // but the Follow-ups sheet exports the contact NAME and the application ROLE.
  // Reading those as source ids silently orphaned every restored follow-up, so they
  // are resolved through the name lookups built from the other sheets.
  for (const [i, row] of dataRows(book, SHEETS.followUps).entries()) {
    const sourceId = text(row[0]);
    const title = text(row[1]);
    if (!title) { issues.push({ sheet: 'followUps', row: i + 2, reason: 'Missing title' }); bump('followUps', 'skip'); continue; }
    const dueDate = dateText(row[3]);
    if (!dueDate) { issues.push({ sheet: 'followUps', row: i + 2, reason: 'Missing due date' }); bump('followUps', 'skip'); continue; }
    const draft: FollowUpDraft = {
      title,
      statusKey: enumKey(row[2], FollowUpStatusKeyToLabel, 'Open'),
      dueDate,
      completedDate: dateText(row[4]) || undefined,
      relatedTypeKey: enumKey(row[5], FollowUpRelatedTypeKeyToLabel, 'NoneStandalone'),
      contactSourceId: contactSourceIdByName.get(normalizeName(text(row[6]))),
      applicationSourceId: applicationSourceIdByRole.get(normalizeName(text(row[7]))),
    };
    const found = followUpByKey.get(`${normalizeName(title)}::${dueDate}`);
    if (found) {
      items.push({ kind: 'followUp', sourceId, existingId: found.id, data: draft });
      bump('followUps', 'reuse');
    } else {
      items.push({ kind: 'followUp', sourceId, data: draft });
      bump('followUps', 'create');
    }
  }

  // --- Associations (contact <-> application; a true composite key, so dedup is exact) ---
  for (const [i, row] of dataRows(book, SHEETS.associations).entries()) {
    const sourceId = text(row[0]);
    const contactSourceId = text(row[2]);
    const applicationSourceId = text(row[4]);
    if (!contactSourceId || !applicationSourceId) { issues.push({ sheet: 'associations', row: i + 2, reason: 'Missing contact or application reference' }); bump('associations', 'skip'); continue; }
    items.push({ kind: 'association', sourceId, data: { contactSourceId, applicationSourceId } });
    bump('associations', 'create');
  }
  // Whether an association already exists can only be judged once ids resolve, so
  // the executor re-checks against this set at write time.
  void associationByKey;

  const totalCreate = IMPORT_ORDER.reduce((sum, k) => sum + counts[k].create, 0);
  const totalReuse = IMPORT_ORDER.reduce((sum, k) => sum + counts[k].reuse, 0);
  return { counts, issues, items, totalCreate, totalReuse };
}

// Children reference their parent by NAME in the export, not by id, so map the
// name back to the company row's source id.
function findCompanySourceId(book: Workbook, companyName: string): string | undefined {
  if (!companyName) return undefined;
  const target = normalizeName(companyName);
  for (const row of dataRows(book, SHEETS.companies)) {
    if (normalizeName(text(row[1])) === target) return text(row[0]);
  }
  return undefined;
}

export function planSummary(plan: ImportPlan): Array<{ sheet: string; create: number; reuse: number; skip: number }> {
  return IMPORT_ORDER.map((k) => ({ sheet: SHEET_LABEL[k], ...plan.counts[k] }));
}

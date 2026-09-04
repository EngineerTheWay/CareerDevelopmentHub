// Executes an ImportPlan against the data layer.
//
// Kept separate from planning, and taking its create functions as arguments, so
// the ordering logic can be exercised without React or a live Dataverse.
//
// The whole job here is translating SOURCE ids (from the file) into the NEW ids
// Dataverse hands back, because the code-app SDK cannot preserve a GUID on create.
// Every child looks its parent up through these maps.

import type { Company } from '@/generated/models/company-model';
import type { BusinessGroup } from '@/generated/models/business-group-model';
import type { NetworkingContact } from '@/generated/models/networking-contact-model';
import type { JobApplication } from '@/generated/models/job-application-model';
import type { Interaction } from '@/generated/models/interaction-model';
import type { FollowUp } from '@/generated/models/follow-up-model';
import type { ContactApplication } from '@/generated/models/contact-application-model';
import type { ImportPlan, PlanItem } from './restore-import';
import { normalizeName } from './restore-import';

export type Creators = {
  company: (data: Omit<Company, 'id'>) => Promise<Company>;
  businessGroup: (data: Omit<BusinessGroup, 'id'>) => Promise<BusinessGroup>;
  application: (data: Omit<JobApplication, 'id'>) => Promise<JobApplication>;
  contact: (data: Omit<NetworkingContact, 'id'>) => Promise<NetworkingContact>;
  interaction: (data: Omit<Interaction, 'id'>) => Promise<Interaction>;
  followUp: (data: Omit<FollowUp, 'id'>) => Promise<FollowUp>;
  association: (data: Omit<ContactApplication, 'id'>) => Promise<ContactApplication>;
};

export type ExecuteOptions = {
  // Existing contactId::applicationId pairs, so a re-run does not double-link.
  existingAssociations: Set<string>;
  onProgress?: (done: number, total: number, label: string) => void;
};

export type ExecuteResult = {
  created: number;
  reused: number;
  skipped: number;
  failures: Array<{ item: string; reason: string }>;
};

type Ref<T> = { id: string } & T;

export async function executePlan(plan: ImportPlan, creators: Creators, options: ExecuteOptions): Promise<ExecuteResult> {
  const companies = new Map<string, Ref<{ companyName: string }>>();
  const groupsBySource = new Map<string, Ref<{ businessGroupName: string }>>();
  // Business groups are referenced by NAME on contacts and applications, not by id,
  // so they also need a name+company lookup.
  const groupsByNameCompany = new Map<string, Ref<{ businessGroupName: string }>>();
  const applications = new Map<string, Ref<{ role: string }>>();
  const contacts = new Map<string, Ref<{ contactName: string }>>();

  const result: ExecuteResult = { created: 0, reused: 0, skipped: 0, failures: [] };
  const total = plan.items.length;
  let done = 0;

  const advance = (label: string) => {
    done += 1;
    options.onProgress?.(done, total, label);
  };

  for (const item of plan.items) {
    try {
      await applyItem(item);
    } catch (error) {
      result.failures.push({ item: describe(item), reason: error instanceof Error ? error.message : String(error) });
    }
    advance(describe(item));
  }

  return result;

  async function applyItem(item: PlanItem): Promise<void> {
    switch (item.kind) {
      case 'company': {
        if (item.existingId) {
          companies.set(item.sourceId, { id: item.existingId, companyName: item.data.companyName });
          result.reused += 1;
          return;
        }
        const created = await creators.company({ companyName: item.data.companyName });
        companies.set(item.sourceId, { id: created.id, companyName: created.companyName });
        result.created += 1;
        return;
      }
      case 'businessGroup': {
        const company = companies.get(item.data.companySourceId);
        if (!company) { result.skipped += 1; return; }
        const key = `${normalizeName(item.data.businessGroupName)}::${company.id}`;
        if (item.existingId) {
          const ref = { id: item.existingId, businessGroupName: item.data.businessGroupName };
          groupsBySource.set(item.sourceId, ref);
          groupsByNameCompany.set(key, ref);
          result.reused += 1;
          return;
        }
        const created = await creators.businessGroup({
          businessGroupName: item.data.businessGroupName,
          company: { id: company.id, companyName: company.companyName },
        });
        const ref = { id: created.id, businessGroupName: created.businessGroupName };
        groupsBySource.set(item.sourceId, ref);
        groupsByNameCompany.set(key, ref);
        result.created += 1;
        return;
      }
      case 'application': {
        const company = companies.get(item.data.companySourceId);
        if (!company) { result.skipped += 1; return; }
        if (item.existingId) {
          applications.set(item.sourceId, { id: item.existingId, role: item.data.role });
          result.reused += 1;
          return;
        }
        const group = lookupGroup(item.data.businessGroupName, company.id);
        const created = await creators.application({
          role: item.data.role,
          company: { id: company.id, companyName: company.companyName },
          businessGroup: group ? { id: group.id, businessGroupName: group.businessGroupName } : undefined,
          stageKey: item.data.stageKey,
          arrangementKey: item.data.arrangementKey,
          city: item.data.city,
          dateApplied: item.data.dateApplied,
          jobID: item.data.jobID,
          jobLink: item.data.jobLink,
          notes: item.data.notes,
        });
        applications.set(item.sourceId, { id: created.id, role: created.role });
        result.created += 1;
        return;
      }
      case 'contact': {
        const company = companies.get(item.data.companySourceId);
        if (!company) { result.skipped += 1; return; }
        if (item.existingId) {
          contacts.set(item.sourceId, { id: item.existingId, contactName: item.data.contactName });
          result.reused += 1;
          return;
        }
        const group = lookupGroup(item.data.businessGroupName, company.id);
        const created = await creators.contact({
          contactName: item.data.contactName,
          role: item.data.role,
          company: { id: company.id, companyName: company.companyName },
          businessGroup: group ? { id: group.id, businessGroupName: group.businessGroupName } : undefined,
          relationshipKey: item.data.relationshipKey,
          email: item.data.email,
          city: item.data.city,
          notes: item.data.notes,
        });
        contacts.set(item.sourceId, { id: created.id, contactName: created.contactName });
        result.created += 1;
        return;
      }
      case 'interaction': {
        if (item.existingId) { result.reused += 1; return; }
        const contact = contacts.get(item.data.contactSourceId);
        if (!contact) { result.skipped += 1; return; }
        const application = item.data.applicationSourceId ? applications.get(item.data.applicationSourceId) : undefined;
        await creators.interaction({
          interactionName: item.data.interactionName,
          interactionDate: item.data.interactionDate,
          interactionTypeKey: item.data.interactionTypeKey,
          contact: { id: contact.id, contactName: contact.contactName },
          relatedApplication: application ? { id: application.id, role: application.role } : undefined,
          notes: item.data.notes,
        });
        result.created += 1;
        return;
      }
      case 'followUp': {
        if (item.existingId) { result.reused += 1; return; }
        const contact = item.data.contactSourceId ? contacts.get(item.data.contactSourceId) : undefined;
        const application = item.data.applicationSourceId ? applications.get(item.data.applicationSourceId) : undefined;
        await creators.followUp({
          title: item.data.title,
          statusKey: item.data.statusKey,
          dueDate: item.data.dueDate,
          completedDate: item.data.completedDate,
          relatedTypeKey: item.data.relatedTypeKey,
          relatedContact: contact ? { id: contact.id, contactName: contact.contactName } : undefined,
          relatedApplication: application ? { id: application.id, role: application.role } : undefined,
        });
        result.created += 1;
        return;
      }
      case 'association': {
        const contact = contacts.get(item.data.contactSourceId);
        const application = applications.get(item.data.applicationSourceId);
        if (!contact || !application) { result.skipped += 1; return; }
        const key = `${contact.id}::${application.id}`;
        if (options.existingAssociations.has(key)) { result.reused += 1; return; }
        await creators.association({
          contactApplicationName: `${contact.contactName} - ${application.role}`.slice(0, 100),
          networkingContact: { id: contact.id, contactName: contact.contactName },
          jobApplication: { id: application.id, role: application.role },
        });
        options.existingAssociations.add(key);
        result.created += 1;
        return;
      }
    }
  }

  function lookupGroup(name: string | undefined, companyId: string) {
    if (!name) return undefined;
    return groupsByNameCompany.get(`${normalizeName(name)}::${companyId}`);
  }
}

function describe(item: PlanItem): string {
  switch (item.kind) {
    case 'company': return `Company: ${item.data.companyName}`;
    case 'businessGroup': return `Business group: ${item.data.businessGroupName}`;
    case 'application': return `Application: ${item.data.role}`;
    case 'contact': return `Contact: ${item.data.contactName}`;
    case 'interaction': return `Interaction: ${item.data.interactionName}`;
    case 'followUp': return `Follow-up: ${item.data.title}`;
    case 'association': return 'Association';
  }
}

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, CalendarIcon, Check, ChevronsUpDown, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createCompanyOrAdopt, createBusinessGroupOrAdopt } from '@/lib/unique-records';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { FollowUpCell } from '@/components/follow-up-cell';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelectFilter, type FilterTypeOption, type MultiSelectOption } from '@/components/multi-select-filter';
import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import { InMemoryDataBanner } from '@/generated/components/in-memory-data-banner';
import { HAS_IN_MEMORY_TABLES } from '@/generated/hooks';
import { useBusinessGroupList, useCreateBusinessGroup } from '@/generated/hooks/use-business-group';
import { useContactApplicationList, useCreateContactApplication, useDeleteContactApplication } from '@/generated/hooks/use-contact-application';
import { useCompanyList, useCreateCompany } from '@/generated/hooks/use-company';
import { useFollowUpList } from '@/generated/hooks/use-follow-up';
import { useCreateInteraction, useDeleteInteraction, useInteractionList, useUpdateInteraction } from '@/generated/hooks/use-interaction';
import type { FollowUp } from '@/generated/models/follow-up-model';
import { InteractionInteractionTypeKeyToLabel, type Interaction } from '@/generated/models/interaction-model';
import type { ContactApplication } from '@/generated/models/contact-application-model';
import type { JobApplication } from '@/generated/models/job-application-model';
import { NetworkingContactRelationshipKeyToLabel, type NetworkingContact, type NetworkingContactRelationshipKey } from '@/generated/models/networking-contact-model';
import type { BusinessGroup } from '@/generated/models/business-group-model';
import type { Company } from '@/generated/models/company-model';
import { useApplications, useContacts, useCreateContact, useDeleteContact, useUpdateContact } from '@/hooks/use-career-data';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSessionState } from '@/hooks/use-session-state';
import { formatDisplayDate } from '@/lib/display-date';
import { dateKeyToLocalDate, toDateKey } from '@/lib/follow-up-utils';

export type ContactFormState = {
  contactName: string;
  role: string;
  companyName: string;
  companyId?: string;
  businessGroupName: string;
  applicationIds: string[];
  businessGroupId?: string;
  city: string;
  email: string;
  relationshipKey: NetworkingContactRelationshipKey;
  notes: string;
};

export const initialContactForm: ContactFormState = {
  contactName: '',
  role: '',
  applicationIds: [],
  companyName: '',
  businessGroupName: '',
  city: '',
  email: '',
  relationshipKey: 'New',
  notes: '',
};
const pageSizeOptions = [5, 10, 20, 50] as const;
type PageSize = typeof pageSizeOptions[number];
type ContactFilterKey = 'company' | 'businessGroup' | 'role' | 'relationship';
type ContactSortKey = 'contactName' | ContactFilterKey;
type SortDirection = 'asc' | 'desc';
type ContactColumnFilter = { key: ContactFilterKey; values: string[] };
const contactFilterLabels: Record<ContactFilterKey, string> = { company: 'Company', businessGroup: 'Business group', role: 'Role', relationship: 'Relationship' };
const contactSortLabels: Record<ContactSortKey, string> = { contactName: 'Contact name', ...contactFilterLabels };
const getContactFieldValue = (contact: NetworkingContact, key: ContactFilterKey): string => { if (key === 'company') return contact.company?.companyName ?? ''; if (key === 'businessGroup') return contact.businessGroup?.businessGroupName ?? ''; if (key === 'role') return contact.role ?? ''; return contact.relationshipKey ? NetworkingContactRelationshipKeyToLabel[contact.relationshipKey] ?? '' : ''; };
const isValidContact = (contact: NetworkingContact | undefined | null): contact is NetworkingContact => Boolean(contact?.id && contact.contactName);
const formatTableDate = (dateValue: string | undefined): string => formatDisplayDate(dateValue);
const initialContactFilters: [ContactColumnFilter, ContactColumnFilter] = [{ key: 'company', values: [] }, { key: 'businessGroup', values: [] }];
const customContactFilterTypes: Array<FilterTypeOption<ContactFilterKey>> = [{ value: 'businessGroup', label: 'Business group' }, { value: 'role', label: 'Role' }, { value: 'relationship', label: 'Relationship' }];
const emptyField = '—';
type InteractionTimelineFilter = '30' | '365' | 'all';
const interactionTimelineFilterLabels: Record<InteractionTimelineFilter, string> = { '30': '30 days', '365': '1 year', all: 'All' };
const getInteractionTitle = (contactName: string, typeKey: Interaction['interactionTypeKey'], dateValue: string | Date) => `${InteractionInteractionTypeKeyToLabel[typeKey]} with ${contactName} on ${formatDisplayDate(dateValue)}`;

type ContactInteractionHistoryItem = {
  id: string;
  date: string;
  type: string;
  notes?: string;
  applicationRole?: string;
  applicationCompany?: string;
};

export type ContactFormProps = {
  applications: JobApplication[];
  value: ContactFormState;
  onChange: (field: keyof ContactFormState, value: string | string[]) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  submitLabel: string;
  companies: Company[];
  businessGroups: BusinessGroup[];
  deleteAction?: React.ReactNode;

  onCreateCompany?: (name: string) => void;
  onCreateBusinessGroup?: (name: string) => void;
};

function ContactInteractionHistory({ items, onAddInteraction, onEditInteraction, addingInteraction = false }: { items: ContactInteractionHistoryItem[]; onAddInteraction?: () => void; onEditInteraction?: (interactionId: string) => void; addingInteraction?: boolean }) {
  const [timelineFilter, setTimelineFilter] = useState<InteractionTimelineFilter>('all');
  const filteredItems = useMemo(() => {
    if (timelineFilter === 'all') return items;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(timelineFilter));
    return items.filter((item: ContactInteractionHistoryItem) => new Date(item.date).getTime() >= cutoff.getTime());
  }, [items, timelineFilter]);
  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div>
          <p className="text-sm font-medium">Interaction history</p>
          <p className="text-xs text-muted-foreground">All saved contact touchpoints</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timelineFilter} onValueChange={(value: string) => setTimelineFilter(value as InteractionTimelineFilter)}>
            <SelectTrigger size="sm" className="h-8 w-[104px] py-0"><SelectValue aria-label="Timeline filter" /></SelectTrigger>
            <SelectContent>
              {Object.entries(interactionTimelineFilterLabels).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-8" onClick={onAddInteraction} disabled={!onAddInteraction || addingInteraction}>
            <Plus className="h-3.5 w-3.5" /> Interaction
          </Button>
        </div>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto p-3">
        {filteredItems.length === 0 ? <div className="rounded-lg border border-dashed bg-muted p-3 text-sm text-muted-foreground">{items.length === 0 ? 'No interaction history yet.' : `No interactions in ${interactionTimelineFilterLabels[timelineFilter].toLowerCase()}.`}</div> : filteredItems.map((item: ContactInteractionHistoryItem) => (
          <button key={item.id} type="button" className="w-full rounded-lg border bg-white p-3 text-left text-foreground shadow-sm transition hover:border-primary dark:bg-card" onClick={() => onEditInteraction?.(item.id)}>
            <div className="text-sm font-medium">{formatTableDate(item.date)} • {item.type}</div>
            {item.applicationRole ? <div className="mt-1 truncate text-xs text-muted-foreground">{item.applicationRole}{item.applicationCompany ? ` - ${item.applicationCompany}` : ''}</div> : null}
            {item.notes?.trim() ? <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.notes}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContactForm({ value, onChange, onSubmit, pending, submitLabel, companies, businessGroups, applications, deleteAction, onCreateCompany, onCreateBusinessGroup }: ContactFormProps) {
  const companyOptions = companies
    .filter((company: Company) => Boolean(company.id && company.companyName?.trim()))
    .sort((first: Company, second: Company) => first.companyName.localeCompare(second.companyName));
  const selectedCompanyId = value.companyId || companyOptions.find((company: Company) => company.companyName.toLowerCase() === value.companyName.trim().toLowerCase())?.id;
  const [applicationSearch, setApplicationSearch] = useState('');
  const applicationOptions = applications
    .filter((application: JobApplication) => Boolean(application.id && application.role?.trim()))
    .filter((application: JobApplication) => Boolean(selectedCompanyId && application.company?.id === selectedCompanyId))
    .sort((first: JobApplication, second: JobApplication) => first.role.localeCompare(second.role));
  const filteredApplicationOptions = applicationOptions.filter((application: JobApplication) => {
    const normalizedSearch = applicationSearch.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return [application.role, application.jobID, application.city, application.businessGroup?.businessGroupName, application.stageKey].some((fieldValue: string | undefined) => fieldValue?.toLowerCase().includes(normalizedSearch));
  });
  const selectedApplications = applicationOptions.filter((application: JobApplication) => value.applicationIds.includes(application.id));
  const selectedApplicationLabel = selectedApplications.length === 0 ? 'Select applications' : selectedApplications.length === 1 ? selectedApplications[0].role : `${selectedApplications.length} applications selected`;
  const toggleApplication = (applicationId: string, checked: boolean) => {
    onChange('applicationIds', checked ? Array.from(new Set([...value.applicationIds, applicationId])) : value.applicationIds.filter((id: string) => id !== applicationId));
  };
  const businessGroupOptions = businessGroups
    .filter((group: BusinessGroup) => Boolean(group.id && group.businessGroupName?.trim()))
    .filter((group: BusinessGroup) => Boolean(selectedCompanyId && group.company?.id === selectedCompanyId))
    .sort((first: BusinessGroup, second: BusinessGroup) => first.businessGroupName.localeCompare(second.businessGroupName));
  const companySearchOptions: RefinedSearchOption[] = companyOptions.map((company: Company) => ({ id: company.id, label: company.companyName }));
  const businessGroupSearchOptions: RefinedSearchOption[] = businessGroupOptions.map((group: BusinessGroup) => ({ id: group.id, label: group.businessGroupName, description: value.companyName }));
  const handleCompanyChange = (nextName: string, selectedId?: string) => {
    const matchedCompany = selectedId ? companyOptions.find((company: Company) => company.id === selectedId) : companyOptions.find((company: Company) => company.companyName.toLowerCase() === nextName.trim().toLowerCase());
    onChange('applicationIds', []);
    onChange('companyName', nextName);
    onChange('companyId', matchedCompany?.id ?? '');
    onChange('businessGroupName', '');
    onChange('businessGroupId', '');
  };
  const handleBusinessGroupChange = (nextName: string, selectedId?: string) => {
    const matchedGroup = selectedId ? businessGroupOptions.find((group: BusinessGroup) => group.id === selectedId) : businessGroupOptions.find((group: BusinessGroup) => group.businessGroupName.toLowerCase() === nextName.trim().toLowerCase());
    onChange('businessGroupName', nextName);
    onChange('businessGroupId', matchedGroup?.id ?? '');
  };
  return (
    <form className="grid gap-x-5 gap-y-5 md:grid-cols-2" onSubmit={onSubmit}>
      <div className="space-y-2.5">
        <Label htmlFor="contact-name">Contact name <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input id="contact-name" className="h-11" value={value.contactName} required onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('contactName', event.target.value)} />
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-role">Role</Label>
        <Input id="contact-role" className="h-11" value={value.role} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('role', event.target.value)} />
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-company">Company <span className="text-destructive" aria-hidden="true">*</span></Label>
        <RefinedSearchBox id="contact-company" value={value.companyName} options={companySearchOptions} placeholder="Search or type a new company" emptyLabel="No matching companies" createLabel="Create company" onChange={handleCompanyChange} onCreate={onCreateCompany} onClear={() => { onChange('companyName', ''); onChange('companyId', ''); onChange('businessGroupName', ''); onChange('businessGroupId', ''); onChange('applicationIds', []); }} />
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-group">Business group</Label>
        <RefinedSearchBox id="contact-group" value={value.businessGroupName} options={businessGroupSearchOptions} placeholder={selectedCompanyId ? 'Search or type a new group' : 'Select a company first'} emptyLabel={selectedCompanyId ? 'No groups for this company' : 'Select a company first'} createLabel="Create business group" disabled={!selectedCompanyId} onChange={handleBusinessGroupChange} onCreate={onCreateBusinessGroup} onClear={() => { onChange('businessGroupName', ''); onChange('businessGroupId', ''); }} />
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-city">City</Label>
        <Input id="contact-city" className="h-11" value={value.city} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('city', event.target.value)} />
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" className="h-11" type="email" value={value.email} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('email', event.target.value)} />
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-relationship">Relationship <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Select value={value.relationshipKey} onValueChange={(nextValue: string) => onChange('relationshipKey', nextValue)}>
          <SelectTrigger id="contact-relationship" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(NetworkingContactRelationshipKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="contact-applications">Associated Applications</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="contact-applications" type="button" variant="outline" className="h-11 w-full justify-between bg-white font-normal text-foreground dark:bg-card dark:text-card-foreground" disabled={!selectedCompanyId}>
              <span className="truncate">{selectedCompanyId ? selectedApplicationLabel : 'Select a company first'}</span>
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
            <Input value={applicationSearch} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setApplicationSearch(event.target.value)} placeholder="Search applications" className="mb-2 h-9" />
            <div className="max-h-64 overscroll-contain space-y-1 overflow-y-auto pr-1" onWheel={(event: React.WheelEvent<HTMLDivElement>) => event.stopPropagation()}>
              {applicationOptions.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">{selectedCompanyId ? 'No applications for this company.' : 'Select a company first.'}</p> : filteredApplicationOptions.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No applications match your search.</p> : filteredApplicationOptions.map((application: JobApplication) => {
                const checked = value.applicationIds.includes(application.id);
                return <button key={application.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-popover-foreground hover:bg-muted" onClick={() => toggleApplication(application.id, !checked)}><span className="flex h-4 w-4 items-center justify-center rounded-sm border border-input bg-background text-foreground">{checked ? <Check className="h-3 w-3" /> : null}</span><span className="min-w-0 flex-1"><span className="block truncate">{application.role}</span>{application.jobID?.trim() ? <span className="block truncate text-xs text-muted-foreground">{application.jobID}</span> : null}</span></button>;
              })}
            </div>
            {selectedApplications.length > 0 ? <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange('applicationIds', [])}>Clear selected</Button> : null}
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2.5 md:col-span-2">
        <Label htmlFor="contact-notes">Notes</Label>
        <Textarea id="contact-notes" className="min-h-28" value={value.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange('notes', event.target.value)} placeholder="Context, warm intros, recent conversations, next steps" />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 md:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>{deleteAction}</div>
    </form>
  );

}

export const findByName = <T extends { id: string }>(items: T[], getName: (item: T) => string, name: string): T | undefined => items.find((item: T) => getName(item).trim().toLowerCase() === name.trim().toLowerCase());
const contactToForm = (contact: NetworkingContact, associations: ContactApplication[] = []): ContactFormState => ({ contactName: contact.contactName, role: contact.role ?? '', companyName: contact.company?.companyName ?? '', companyId: contact.company?.id, businessGroupName: contact.businessGroup?.businessGroupName ?? '', businessGroupId: contact.businessGroup?.id, city: contact.city ?? '', email: contact.email ?? '', relationshipKey: contact.relationshipKey, notes: contact.notes ?? '', applicationIds: associations.filter((association: ContactApplication) => association.networkingContact?.id === contact.id).map((association: ContactApplication) => association.jobApplication?.id) });


function ContactDetailView({ contact, associations, interactionHistory, onEdit, onAddInteraction, onEditInteraction, addingInteraction = false }: { contact: NetworkingContact; associations: ContactApplication[]; interactionHistory: ContactInteractionHistoryItem[]; onEdit: () => void; onAddInteraction: () => void; onEditInteraction: (interactionId: string) => void; addingInteraction?: boolean }) {
  const relatedApplications = associations.filter((association: ContactApplication) => association.networkingContact?.id === contact.id);
  const relationshipLabel = contact.relationshipKey ? NetworkingContactRelationshipKeyToLabel[contact.relationshipKey] ?? emptyField : emptyField;
  const applicationSummary = relatedApplications.length > 0 ? relatedApplications.map((association: ContactApplication) => association.jobApplication?.role).join(', ') : emptyField;
  const compactRows = [
    { label: 'Role', value: contact.role?.trim() || emptyField },
    { label: 'Company', value: contact.company?.companyName?.trim() || emptyField },
    { label: 'Group', value: contact.businessGroup?.businessGroupName?.trim() || emptyField },
    { label: 'City', value: contact.city?.trim() || emptyField },
    { label: 'Email', value: contact.email?.trim() || emptyField, href: contact.email?.trim() ? `mailto:${contact.email.trim()}` : undefined },
    { label: 'Relationship', value: relationshipLabel },
    { label: 'Applications', value: applicationSummary, wide: true },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{contact.contactName}</h3>
            <p className="truncate text-sm text-muted-foreground">{contact.role?.trim() || 'Contact'} at {contact.company?.companyName?.trim() || 'Unknown company'}</p>
          </div>
          <Button type="button" size="sm" onClick={onEdit}>Edit</Button>
        </div>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {compactRows.map((row: { label: string; value: string; href?: string; wide?: boolean }) => (
            <div key={row.label} className={cn('min-w-0', row.wide ? 'sm:col-span-2' : '')}>
              <div className="text-[11px] font-medium text-muted-foreground">{row.label}</div>
              {row.href ? <a href={row.href} className="truncate text-sm font-medium underline">{row.value}</a> : <div className="truncate text-sm font-medium">{row.value}</div>}
            </div>
          ))}
          <div className="min-w-0 sm:col-span-2">
            <div className="text-[11px] font-medium text-muted-foreground">Notes</div>
            <p className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap text-sm">{contact.notes?.trim() || emptyField}</p>
          </div>
        </div>
      </div>
      <ContactInteractionHistory items={interactionHistory} onAddInteraction={onAddInteraction} onEditInteraction={onEditInteraction} addingInteraction={addingInteraction} />
    </div>
  );
}

export default function ContactsPage() {
  const { data, error, isLoading } = useContacts();

  const { data: followUpData } = useFollowUpList();
  const { data: companyData } = useCompanyList();
  const { data: businessGroupData } = useBusinessGroupList();
  const createContact = useCreateContact();
  const { data: interactionData } = useInteractionList();
  const updateInteraction = useUpdateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const createInteraction = useCreateInteraction();
  const interactions = interactionData ?? [];
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const queryClient = useQueryClient();
  const createCompany = useCreateCompany();
  const createBusinessGroup = useCreateBusinessGroup();
  const isMobile = useIsMobile();
  const { data: applicationData } = useApplications();
  const { data: contactApplicationData } = useContactApplicationList();

  const contacts = (data ?? []).filter(isValidContact);
  const followUps = followUpData ?? [];
  const createContactApplication = useCreateContactApplication();
  const deleteContactApplication = useDeleteContactApplication();
  const companies = (companyData ?? []).filter((company: Company) => Boolean(company?.id && company.companyName));
  const businessGroups = (businessGroupData ?? []).filter((group: BusinessGroup) => Boolean(group?.id && group.businessGroupName));
  const [contactToDelete, setContactToDelete] = useState<NetworkingContact | null>(null);
  const [search, setSearch] = useSessionState('career-hub.contacts.search', '');
  const applications = (applicationData ?? []).filter((application: JobApplication) => Boolean(application?.id && application.role));
  const contactApplications = (contactApplicationData ?? []).filter((association: ContactApplication) => Boolean(association?.id && association.networkingContact?.id && association.jobApplication?.id));
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [sortKey, setSortKey] = useSessionState<ContactSortKey>('career-hub.contacts.sort-key', 'contactName');
  const [sortDirection, setSortDirection] = useSessionState<SortDirection>('career-hub.contacts.sort-direction', 'asc');
  const [viewingId, setViewingId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [pageSize, setPageSize] = useSessionState<PageSize>('career-hub.contacts.page-size', 10);
  const [columnFilters, setColumnFilters] = useSessionState<[ContactColumnFilter, ContactColumnFilter]>('career-hub.contacts.column-filters', initialContactFilters);
  const [page, setPage] = useSessionState('career-hub.contacts.page', 1);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionApplicationSearch, setInteractionApplicationSearch] = useState('');
  const [editingInteractionId, setEditingInteractionId] = useState<string | undefined>();
  const [interactionToDelete, setInteractionToDelete] = useState<Interaction | null>(null);
  const [interactionForm, setInteractionForm] = useState<{ interactionDate: string; interactionTypeKey: Interaction['interactionTypeKey']; notes: string; relatedApplicationId: string }>({ interactionDate: toDateKey(new Date()), interactionTypeKey: 'Other', notes: '', relatedApplicationId: 'none' });

  const [form, setForm] = useState<ContactFormState>(initialContactForm);
  const [pendingCreateRecord, setPendingCreateRecord] = useState<{ type: 'company' | 'businessGroup'; name: string } | null>(null);
  const viewingContact = viewingId ? contacts.find((contact: NetworkingContact) => contact.id === viewingId) : undefined;
  const contactTimelineDates = useMemo(() => {
    const lastInteractionByContact = new Map<string, string>();
    interactions.forEach((interaction: Interaction) => {
      const contactId = interaction.contact?.id;
      if (!contactId) return;
      const currentValue = lastInteractionByContact.get(contactId);
      if (!currentValue || new Date(interaction.interactionDate).getTime() > new Date(currentValue).getTime()) {
        lastInteractionByContact.set(contactId, interaction.interactionDate);
      }
    });


    const nextFollowUpByContact = new Map<string, string>();
    followUps
      .filter((followUp: FollowUp) => followUp.relatedTypeKey === 'Contact' && followUp.statusKey === 'Open' && Boolean(followUp.relatedContact?.id))
      .forEach((followUp: FollowUp) => {
        const contactId = followUp.relatedContact?.id;
        if (!contactId) return;
        const currentValue = nextFollowUpByContact.get(contactId);
        if (!currentValue || new Date(followUp.dueDate).getTime() < new Date(currentValue).getTime()) {
          nextFollowUpByContact.set(contactId, followUp.dueDate);
        }
      });

    return { lastInteractionByContact, nextFollowUpByContact };
  }, [followUps, interactions]);

  useEffect(() => { if (isMobile && pageSize !== 5) { setPageSize(5); setPage(1); } }, [isMobile, pageSize, setPage, setPageSize]);

  const companyFilteredContacts = useMemo(() => {
    const selectedCompanies = columnFilters[0].values;
    if (selectedCompanies.length === 0) return contacts;
    return contacts.filter((contact: NetworkingContact) => selectedCompanies.includes(getContactFieldValue(contact, 'company').trim()));
  }, [columnFilters, contacts]);
  const contactFilterOptions = useMemo(() => columnFilters.map((filter: ContactColumnFilter, index: number) => { const sourceContacts = index === 1 && filter.key === 'businessGroup' ? companyFilteredContacts : contacts; const uniqueValues = Array.from(new Set(sourceContacts.map((contact: NetworkingContact) => getContactFieldValue(contact, filter.key).trim()).filter((value: string) => Boolean(value)))); return uniqueValues.sort((first: string, second: string) => first.localeCompare(second, undefined, { sensitivity: 'base' })).map((value: string): MultiSelectOption => ({ value, label: value })); }), [columnFilters, companyFilteredContacts, contacts]);
  const filteredContacts = useMemo(() => contacts.filter((contact: NetworkingContact) => { const normalizedSearch = search.trim().toLowerCase(); const matchesSearch = [contact.contactName, contact.company?.companyName, contact.businessGroup?.businessGroupName, contact.role, contact.email, contact.notes].some((value: string | undefined) => value?.toLowerCase().includes(normalizedSearch)); const matchesColumnFilters = columnFilters.every((filter: ContactColumnFilter) => filter.values.length === 0 || filter.values.includes(getContactFieldValue(contact, filter.key).trim())); return matchesSearch && matchesColumnFilters; }), [columnFilters, contacts, search]);
  const sortedContacts = useMemo(() => [...filteredContacts].sort((first: NetworkingContact, second: NetworkingContact) => { const firstValue = sortKey === 'contactName' ? first.contactName : getContactFieldValue(first, sortKey); const secondValue = sortKey === 'contactName' ? second.contactName : getContactFieldValue(second, sortKey); const result = firstValue.localeCompare(secondValue, undefined, { numeric: true, sensitivity: 'base' }); return sortDirection === 'asc' ? result : -result; }), [filteredContacts, sortDirection, sortKey]);
  const totalPages = Math.max(1, Math.ceil(sortedContacts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedContacts = sortedContacts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const editingContact = editingId ? contacts.find((contact: NetworkingContact) => contact.id === editingId) : undefined;
  const isSaving = createContact.isPending || updateContact.isPending || createCompany.isPending || createBusinessGroup.isPending || createContactApplication.isPending || deleteContactApplication.isPending || createInteraction.isPending || updateInteraction.isPending || deleteInteraction.isPending;
  const isContactFormDirty = (baseline: ContactFormState) => JSON.stringify(form) !== JSON.stringify(baseline);
  const createFormDirty = createOpen && isContactFormDirty(initialContactForm);
  const editFormDirty = editOpen && editingContact ? isContactFormDirty(contactToForm(editingContact, contactApplications)) : false;
  const hasUnsavedChanges = createFormDirty || editFormDirty;
  const activeInteractionContact = editingContact ?? viewingContact;
  const activeInteractionContactCompanyId = activeInteractionContact?.company?.id;
  const interactionApplicationChoices = applications.filter((application: JobApplication) => Boolean(application.id && application.role && activeInteractionContactCompanyId && application.company?.id === activeInteractionContactCompanyId));
  const selectedInteractionApplication = interactionForm.relatedApplicationId === 'none' ? undefined : applications.find((application: JobApplication) => application.id === interactionForm.relatedApplicationId);
  const interactionApplicationSearchValue = selectedInteractionApplication ? selectedInteractionApplication.role : interactionApplicationSearch;
  const interactionApplicationOptions: RefinedSearchOption[] = interactionApplicationChoices
  .map((application: JobApplication) => ({ id: application.id, label: application.role, description: `${application.company?.companyName ?? emptyField} - ${application.jobID?.trim() || emptyField}` }));

  const interactionHistoryByContact = useMemo(() => {
    const applicationById = new Map(applications.map((application: JobApplication) => [application.id, application]));
    const historyByContact = new Map<string, ContactInteractionHistoryItem[]>();
    interactions.forEach((interaction: Interaction) => {
      const contactId = interaction.contact?.id;
      if (!contactId) return;
      const relatedApplication = interaction.relatedApplication?.id ? applicationById.get(interaction.relatedApplication?.id) : undefined;
      const currentItems = historyByContact.get(contactId) ?? [];
      currentItems.push({
        id: interaction.id,
        date: interaction.interactionDate,
        type: InteractionInteractionTypeKeyToLabel[interaction.interactionTypeKey] ?? interaction.interactionTypeKey,
        notes: interaction.notes,
        applicationRole: interaction.relatedApplication?.role ?? relatedApplication?.role,
        applicationCompany: relatedApplication?.company?.companyName,
      });
      historyByContact.set(contactId, currentItems);
    });
    historyByContact.forEach((items: ContactInteractionHistoryItem[]) => {
      items.sort((first: ContactInteractionHistoryItem, second: ContactInteractionHistoryItem) => new Date(second.date).getTime() - new Date(first.date).getTime());
    });
    return historyByContact;
  }, [applications, interactions]);
  const guardRegistration = useMemo(() => ({
    isDirty: hasUnsavedChanges,
    onDiscard: () => { setCreateOpen(false); setEditOpen(false); },
  }), [hasUnsavedChanges]);
  useUnsavedChangesGuard(guardRegistration);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const requestDiscard = (action: () => void) => setDiscardAction(() => action);
  const handleCreateOpenChange = (open: boolean) => { if (open) { setForm(initialContactForm); setCreateOpen(true); return; } if (!createFormDirty) { setCreateOpen(false); return; } requestDiscard(() => { setCreateOpen(false); setForm(initialContactForm); }); };
  const requestCreateCompany = (name: string) => setPendingCreateRecord({ type: 'company', name });
  const requestCreateBusinessGroup = (name: string) => setPendingCreateRecord({ type: 'businessGroup', name });
  const cancelPendingCreateRecord = () => {
    if (pendingCreateRecord?.type === 'company') { updateForm('companyName', ''); updateForm('companyId', ''); updateForm('businessGroupName', ''); updateForm('businessGroupId', ''); }
    if (pendingCreateRecord?.type === 'businessGroup') { updateForm('businessGroupName', ''); updateForm('businessGroupId', ''); }
    setPendingCreateRecord(null);
  };
  const confirmPendingCreateRecord = async () => {
    if (!pendingCreateRecord) return;
    try {
      if (pendingCreateRecord.type === 'company') {
        const companyName = pendingCreateRecord.name.trim();
        const existingCompany = companies.find((companyRecord: Company) => companyRecord.companyName.trim().toLowerCase() === companyName.toLowerCase());
        const companyRecord = existingCompany ?? (await createCompanyOrAdopt(() => createCompany.mutateAsync({ companyName }), companyName, queryClient)).record;
        updateForm('companyName', companyRecord.companyName);
        updateForm('companyId', companyRecord.id);
        updateForm('businessGroupName', '');
        updateForm('businessGroupId', '');
        toast.success(existingCompany ? 'Company selected' : 'Company created');
      } else {
        const businessGroupName = pendingCreateRecord.name.trim();
        const companyName = form.companyName.trim();
        const companyRecord = form.companyId ? companies.find((companyItem: Company) => companyItem.id === form.companyId) : companies.find((companyItem: Company) => companyItem.companyName.trim().toLowerCase() === companyName.toLowerCase());
        if (!companyRecord) { toast.error('Select or create a company first'); return; }
        const existingBusinessGroup = businessGroups.find((businessGroupRecord: BusinessGroup) => businessGroupRecord.businessGroupName.trim().toLowerCase() === businessGroupName.toLowerCase() && businessGroupRecord.company?.id === companyRecord.id);
        const businessGroupRecord = existingBusinessGroup ?? (await createBusinessGroupOrAdopt(() => createBusinessGroup.mutateAsync({ businessGroupName, company: { id: companyRecord.id, companyName: companyRecord.companyName } }), businessGroupName, companyRecord.id, queryClient)).record;
        updateForm('businessGroupName', businessGroupRecord.businessGroupName);
        updateForm('businessGroupId', businessGroupRecord.id);
        toast.success(existingBusinessGroup ? 'Business group selected' : 'Business group created');
      }

      setPendingCreateRecord(null);
    } catch (_error: unknown) {
      toast.error('Could not create record');
    }
  };
  const handleEditOpenChange = (open: boolean) => { if (open) { setEditOpen(true); return; } if (!editFormDirty) { setEditOpen(false); if (editingId) { setViewingId(editingId); setViewOpen(true); } return; } requestDiscard(() => { const contactId = editingId; setEditOpen(false); if (contactId) { setViewingId(contactId); setViewOpen(true); } setForm(initialContactForm); }); };

  const updateForm = (field: keyof ContactFormState, value: string | string[]) => setForm((current: ContactFormState) => ({ ...current, [field]: value }));
  const resolveCompany = async (): Promise<Company> => {
    const companyName = form.companyName.trim();
    const existingCompany = form.companyId ? companies.find((company: Company) => company.id === form.companyId) : findByName(companies, (company: Company) => company.companyName, companyName);
    return existingCompany ?? (await createCompanyOrAdopt(() => createCompany.mutateAsync({ companyName }), companyName, queryClient)).record;
  };
  const resolveBusinessGroup = async (company: Company): Promise<BusinessGroup | undefined> => {
    const businessGroupName = form.businessGroupName.trim();
    if (!businessGroupName) return undefined;
    const existingGroup = form.businessGroupId ? businessGroups.find((group: BusinessGroup) => group.id === form.businessGroupId && group.company?.id === company.id) : businessGroups.find((group: BusinessGroup) => group.businessGroupName.trim().toLowerCase() === businessGroupName.toLowerCase() && group.company?.id === company.id);
    return existingGroup ?? (await createBusinessGroupOrAdopt(() => createBusinessGroup.mutateAsync({ businessGroupName, company: { id: company.id, companyName: company.companyName } }), businessGroupName, company.id, queryClient)).record;
  };
  const buildContactPayload = async (): Promise<Omit<NetworkingContact, 'id'>> => {
    const company = await resolveCompany();
    const businessGroup = await resolveBusinessGroup(company);
    return {
      contactName: form.contactName.trim(),
      role: form.role.trim() || undefined,
      company: { id: company.id, companyName: company.companyName },
      businessGroup: businessGroup ? { id: businessGroup.id, businessGroupName: businessGroup.businessGroupName } : undefined,
      city: form.city.trim() || undefined,
      email: form.email.trim() || undefined,
      relationshipKey: form.relationshipKey,
      notes: form.notes.trim() || undefined,
    };
  };
  const validateForm = () => {
    if (!form.contactName.trim()) { toast.error('Contact name is required'); return false; }
    if (!form.companyName.trim()) { toast.error('Company is required'); return false; }
    return true;
  };
  const syncContactApplications = async (contact: NetworkingContact) => {
    const existingAssociations = contactApplications.filter((association: ContactApplication) => association.networkingContact?.id === contact.id);
    const selectedIds = new Set(form.applicationIds);
    const existingIds = new Set(existingAssociations.map((association: ContactApplication) => association.jobApplication?.id));
    const associationsToDelete = existingAssociations.filter((association: ContactApplication) => !selectedIds.has(association.jobApplication?.id));
    const applicationsToCreate = applications.filter((application: JobApplication) => selectedIds.has(application.id) && !existingIds.has(application.id));
    await Promise.all(associationsToDelete.map((association: ContactApplication) => deleteContactApplication.mutateAsync(association.id)));
    await Promise.all(applicationsToCreate.map((application: JobApplication) => createContactApplication.mutateAsync({ contactApplicationName: `${contact.contactName} - ${application.role}`, networkingContact: { id: contact.id, contactName: contact.contactName }, jobApplication: { id: application.id, role: application.role } })));
  };
  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    try {
      const payload = await buildContactPayload();
      const createdContact = await createContact.mutateAsync(payload);
      await syncContactApplications(createdContact);
      toast.success('Contact created');
      setForm(initialContactForm);
      setCreateOpen(false);
    } catch (_error: unknown) {
      toast.error('Could not create contact');
    }
  };
  const openInteractionForm = (interactionId?: string) => {
    const contactForInteraction = editingContact ?? viewingContact;
    if (!contactForInteraction) return;
    const interaction = interactionId ? interactions.find((item: Interaction) => item.id === interactionId) : undefined;
    setEditingInteractionId(interactionId);
    setInteractionForm({
      interactionDate: interaction?.interactionDate ? toDateKey(interaction.interactionDate) : toDateKey(new Date()),
      interactionTypeKey: interaction?.interactionTypeKey ?? 'Other',
      notes: interaction?.notes ?? '',
      relatedApplicationId: interaction?.relatedApplication?.id ?? 'none',
    });
    setInteractionApplicationSearch(interaction?.relatedApplication?.role ?? '');
    setInteractionDialogOpen(true);
  };
  const saveInteraction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const contactForInteraction = editingContact ?? viewingContact;
    if (!contactForInteraction) return;
    const relatedApplication = interactionForm.relatedApplicationId === 'none' ? undefined : applications.find((application: JobApplication) => application.id === interactionForm.relatedApplicationId);
    const payload: Omit<Interaction, 'id'> = {
      interactionName: getInteractionTitle(contactForInteraction.contactName, interactionForm.interactionTypeKey, interactionForm.interactionDate),
      contact: { id: contactForInteraction.id, contactName: contactForInteraction.contactName },
      interactionDate: toDateKey(interactionForm.interactionDate) || toDateKey(new Date()),
      interactionTypeKey: interactionForm.interactionTypeKey,
      notes: interactionForm.notes.trim() || undefined,
      relatedApplication: relatedApplication ? { id: relatedApplication.id, role: relatedApplication.role } : undefined,
    };
    try {
      if (editingInteractionId) {
        await updateInteraction.mutateAsync({ id: editingInteractionId, changedFields: payload });
        toast.success('Interaction updated');
      } else {
        await createInteraction.mutateAsync(payload);
        toast.success('Interaction created');
      }
      setInteractionDialogOpen(false);
      setEditingInteractionId(undefined);
    } catch (_error: unknown) {
      toast.error('Could not save interaction');
    }
  };
  const removeInteraction = async () => {
    if (!interactionToDelete) return;
    try {
      await deleteInteraction.mutateAsync(interactionToDelete.id);
      toast.success('Interaction deleted');
      setInteractionDialogOpen(false);
      setEditingInteractionId(undefined);
      setInteractionToDelete(null);
    } catch (_error: unknown) {
      toast.error('Could not delete interaction');
    }
  };
  const startView = (contact: NetworkingContact) => { setEditingId(undefined); setViewingId(contact.id); setViewOpen(true); };
  const startEdit = (contact: NetworkingContact) => { setViewOpen(false); setEditingId(contact.id); setViewingId(contact.id); setForm(contactToForm(contact, contactApplications)); setEditOpen(true); };
  const handleEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId || !validateForm()) return;
    try {
      const payload = await buildContactPayload();
      const updatedContact = await updateContact.mutateAsync({ id: editingId, changedFields: payload });
      await syncContactApplications(updatedContact);
      toast.success('Contact updated');
      setEditOpen(false);
      setViewingId(updatedContact.id);
      setViewOpen(true);
      setForm(initialContactForm);
    } catch (_error: unknown) {
      toast.error('Could not update contact');
    }
  };

  const handleDelete = async () => { if (!contactToDelete) return; try { const linkedAssociations = contactApplications.filter((association: ContactApplication) => association.networkingContact?.id === contactToDelete.id); await Promise.all(linkedAssociations.map((association: ContactApplication) => deleteContactApplication.mutateAsync(association.id))); await deleteContact.mutateAsync(contactToDelete.id); toast.success(`${contactToDelete.contactName} deleted`); setContactToDelete(null); setEditOpen(false); window.setTimeout(() => { setEditingId(undefined); setForm(initialContactForm); }, 0); } catch (error: unknown) { console.error('Could not delete contact', error); toast.error('Could not delete contact'); } };

  const setColumnFilter = (index: 0 | 1, changes: Partial<ContactColumnFilter>) => { setColumnFilters((current: [ContactColumnFilter, ContactColumnFilter]) => { const next: [ContactColumnFilter, ContactColumnFilter] = [...current]; next[index] = { ...next[index], ...changes }; if (index === 0 && next[1].key === 'businessGroup') { const selectedCompanies = next[0].values; const availableBusinessGroups = new Set(contacts.filter((contact: NetworkingContact) => selectedCompanies.length === 0 || selectedCompanies.includes(getContactFieldValue(contact, 'company').trim())).map((contact: NetworkingContact) => getContactFieldValue(contact, 'businessGroup').trim()).filter((value: string) => Boolean(value))); next[1] = { ...next[1], values: next[1].values.filter((value: string) => availableBusinessGroups.has(value)) }; } return next; }); setPage(1); };
  const renderSortHeader = (key: ContactSortKey) => <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setPage(1); setSortKey((currentKey: ContactSortKey) => { if (currentKey === key) { setSortDirection((currentDirection: SortDirection) => currentDirection === 'asc' ? 'desc' : 'asc'); return currentKey; } setSortDirection('asc'); return key; }); }}>{contactSortLabels[key]}<ArrowUpDown className="ml-1 h-3 w-3" /></Button>;
  const clearFilters = () => { setSearch(''); setColumnFilters(initialContactFilters); setPage(1); };

  return (
    <div className="space-y-6">
      <InMemoryDataBanner show={HAS_IN_MEMORY_TABLES} message="This app uses draft tables for testing. Data entered won't be saved. Contact the app owner to enable storage." />
      <AlertDialog open={discardAction !== null} onOpenChange={(open: boolean) => { if (!open) setDiscardAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>You have unsaved changes in this form. If you exit now, those changes will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { discardAction?.(); setDiscardAction(null); }}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(pendingCreateRecord)} onOpenChange={(open: boolean) => { if (!open) cancelPendingCreateRecord(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Create {pendingCreateRecord?.type === 'company' ? 'company' : 'business group'}?</AlertDialogTitle><AlertDialogDescription>This will create a new {pendingCreateRecord?.type === 'company' ? 'company' : 'business group'} row named {pendingCreateRecord ? `“${pendingCreateRecord.name}”` : 'this value'}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={createCompany.isPending || createBusinessGroup.isPending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmPendingCreateRecord} disabled={createCompany.isPending || createBusinessGroup.isPending}>{createCompany.isPending || createBusinessGroup.isPending ? 'Creating…' : 'Create'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Networking contacts</h1><p className="text-muted-foreground">Track people, roles, companies, business groups, and relationship context.</p></div><Dialog open={createOpen} onOpenChange={handleCreateOpenChange}><DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Contact</Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>New contact</DialogTitle><DialogDescription>Add someone to your career network.</DialogDescription></DialogHeader><ContactForm value={form} onChange={updateForm} onSubmit={handleCreate} pending={isSaving} submitLabel="Create contact" companies={companies} businessGroups={businessGroups} applications={applications} onCreateCompany={requestCreateCompany} onCreateBusinessGroup={requestCreateBusinessGroup} /></DialogContent></Dialog></div>
      {error ? <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Could not load your contacts.</div> : null}
      <Card><CardHeader><CardTitle>Filters</CardTitle><CardDescription>Narrow contacts by search, company, or a custom field.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setSearch(event.target.value); setPage(1); }} placeholder="Search all contact fields" className="h-9 pl-9" /></div><MultiSelectFilter label="Company" options={contactFilterOptions[0] ?? []} selected={columnFilters[0].values} onSelectedChange={(values: string[]) => setColumnFilter(0, { values })} className="w-full lg:w-52" /><MultiSelectFilter label={contactFilterLabels[columnFilters[1].key]} typeLabel="Custom filter" typeValue={columnFilters[1].key} typeOptions={customContactFilterTypes} options={contactFilterOptions[1] ?? []} selected={columnFilters[1].values} onTypeChange={(value: string) => setColumnFilter(1, { key: value as ContactFilterKey, values: [] })} onSelectedChange={(values: string[]) => setColumnFilter(1, { values })} className="w-full lg:w-52" /><Button className="h-9 w-full lg:w-auto" variant="outline" onClick={clearFilters}>Clear</Button></CardContent></Card>
      <Dialog open={editOpen} onOpenChange={handleEditOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>Edit contact</DialogTitle><DialogDescription>Update this person’s networking details.</DialogDescription></DialogHeader><ContactForm value={form} onChange={updateForm} onSubmit={handleEdit} pending={isSaving} submitLabel="Save contact" companies={companies} businessGroups={businessGroups} applications={applications} onCreateCompany={requestCreateCompany} onCreateBusinessGroup={requestCreateBusinessGroup} deleteAction={<Button type="button" variant="ghost" size="icon-sm" className="group text-destructive hover:bg-card hover:text-destructive" onClick={() => { if (editingContact) setContactToDelete(editingContact); }} disabled={!editingContact || deleteContact.isPending} aria-label="Delete contact"><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button>} /></DialogContent></Dialog>
      <Dialog open={viewOpen} onOpenChange={(open: boolean) => { setViewOpen(open); if (!open) setViewingId(undefined); }}><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>Contact details</DialogTitle><DialogDescription>Review contact details before making changes.</DialogDescription></DialogHeader>{viewingContact ? <ContactDetailView contact={viewingContact} associations={contactApplications} interactionHistory={interactionHistoryByContact.get(viewingContact.id) ?? []} onEdit={() => startEdit(viewingContact)} onAddInteraction={() => openInteractionForm()} onEditInteraction={openInteractionForm} addingInteraction={createInteraction.isPending} /> : null}</DialogContent></Dialog>
      <AlertDialog open={Boolean(interactionToDelete)} onOpenChange={(open: boolean) => { if (!open) setInteractionToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this interaction. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteInteraction.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={removeInteraction} disabled={deleteInteraction.isPending}>{deleteInteraction.isPending ? 'Deleting…' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInteractionId ? 'Edit interaction' : 'New interaction'}</DialogTitle>
            <DialogDescription>{activeInteractionContact ? `Track a touchpoint with ${activeInteractionContact.contactName}.` : 'Track a contact touchpoint.'}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveInteraction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={cn('h-11 w-full justify-start bg-white text-left font-normal text-foreground dark:bg-card dark:text-card-foreground', !interactionForm.interactionDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {interactionForm.interactionDate ? formatDisplayDate(interactionForm.interactionDate) : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateKeyToLocalDate(interactionForm.interactionDate)}
                      onSelect={(date: Date | undefined) => setInteractionForm((current) => ({ ...current, interactionDate: date ? toDateKey(date) : '' }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interaction-type">Type</Label>
                <Select value={interactionForm.interactionTypeKey} onValueChange={(value: string) => setInteractionForm((current) => ({ ...current, interactionTypeKey: value as Interaction['interactionTypeKey'] }))}>
                  <SelectTrigger id="interaction-type" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(InteractionInteractionTypeKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interaction-application-search">Related application</Label>
              <RefinedSearchBox
                id="interaction-application-search"
                value={interactionApplicationSearchValue}
                options={interactionApplicationOptions}
                placeholder={activeInteractionContact ? `Search applications at ${activeInteractionContact.contactName}'s company` : 'Select a contact company first'}
                emptyLabel={activeInteractionContactCompanyId ? `No applications at ${activeInteractionContact?.contactName ?? 'this contact'}'s company` : 'Select a contact company first'}
                createLabel="Create application"
                disabled={Boolean(editingInteractionId)}
                onChange={(nextValue: string, selectedId?: string) => {
                  setInteractionApplicationSearch(nextValue);
                  if (selectedId) {
                    setInteractionForm((current) => ({ ...current, relatedApplicationId: selectedId }));
                  } else if (!nextValue.trim()) {
                    setInteractionForm((current) => ({ ...current, relatedApplicationId: 'none' }));
                  }
                }}
                onClear={() => {
                  setInteractionApplicationSearch('');
                  setInteractionForm((current) => ({ ...current, relatedApplicationId: 'none' }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interaction-notes">Notes</Label>
              <Textarea id="interaction-notes" value={interactionForm.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInteractionForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes from the conversation" />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save interaction'}</Button>
              <Button type="button" variant="outline" onClick={() => setInteractionDialogOpen(false)}>Cancel</Button>
              {editingInteractionId ? <Button type="button" variant="ghost" size="icon-sm" className="group ml-auto text-destructive hover:bg-card hover:text-destructive" onClick={() => { const interaction = interactions.find((item: Interaction) => item.id === editingInteractionId); if (interaction) setInteractionToDelete(interaction); }} disabled={deleteInteraction.isPending} aria-label="Delete interaction"><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button> : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Contact list</CardTitle><CardDescription>{isLoading ? 'Loading contacts…' : `${filteredContacts.length} of ${contacts.length} contacts`}</CardDescription></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"><Select value={String(pageSize)} onValueChange={(value: string) => { setPageSize(Number(value) as PageSize); setPage(1); }}><SelectTrigger size="sm" className="w-full py-0 sm:w-[110px]"><SelectValue aria-label="Rows per page" /></SelectTrigger><SelectContent>{pageSizeOptions.map((option: PageSize) => <SelectItem key={option} value={String(option)}>{option} rows</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:justify-end"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div></div></CardHeader><CardContent>{paginatedContacts.length === 0 ? <Empty className="rounded-xl border border-dashed bg-card py-14 text-card-foreground"><EmptyHeader><EmptyMedia variant="icon"><UserPlus className="h-6 w-6" /></EmptyMedia><EmptyTitle>No contacts found</EmptyTitle><EmptyDescription>Adjust your search or add a new contact to build your career network.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={contacts.length === 0 ? () => { setForm(initialContactForm); setCreateOpen(true); } : clearFilters}>{contacts.length === 0 ? 'Create contact' : 'Clear filters'}</Button></EmptyContent></Empty> : <div className="overflow-x-auto"><Table className="table-fixed"><TableHeader><TableRow><TableHead className="w-[48px]" aria-label="Follow ups" /><TableHead className="w-[240px]"><span className="block">Contact</span><span className="block text-xs font-normal text-muted-foreground">Email</span></TableHead><TableHead className="w-[235px]"><span className="block">Company</span><span className="block text-xs font-normal text-muted-foreground">Group</span></TableHead><TableHead className="w-[230px]"><span className="block">Role</span><span className="block text-xs font-normal text-muted-foreground">Relationship</span></TableHead><TableHead className="w-[150px]"><span className="block">Last touch</span><span className="block text-xs font-normal text-muted-foreground">Next follow-up</span></TableHead></TableRow></TableHeader><TableBody>{paginatedContacts.map((contact: NetworkingContact) => { const relationshipLabel = contact.relationshipKey ? NetworkingContactRelationshipKeyToLabel[contact.relationshipKey] ?? emptyField : emptyField; const lastInteractionDate = formatTableDate(contactTimelineDates.lastInteractionByContact.get(contact.id)); const nextFollowUpDate = formatTableDate(contactTimelineDates.nextFollowUpByContact.get(contact.id)); return <TableRow key={contact.id} className="cursor-pointer align-top" onClick={() => startView(contact)}><TableCell className="w-[48px] px-2" onClick={(event: React.MouseEvent<HTMLTableCellElement>) => event.stopPropagation()}><FollowUpCell followUps={followUps} item={contact} type="Contact" label={contact.contactName} /></TableCell><TableCell className="w-[240px] font-medium"><div className="truncate">{contact.contactName}</div>{contact.email?.trim() ? <div className="truncate text-xs text-muted-foreground">{contact.email}</div> : null}</TableCell><TableCell className="w-[235px]"><div className="truncate font-medium">{contact.company?.companyName?.trim() || emptyField}</div><div className="truncate text-xs text-muted-foreground">{contact.businessGroup?.businessGroupName?.trim() || ''}</div></TableCell><TableCell className="w-[230px]"><div className="truncate">{contact.role?.trim() || emptyField}</div><div className="truncate text-xs text-muted-foreground">{relationshipLabel}</div></TableCell><TableCell className="w-[150px] pr-2"><div className="truncate">{lastInteractionDate}</div><div className="truncate text-xs text-muted-foreground">{nextFollowUpDate}</div></TableCell></TableRow>; })}</TableBody></Table></div>}</CardContent>{paginatedContacts.length > 0 ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 sm:flex sm:justify-center"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div> : null}</Card>
      <AlertDialog open={Boolean(contactToDelete)} onOpenChange={(open: boolean) => { if (!open) setContactToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {contactToDelete?.contactName ?? 'this item'} and remove any application associations. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteContact.isPending || deleteContactApplication.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={handleDelete} disabled={deleteContact.isPending || deleteContactApplication.isPending}>{deleteContact.isPending || deleteContactApplication.isPending ? 'Deleting…' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
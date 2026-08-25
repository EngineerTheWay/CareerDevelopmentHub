import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, BriefcaseBusiness, CalendarIcon, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createCompanyOrAdopt, createBusinessGroupOrAdopt } from '@/lib/unique-records';
import { useSearchParams } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { FollowUpCell } from '@/components/follow-up-cell';


import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import { Textarea } from '@/components/ui/textarea';
import { ApplicationDeleteButton, ApplicationForm, initialApplicationForm, toApplicationFormValue, toApplicationPayload, type JobApplicationFormValue } from '@/components/application-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { MultiSelectFilter, type FilterTypeOption, type MultiSelectOption } from '@/components/multi-select-filter';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InMemoryDataBanner } from '@/generated/components/in-memory-data-banner';
import { useDeleteFollowUp, useFollowUpList } from '@/generated/hooks/use-follow-up';
import { useCompanyList, useCreateCompany } from '@/generated/hooks/use-company';
import { useBusinessGroupList, useCreateBusinessGroup } from '@/generated/hooks/use-business-group';
import { useContactApplicationList, useCreateContactApplication, useDeleteContactApplication } from '@/generated/hooks/use-contact-application';
import { useCreateInteraction, useDeleteInteraction, useInteractionList, useUpdateInteraction } from '@/generated/hooks/use-interaction';
import type { ContactApplication } from '@/generated/models/contact-application-model';
import { HAS_IN_MEMORY_TABLES } from '@/generated/hooks';
import type { Company } from '@/generated/models/company-model';
import type { BusinessGroup } from '@/generated/models/business-group-model';
import type { JobApplication, JobApplicationStageKey } from '@/generated/models/job-application-model';
import type { NetworkingContact } from '@/generated/models/networking-contact-model';
import { InteractionInteractionTypeKeyToLabel, type Interaction } from '@/generated/models/interaction-model';
import { NetworkingContactRelationshipKeyToLabel } from '@/generated/models/networking-contact-model';
import type { FollowUp } from '@/generated/models/follow-up-model';
import { getArrangementLabel, getBusinessGroupName, getCompanyName, getStageLabel, useApplications, useContacts, useCreateApplication, useDeleteApplication, useUpdateApplication, type ApplicationStage } from '@/hooks/use-career-data';
import { cn } from '@/lib/utils';

import { useIsMobile } from '@/hooks/use-mobile';
import { useSessionState } from '@/hooks/use-session-state';
import { formatDisplayDate } from '@/lib/display-date';
import { dateKeyToLocalDate, toDateKey } from '@/lib/follow-up-utils';

const stageOptions: Array<{ key: JobApplicationStageKey; label: ApplicationStage }> = [
  { key: 'Researching', label: 'Researching' }, { key: 'Applied', label: 'Applied' }, { key: 'Interviewing', label: 'Interviewing' }, { key: 'Offer', label: 'Offer' }, { key: 'Closed', label: 'Closed' },
];
const stageKeys = stageOptions.map((option: { key: JobApplicationStageKey; label: ApplicationStage }) => option.key);
const isStageKey = (value: string | null): value is JobApplicationStageKey => Boolean(value && stageKeys.includes(value as JobApplicationStageKey));
type StageFilter = 'all-active' | 'all' | JobApplicationStageKey;
const exclusiveStageFilters: StageFilter[] = ['all-active', 'all'];
type ApplicationFilterKey = 'company' | 'businessGroup' | 'role' | 'stage' | 'arrangement' | 'city' | 'nextStep';
type SortKey = 'role' | 'jobID' | 'company' | 'businessGroup' | 'city' | 'stageKey' | 'dateApplied';
type SortDirection = 'asc' | 'desc';
const sortLabels: Record<SortKey, string> = { role: 'Role', jobID: 'Job ID', company: 'Company', businessGroup: 'Business Group', city: 'City', stageKey: 'Stage', dateApplied: 'Date Applied' };
type ApplicationColumnFilter = { key: ApplicationFilterKey; values: string[] };
const applicationFilterLabels: Record<ApplicationFilterKey, string> = { company: 'Company', businessGroup: 'Business group', role: 'Role', stage: 'Stage', arrangement: 'Arrangement', city: 'City', nextStep: 'Next step' };
const initialApplicationFilters: [ApplicationColumnFilter, ApplicationColumnFilter] = [{ key: 'company', values: [] }, { key: 'businessGroup', values: [] }];
const customApplicationFilterTypes: Array<FilterTypeOption<ApplicationFilterKey>> = [{ value: 'businessGroup', label: 'Business group' }, { value: 'role', label: 'Role' }, { value: 'stage', label: 'Stage' }, { value: 'arrangement', label: 'Arrangement' }, { value: 'city', label: 'City' }, { value: 'nextStep', label: 'Next step' }];
const getSortValue = (application: JobApplication, key: SortKey) => { if (key === 'company') return getCompanyName(application); if (key === 'businessGroup') return getBusinessGroupName(application); if (key === 'stageKey') return getStageLabel(application); return application[key] ?? ''; };
const getApplicationFilterValue = (application: JobApplication, key: ApplicationFilterKey): string => { if (key === 'company') return getCompanyName(application); if (key === 'businessGroup') return getBusinessGroupName(application); if (key === 'stage') return getStageLabel(application); if (key === 'arrangement') return getArrangementLabel(application); if (key === 'city') return application.city ?? ''; if (key === 'nextStep') return application.nextStep ?? ''; return application.role; };
const getInteractionTitle = (contactName: string, typeKey: Interaction['interactionTypeKey'], dateValue: string | Date) => `${InteractionInteractionTypeKeyToLabel[typeKey]} with ${contactName} on ${formatDisplayDate(dateValue)}`;
const pageSizeOptions = [5, 10, 20, 50] as const;
type PageSize = typeof pageSizeOptions[number];
const makeTempId = (name: string) => `00000000-0000-4000-8000-${name.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(12, '0').slice(0, 12)}`;
const normalizeName = (name: string) => name.trim().toLowerCase();
const emptyField = '—';
type ApplicationInteractionHistoryItem = { id: string; date: string; type: string; contactName: string; contactRole?: string; notes?: string };

function ApplicationInteractionHistory({ items, onAddInteraction, onEditInteraction, addingInteraction = false }: { items: ApplicationInteractionHistoryItem[]; onAddInteraction?: () => void; onEditInteraction?: (interactionId: string) => void; addingInteraction?: boolean }) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div>
          <p className="text-sm font-medium">Interaction history</p>
          <p className="text-xs text-muted-foreground">All saved application touchpoints</p>
        </div>
        <Button type="button" size="sm" className="h-8" onClick={onAddInteraction} disabled={!onAddInteraction || addingInteraction}>
          <Plus className="h-3.5 w-3.5" /> Interaction
        </Button>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? <div className="rounded-lg border border-dashed bg-muted p-3 text-sm text-muted-foreground">No interaction history yet.</div> : items.map((item: ApplicationInteractionHistoryItem) => (
          <button key={item.id} type="button" className="w-full rounded-lg border bg-white p-3 text-left text-foreground shadow-sm transition hover:border-primary dark:bg-card" onClick={() => onEditInteraction?.(item.id)}>
            <div className="text-sm font-medium">{formatDisplayDate(item.date)} • {item.type}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{item.contactName}{item.contactRole?.trim() ? ` - ${item.contactRole}` : ''}</div>
            {item.notes?.trim() ? <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.notes}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ApplicationDetailView({ application, associatedContacts, interactionHistory, onEdit, onAddInteraction, onEditInteraction, addingInteraction = false }: { application: JobApplication; associatedContacts: NetworkingContact[]; interactionHistory: ApplicationInteractionHistoryItem[]; onEdit: () => void; onAddInteraction: () => void; onEditInteraction: (interactionId: string) => void; addingInteraction?: boolean }) {
  const contactsSummary = associatedContacts.length > 0 ? associatedContacts.map((contact: NetworkingContact) => contact.contactName).join(', ') : emptyField;
  const compactRows = [
    { label: 'Role', value: application.role?.trim() || emptyField },
    { label: 'Stage', value: getStageLabel(application).trim() || emptyField },
    { label: 'Company', value: getCompanyName(application).trim() || emptyField },
    { label: 'Business group', value: getBusinessGroupName(application).trim() || emptyField },
    { label: 'Job link', value: application.jobLink?.trim() || emptyField, href: application.jobLink?.trim() || undefined },
    { label: 'Job ID', value: application.jobID?.trim() || emptyField },
    { label: 'Work arrangement', value: getArrangementLabel(application).trim() || emptyField },
    { label: 'City', value: application.city?.trim() || emptyField },
    { label: 'Date applied', value: formatDisplayDate(application.dateApplied) },
    { label: 'Next step', value: application.nextStep?.trim() || emptyField },
    { label: 'Associated contacts', value: contactsSummary, wide: true },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{application.role}</h3>
            <p className="truncate text-sm text-muted-foreground">{getCompanyName(application).trim() || 'Unknown company'}</p>
          </div>
          <Button type="button" size="sm" onClick={onEdit}>Edit</Button>
        </div>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {compactRows.map((row: { label: string; value: string; href?: string; wide?: boolean }) => (
            <div key={row.label} className={row.wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
              <div className="text-[11px] font-medium text-muted-foreground">{row.label}</div>
              {row.href ? <a href={row.href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium underline"><span className="truncate">{row.value}</span><ExternalLink className="h-3 w-3 shrink-0" /></a> : <div className="truncate text-sm font-medium">{row.value}</div>}
            </div>
          ))}
          <div className="min-w-0 sm:col-span-2">
            <div className="text-[11px] font-medium text-muted-foreground">Notes</div>
            <p className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap text-sm">{application.notes?.trim() || emptyField}</p>
          </div>
        </div>
      </div>
      <ApplicationInteractionHistory items={interactionHistory} onAddInteraction={onAddInteraction} onEditInteraction={onEditInteraction} addingInteraction={addingInteraction} />
    </div>
  );
}

export default function ApplicationsPage() {
  const [searchParams] = useSearchParams();

  const requestedStage = searchParams.get('stage');
  const { data, error, isLoading } = useApplications();
  const { data: followUpData } = useFollowUpList();
  const { data: contactData } = useContacts();
  const { data: contactApplicationData } = useContactApplicationList();
  const { data: companyData } = useCompanyList();
  const { data: businessGroupData } = useBusinessGroupList();
  const createApplication = useCreateApplication();
  const updateApplication = useUpdateApplication();
  const { data: interactionData } = useInteractionList();
  const createInteraction = useCreateInteraction();
  const updateInteraction = useUpdateInteraction();
  const deleteInteraction = useDeleteInteraction();

  const createContactApplication = useCreateContactApplication();
  const deleteContactApplication = useDeleteContactApplication();
  const deleteApplication = useDeleteApplication();
  const deleteFollowUp = useDeleteFollowUp();
  const queryClient = useQueryClient();
  const createCompany = useCreateCompany();
  const contacts = (contactData ?? []).filter((contact: NetworkingContact) => Boolean(contact?.id && contact.contactName));
  const contactApplications = (contactApplicationData ?? []).filter((association: ContactApplication) => Boolean(association?.id && association.networkingContact?.id && association.jobApplication?.id));
  const createBusinessGroup = useCreateBusinessGroup();
  const followUps = followUpData ?? [];
  const isMobile = useIsMobile();
  const applications = data ?? [];
  const companies = companyData ?? [];
  const interactions = interactionData ?? [];
  const businessGroups = businessGroupData ?? [];
  const [sortKey, setSortKey] = useSessionState<SortKey>('career-hub.applications.sort-key', 'dateApplied');
  const [sortDirection, setSortDirection] = useSessionState<SortDirection>('career-hub.applications.sort-direction', 'desc');
  const [search, setSearch] = useSessionState('career-hub.applications.search', '');
  const [stageFilters, setStageFilters] = useSessionState<StageFilter[]>('career-hub.applications.stage-filters', [requestedStage === 'all' ? 'all' : requestedStage === 'active' ? 'all-active' : isStageKey(requestedStage) ? requestedStage : 'all-active']);
  const [columnFilters, setColumnFilters] = useSessionState<[ApplicationColumnFilter, ApplicationColumnFilter]>('career-hub.applications.column-filters', initialApplicationFilters);
  const [createOpen, setCreateOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<JobApplication | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [viewOpen, setViewOpen] = useState(false);
  const [pageSize, setPageSize] = useSessionState<PageSize>('career-hub.applications.page-size', 10);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [editingInteractionId, setEditingInteractionId] = useState<string | undefined>();
  const [interactionToDelete, setInteractionToDelete] = useState<Interaction | null>(null);
  const [interactionContactSearch, setInteractionContactSearch] = useState('');
  const [interactionForm, setInteractionForm] = useState<{ interactionDate: string; interactionTypeKey: Interaction['interactionTypeKey']; notes: string; contactId: string }>({ interactionDate: toDateKey(new Date()), interactionTypeKey: 'Other', notes: '', contactId: '' });
  const [viewingId, setViewingId] = useState<string>();

  const [page, setPage] = useSessionState('career-hub.applications.page', 1);

  const [form, setForm] = useState<JobApplicationFormValue>(initialApplicationForm);

  const [pendingCreateRecord, setPendingCreateRecord] = useState<{ type: 'company' | 'businessGroup'; name: string } | null>(null);
  useEffect(() => { if (isMobile && pageSize !== 5) { setPageSize(5); setPage(1); } }, [isMobile, pageSize, setPage, setPageSize]);
  useEffect(() => {
    if (requestedStage === 'all') { setStageFilters(['all']); setPage(1); return; }
    if (requestedStage === 'active') { setStageFilters(['all-active']); setPage(1); return; }
    if (isStageKey(requestedStage)) { setStageFilters([requestedStage]); setPage(1); }
  }, [requestedStage, setPage, setStageFilters]);

  const stageFilterOptions = useMemo((): Array<MultiSelectOption<StageFilter>> => [{ value: 'all-active', label: 'All active' }, { value: 'all', label: 'All stages' }, ...stageOptions.map((option: { key: JobApplicationStageKey; label: ApplicationStage }) => ({ value: option.key, label: option.label }))], []);
  const handleStageFiltersChange = (values: StageFilter[]) => {
    const latestValue = values[values.length - 1];
    if (!latestValue || latestValue === 'all-active' || latestValue === 'all') { setStageFilters([latestValue ?? 'all-active']); setPage(1); return; }
    const specificStages = values.filter((value: StageFilter) => !exclusiveStageFilters.includes(value));
    setStageFilters(specificStages.length > 0 ? specificStages : ['all-active']);
    setPage(1);
  };
  const applicationFilterOptions = useMemo(() => columnFilters.map((filter: ApplicationColumnFilter) => { const uniqueValues = Array.from(new Set(applications.map((application: JobApplication) => getApplicationFilterValue(application, filter.key).trim()).filter((value: string) => Boolean(value)))); return uniqueValues.sort((first: string, second: string) => first.localeCompare(second, undefined, { sensitivity: 'base' })).map((value: string): MultiSelectOption => ({ value, label: value })); }), [applications, columnFilters]);
  const filteredApplications = useMemo(() => applications.filter((application: JobApplication) => { const companyName = getCompanyName(application); const groupName = getBusinessGroupName(application); const normalizedSearch = search.trim().toLowerCase(); const matchesSearch = normalizedSearch ? [application.role, companyName, groupName, application.city, application.jobID, application.jobLink, application.dateApplied, application.nextStep, application.notes].some((value: string | undefined) => (value ?? '').toLowerCase().includes(normalizedSearch)) : true; const matchesStage = stageFilters.includes('all') || (stageFilters.includes('all-active') && application.stageKey !== 'Closed') || stageFilters.includes(application.stageKey); const matchesColumnFilters = columnFilters.every((filter: ApplicationColumnFilter) => filter.values.length === 0 || filter.values.includes(getApplicationFilterValue(application, filter.key).trim())); return matchesSearch && matchesStage && matchesColumnFilters; }), [applications, columnFilters, search, stageFilters]);
  const sortedApplications = useMemo(() => [...filteredApplications].sort((first: JobApplication, second: JobApplication) => { const result = getSortValue(first, sortKey).toString().toLowerCase().localeCompare(getSortValue(second, sortKey).toString().toLowerCase(), undefined, { numeric: true, sensitivity: 'base' }); return sortDirection === 'asc' ? result : -result; }), [filteredApplications, sortDirection, sortKey]);
  const totalPages = Math.max(1, Math.ceil(sortedApplications.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleApplications = sortedApplications.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const getApplicationFollowUps = (applicationId: string) => followUps.filter((followUp: FollowUp) => followUp.relatedTypeKey === 'Application' && followUp.relatedApplication?.id === applicationId);
  const getApplicationFollowUpCounts = (applicationId: string) => {
    const associatedFollowUps = getApplicationFollowUps(applicationId);
    return {
      open: associatedFollowUps.filter((followUp: FollowUp) => followUp.statusKey === 'Open').length,
      completed: associatedFollowUps.filter((followUp: FollowUp) => followUp.statusKey === 'Completed').length,
      total: associatedFollowUps.length,
    };
  };
  const renderSortHeader = (key: SortKey) => <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setPage(1); setSortKey((currentKey: SortKey) => { if (currentKey === key) { setSortDirection((currentDirection: SortDirection) => currentDirection === 'asc' ? 'desc' : 'asc'); return currentKey; } setSortDirection('asc'); return key; }); }}>{sortLabels[key]}<ArrowUpDown className="ml-1 h-3 w-3" /></Button>;
  const setColumnFilter = (index: 0 | 1, changes: Partial<ApplicationColumnFilter>) => { setColumnFilters((current: [ApplicationColumnFilter, ApplicationColumnFilter]) => { const next: [ApplicationColumnFilter, ApplicationColumnFilter] = [...current]; next[index] = { ...next[index], ...changes }; return next; }); setPage(1); };
  const updateForm = (field: keyof JobApplicationFormValue, value: string | string[]) => setForm((current: JobApplicationFormValue) => ({ ...current, [field]: value }));
  const syncApplicationContacts = async (application: JobApplication) => {
    const existingAssociations = contactApplications.filter((association: ContactApplication) => association.jobApplication?.id === application.id);
    const selectedIds = new Set(form.contactIds);
    const existingIds = new Set(existingAssociations.map((association: ContactApplication) => association.networkingContact?.id));
    const associationsToDelete = existingAssociations.filter((association: ContactApplication) => !selectedIds.has(association.networkingContact?.id));
    const contactsToCreate = contacts.filter((contact: NetworkingContact) => selectedIds.has(contact.id) && !existingIds.has(contact.id));
    await Promise.all(associationsToDelete.map((association: ContactApplication) => deleteContactApplication.mutateAsync(association.id)));
    await Promise.all(contactsToCreate.map((contact: NetworkingContact) => createContactApplication.mutateAsync({ contactApplicationName: `${contact.contactName} - ${application.role}`, networkingContact: { id: contact.id, contactName: contact.contactName }, jobApplication: { id: application.id, role: application.role } })));
  };
  const resolvePayload = async (value: JobApplicationFormValue) => {
    const companyName = value.companyName.trim();
    const businessGroupName = value.businessGroupName?.trim();
    const existingCompany = value.companyId ? companies.find((companyRecord: Company) => companyRecord.id === value.companyId) : companies.find((companyRecord: Company) => normalizeName(companyRecord.companyName) === normalizeName(companyName));
    const companyRecord = existingCompany ?? (await createCompanyOrAdopt(() => createCompany.mutateAsync({ companyName }), companyName, queryClient)).record;
    const existingBusinessGroup = businessGroupName ? businessGroups.find((businessGroupRecord: typeof businessGroups[number]) => normalizeName(businessGroupRecord.businessGroupName) === normalizeName(businessGroupName) && (!businessGroupRecord.company?.id || businessGroupRecord.company?.id === companyRecord.id)) : undefined;
    const businessGroupRecord = businessGroupName ? existingBusinessGroup ?? (await createBusinessGroupOrAdopt(() => createBusinessGroup.mutateAsync({ businessGroupName, company: { id: companyRecord.id, companyName: companyRecord.companyName } }), businessGroupName, companyRecord.id, queryClient)).record : undefined;
    return toApplicationPayload(value, { id: companyRecord.id, companyName: companyRecord.companyName }, businessGroupRecord ? { id: businessGroupRecord.id, businessGroupName: businessGroupRecord.businessGroupName } : null);
  };
  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.role.trim() || !form.companyName.trim()) { toast.error('Role and company are required'); return; }
    try {
      const payload = await resolvePayload(form);
      const createdApplication = await createApplication.mutateAsync(payload);
      await syncApplicationContacts(createdApplication);
      toast.success('Application created');
      setForm(initialApplicationForm);
      setCreateOpen(false);
    } catch (_error: unknown) {
      toast.error('Could not create application');
    }
  };
  const getApplicationContactIds = (applicationId: string) => contactApplications.filter((association: ContactApplication) => association.jobApplication?.id === applicationId).map((association: ContactApplication) => association.networkingContact?.id);

  const startView = (application: JobApplication) => { setEditingId(undefined); setViewingId(application.id); setViewOpen(true); };
  const startEdit = (application: JobApplication) => { setViewOpen(false); setEditingId(application.id); setViewingId(application.id); setForm(toApplicationFormValue(application, getApplicationContactIds(application.id))); setEditOpen(true); };
  const editingApplication = editingId ? applications.find((application: JobApplication) => application.id === editingId) : undefined;
  const viewingApplication = viewingId ? applications.find((application: JobApplication) => application.id === viewingId) : undefined;
  const viewingApplicationContacts = viewingApplication ? contacts.filter((contact: NetworkingContact) => Boolean(viewingApplication.company?.id && contact.company?.id === viewingApplication.company?.id)) : [];
  const formatContactWithRole = (contact: NetworkingContact) => `${contact.contactName}${contact.role?.trim() ? ` - ${contact.role.trim()}` : ''}`;
  const viewingApplicationContactOptions = viewingApplication ? viewingApplicationContacts.map((contact: NetworkingContact): RefinedSearchOption => ({ id: contact.id, label: formatContactWithRole(contact), description: NetworkingContactRelationshipKeyToLabel[contact.relationshipKey] ?? contact.relationshipKey })) : [];
  const selectedInteractionContact = interactionForm.contactId ? viewingApplicationContacts.find((contact: NetworkingContact) => contact.id === interactionForm.contactId) : undefined;
  const interactionContactSearchValue = selectedInteractionContact ? formatContactWithRole(selectedInteractionContact) : interactionContactSearch;
  const viewingApplicationInteractions = viewingApplication ? interactions.filter((interaction: Interaction) => interaction.relatedApplication?.id === viewingApplication.id).map((interaction: Interaction): ApplicationInteractionHistoryItem => { const relatedContact = interaction.contact?.id ? contacts.find((contact: NetworkingContact) => contact.id === interaction.contact?.id) : undefined; return { id: interaction.id, date: interaction.interactionDate, type: InteractionInteractionTypeKeyToLabel[interaction.interactionTypeKey] ?? interaction.interactionTypeKey, contactName: interaction.contact?.contactName ?? relatedContact?.contactName ?? emptyField, contactRole: relatedContact?.role, notes: interaction.notes }; }).sort((first: ApplicationInteractionHistoryItem, second: ApplicationInteractionHistoryItem) => new Date(second.date).getTime() - new Date(first.date).getTime()) : [];
  const isApplicationFormDirty = (baseline: JobApplicationFormValue) => JSON.stringify(form) !== JSON.stringify(baseline);
  const createFormDirty = createOpen && isApplicationFormDirty(initialApplicationForm);
  const editFormDirty = editOpen && isApplicationFormDirty(editingApplication ? toApplicationFormValue(editingApplication, getApplicationContactIds(editingApplication.id)) : initialApplicationForm);
  const hasUnsavedChanges = createFormDirty || editFormDirty;
  const guardRegistration = useMemo(() => ({
    isDirty: hasUnsavedChanges,
    onDiscard: () => { setCreateOpen(false); setEditOpen(false); setEditingId(undefined); setForm(initialApplicationForm); },
  }), [hasUnsavedChanges]);
  useUnsavedChangesGuard(guardRegistration);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const requestDiscard = (action: () => void) => setDiscardAction(() => action);
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
        const existingCompany = companies.find((companyRecord: Company) => normalizeName(companyRecord.companyName) === normalizeName(companyName));
        const companyRecord = existingCompany ?? (await createCompanyOrAdopt(() => createCompany.mutateAsync({ companyName }), companyName, queryClient)).record;
        updateForm('companyName', companyRecord.companyName);
        updateForm('companyId', companyRecord.id);
        updateForm('businessGroupName', '');
        updateForm('businessGroupId', '');
        toast.success(existingCompany ? 'Company selected' : 'Company created');
      } else {
        const businessGroupName = pendingCreateRecord.name.trim();
        const companyName = form.companyName.trim();
        const companyRecord = form.companyId ? companies.find((companyItem: Company) => companyItem.id === form.companyId) : companies.find((companyItem: Company) => normalizeName(companyItem.companyName) === normalizeName(companyName));
        if (!companyRecord) { toast.error('Select or create a company first'); return; }
        const existingBusinessGroup = businessGroups.find((businessGroupRecord: BusinessGroup) => normalizeName(businessGroupRecord.businessGroupName) === normalizeName(businessGroupName) && (!businessGroupRecord.company?.id || businessGroupRecord.company?.id === companyRecord.id));
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
  const openInteractionForm = (interactionId?: string) => {
    if (!viewingApplication) return;
    const interaction = interactionId ? interactions.find((item: Interaction) => item.id === interactionId) : undefined;
    setEditingInteractionId(interactionId);
    setInteractionForm({ interactionDate: interaction?.interactionDate ? toDateKey(interaction.interactionDate) : toDateKey(new Date()), interactionTypeKey: interaction?.interactionTypeKey ?? 'Other', notes: interaction?.notes ?? '', contactId: interaction?.contact?.id ?? '' });
    setInteractionContactSearch('');
    setInteractionDialogOpen(true);
  };
  const saveInteraction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewingApplication) return;
    const selectedContact = viewingApplicationContacts.find((contact: NetworkingContact) => contact.id === interactionForm.contactId);
    if (!selectedContact) { toast.error('Contact is required'); return; }
    const interactionDate = interactionForm.interactionDate || toDateKey(new Date());
    try {
      const payload = {
        interactionName: getInteractionTitle(selectedContact.contactName, interactionForm.interactionTypeKey, interactionDate),
        contact: { id: selectedContact.id, contactName: selectedContact.contactName },
        interactionDate,
        interactionTypeKey: interactionForm.interactionTypeKey,
        notes: interactionForm.notes.trim() || undefined,
        relatedApplication: { id: viewingApplication.id, role: viewingApplication.role },
      };
      if (editingInteractionId) {
        await updateInteraction.mutateAsync({ id: editingInteractionId, changedFields: payload });
        toast.success('Interaction updated');
      } else {
        await createInteraction.mutateAsync(payload);
        toast.success('Interaction created');
      }
      setInteractionDialogOpen(false);
      setEditingInteractionId(undefined);
      setInteractionContactSearch('');
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
  const handleCreateOpenChange = (open: boolean) => { if (open) { setCreateOpen(true); return; } if (!createFormDirty) { setCreateOpen(false); window.setTimeout(() => setForm(initialApplicationForm), 0); return; } requestDiscard(() => { setCreateOpen(false); window.setTimeout(() => setForm(initialApplicationForm), 0); }); };
  const handleEditOpenChange = (open: boolean) => { if (open) { setEditOpen(true); return; } if (!editFormDirty) { setEditOpen(false); if (editingId) { setViewingId(editingId); setViewOpen(true); } window.setTimeout(() => { setForm(initialApplicationForm); }, 0); return; } requestDiscard(() => { const applicationId = editingId; setEditOpen(false); if (applicationId) { setViewingId(applicationId); setViewOpen(true); } window.setTimeout(() => { setForm(initialApplicationForm); }, 0); }); };
  const handleEdit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!editingId) return; if (!form.role.trim() || !form.companyName.trim()) { toast.error('Role and company are required'); return; } try { const payload = await resolvePayload(form); const updatedApplication = await updateApplication.mutateAsync({ id: editingId, changedFields: payload }); await syncApplicationContacts(updatedApplication); toast.success('Application updated'); setEditOpen(false); setViewingId(updatedApplication.id); setViewOpen(true); setForm(initialApplicationForm); } catch (_error: unknown) { toast.error('Could not update application'); } };
  const handleDelete = async () => { if (!applicationToDelete) return; try { const linkedFollowUps = getApplicationFollowUps(applicationToDelete.id); const linkedAssociations = contactApplications.filter((association: ContactApplication) => association.jobApplication?.id === applicationToDelete.id); await Promise.all([...linkedFollowUps.map((followUp: FollowUp) => deleteFollowUp.mutateAsync(followUp.id)), ...linkedAssociations.map((association: ContactApplication) => deleteContactApplication.mutateAsync(association.id))]); await deleteApplication.mutateAsync(applicationToDelete.id); toast.success(`${applicationToDelete.role} deleted`); setApplicationToDelete(null); setEditOpen(false); setEditingId(undefined); setForm(initialApplicationForm); } catch (error: unknown) { console.error('Could not delete application', error); toast.error('Could not delete application'); } };


  const handleClearFilters = () => { setSearch(''); setStageFilters(['all-active']); setColumnFilters(initialApplicationFilters); setPage(1); };

  return <><div className="space-y-6"><InMemoryDataBanner show={HAS_IN_MEMORY_TABLES} message="This app uses draft tables for testing. Data entered won't be saved. Contact the app owner to enable storage." /><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Job applications</h1><p className="text-muted-foreground">Track roles by company, business group, work arrangement, and stage.</p></div><Dialog open={createOpen} onOpenChange={handleCreateOpenChange}><DialogTrigger asChild><Button onClick={() => setForm(initialApplicationForm)}><Plus className="h-4 w-4" /> Application</Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-3xl"><DialogHeader><DialogTitle>New application</DialogTitle><DialogDescription>Add a job to your search pipeline.</DialogDescription></DialogHeader><ApplicationForm value={form} onChange={updateForm} onSubmit={handleCreate} pending={createApplication.isPending || createCompany.isPending || createBusinessGroup.isPending || createContactApplication.isPending || deleteContactApplication.isPending} submitLabel="Create application" companies={companies} businessGroups={businessGroups} contacts={contacts} onCreateCompany={requestCreateCompany} onCreateBusinessGroup={requestCreateBusinessGroup} /></DialogContent></Dialog></div>{error ? <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Could not load your applications.</div> : null}<Card><CardHeader><CardTitle>Filters</CardTitle><CardDescription>Narrow applications by search, stage, company, or a custom field.</CardDescription></CardHeader><CardContent className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(9rem,10rem)_minmax(10rem,13rem)_minmax(10rem,13rem)_auto] lg:items-center"><div className="relative flex h-9 min-w-0 items-center rounded-md border bg-card text-card-foreground shadow-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-full border-0 bg-card pl-9 shadow-none focus-visible:ring-1" value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setSearch(event.target.value); setPage(1); }} placeholder="Search all application fields" /></div><MultiSelectFilter label="Stage" options={stageFilterOptions} selected={stageFilters} onSelectedChange={handleStageFiltersChange} className="w-full lg:w-40" /><MultiSelectFilter label="Company" options={applicationFilterOptions[0] ?? []} selected={columnFilters[0].values} onSelectedChange={(values: string[]) => setColumnFilter(0, { values })} className="w-full lg:w-52" /><MultiSelectFilter label={applicationFilterLabels[columnFilters[1].key]} typeLabel="Custom filter" typeValue={columnFilters[1].key} typeOptions={customApplicationFilterTypes} options={applicationFilterOptions[1] ?? []} selected={columnFilters[1].values} onTypeChange={(value: string) => setColumnFilter(1, { key: value as ApplicationFilterKey, values: [] })} onSelectedChange={(values: string[]) => setColumnFilter(1, { values })} className="w-full lg:w-52" /><Button className="h-9 w-full lg:w-auto" variant="outline" onClick={handleClearFilters}>Clear</Button></CardContent></Card><Dialog open={viewOpen} onOpenChange={setViewOpen}><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-3xl"><DialogHeader><DialogTitle>Application details</DialogTitle><DialogDescription>Review application info, notes, and related interactions.</DialogDescription></DialogHeader>{viewingApplication ? <ApplicationDetailView application={viewingApplication} associatedContacts={viewingApplicationContacts} interactionHistory={viewingApplicationInteractions} onEdit={() => startEdit(viewingApplication)} onAddInteraction={() => openInteractionForm()} onEditInteraction={openInteractionForm} addingInteraction={createInteraction.isPending} /> : null}</DialogContent></Dialog><Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingInteractionId ? 'Edit interaction' : 'New interaction'}</DialogTitle><DialogDescription>{viewingApplication ? `Track a touchpoint for ${viewingApplication.role}. Contact is required.` : 'Track an application touchpoint.'}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={saveInteraction}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="application-interaction-date">Date <span className="text-destructive" aria-hidden="true">*</span></Label><Popover><PopoverTrigger asChild><Button id="application-interaction-date" type="button" variant="outline" className={cn('h-11 w-full justify-start bg-white text-left font-normal text-foreground dark:bg-card dark:text-card-foreground', !interactionForm.interactionDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{interactionForm.interactionDate ? formatDisplayDate(interactionForm.interactionDate) : 'Pick a date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateKeyToLocalDate(interactionForm.interactionDate)} onSelect={(date: Date | undefined) => setInteractionForm((current) => ({ ...current, interactionDate: date ? toDateKey(date) : '' }))} initialFocus /></PopoverContent></Popover></div><div className="space-y-2"><Label htmlFor="application-interaction-type">Type <span className="text-destructive" aria-hidden="true">*</span></Label><Select value={interactionForm.interactionTypeKey} onValueChange={(value: string) => setInteractionForm((current) => ({ ...current, interactionTypeKey: value as Interaction['interactionTypeKey'] }))}><SelectTrigger id="application-interaction-type" className="h-11"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(InteractionInteractionTypeKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label htmlFor="application-interaction-contact">Contact <span className="text-destructive" aria-hidden="true">*</span></Label><RefinedSearchBox id="application-interaction-contact" value={interactionContactSearchValue} options={viewingApplicationContactOptions} placeholder={viewingApplication ? `Search contacts at ${getCompanyName(viewingApplication)}` : 'Search contacts'} emptyLabel="No associated contacts found" createLabel="Create contact" disabled={Boolean(editingInteractionId)} onChange={(value: string, selectedId?: string) => { setInteractionContactSearch(value); setInteractionForm((current) => ({ ...current, contactId: selectedId ?? '' })); }} onClear={() => { setInteractionContactSearch(''); setInteractionForm((current) => ({ ...current, contactId: '' })); }} /></div><div className="space-y-2"><Label htmlFor="application-interaction-notes">Notes</Label><Textarea id="application-interaction-notes" value={interactionForm.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setInteractionForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes from the conversation" /></div><div className="flex items-center gap-2"><Button type="submit" disabled={createInteraction.isPending || updateInteraction.isPending}>{createInteraction.isPending || updateInteraction.isPending ? 'Saving…' : 'Save interaction'}</Button><Button type="button" variant="outline" onClick={() => setInteractionDialogOpen(false)}>Cancel</Button>{editingInteractionId ? <Button type="button" variant="ghost" size="icon-sm" className="group ml-auto text-destructive hover:bg-card hover:text-destructive" onClick={() => { const interaction = interactions.find((item: Interaction) => item.id === editingInteractionId); if (interaction) setInteractionToDelete(interaction); }} disabled={deleteInteraction.isPending} aria-label="Delete interaction"><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button> : null}</div></form></DialogContent></Dialog><Dialog open={editOpen} onOpenChange={handleEditOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-3xl"><DialogHeader><DialogTitle>Edit application</DialogTitle><DialogDescription>Update this job application.</DialogDescription></DialogHeader><ApplicationForm value={form} onChange={updateForm} onSubmit={handleEdit} pending={updateApplication.isPending || createCompany.isPending || createBusinessGroup.isPending || createContactApplication.isPending || deleteContactApplication.isPending} submitLabel="Save application" companies={companies} businessGroups={businessGroups} contacts={contacts} onCreateCompany={requestCreateCompany} onCreateBusinessGroup={requestCreateBusinessGroup} deleteAction={<ApplicationDeleteButton onClick={() => { if (editingApplication) setApplicationToDelete(editingApplication); }} disabled={!editingApplication || deleteApplication.isPending || deleteFollowUp.isPending || deleteContactApplication.isPending} />} /></DialogContent></Dialog><Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Application pipeline</CardTitle><CardDescription>{isLoading ? 'Loading applications…' : `${filteredApplications.length} of ${applications.length} applications`}</CardDescription></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"><Select value={String(pageSize)} onValueChange={(value: string) => { setPageSize(Number(value) as PageSize); setPage(1); }}><SelectTrigger size="sm" className="w-full py-0 sm:w-[110px]"><SelectValue aria-label="Rows per page" /></SelectTrigger><SelectContent>{pageSizeOptions.map((option: PageSize) => <SelectItem key={option} value={String(option)}>{option} rows</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:justify-end"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div></div></CardHeader><CardContent>{visibleApplications.length === 0 ? <Empty className="rounded-xl border border-dashed bg-card py-14 text-card-foreground"><EmptyHeader><EmptyMedia variant="icon"><BriefcaseBusiness className="h-6 w-6" /></EmptyMedia><EmptyTitle>No applications found</EmptyTitle><EmptyDescription>Adjust your search or add a new application to build your career pipeline.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={applications.length === 0 ? () => { setForm(initialApplicationForm); setCreateOpen(true); } : handleClearFilters}>{applications.length === 0 ? 'Create application' : 'Clear filters'}</Button></EmptyContent></Empty> : <div className="overflow-x-auto"><Table className="min-w-[760px] table-fixed"><TableHeader><TableRow><TableHead className="w-[44px] px-2" aria-label="Follow ups" /><TableHead className="w-[210px] px-3"><span className="block">Role</span><span className="block text-xs font-normal text-muted-foreground">Job ID</span></TableHead><TableHead className="w-[205px] px-3"><span className="block">Company</span><span className="block text-xs font-normal text-muted-foreground">Group</span></TableHead><TableHead className="w-[125px] px-3"><span className="block">Location</span><span className="block text-xs font-normal text-muted-foreground">Arrangement</span></TableHead><TableHead className="w-[140px] px-3"><span className="block">Stage</span><span className="block text-xs font-normal text-muted-foreground">Next step</span></TableHead><TableHead className="w-[120px] px-3"><span className="block">Date applied</span><span className="block text-xs font-normal text-muted-foreground">Link</span></TableHead></TableRow></TableHeader><TableBody>{visibleApplications.map((application: JobApplication) => { return <TableRow key={application.id} className="cursor-pointer align-top" onClick={() => startView(application)}><TableCell className="w-[44px] px-2" onClick={(event: React.MouseEvent<HTMLTableCellElement>) => event.stopPropagation()}><FollowUpCell followUps={followUps} item={application} type="Application" label={application.role} /></TableCell><TableCell className="w-[210px] px-3 font-medium"><div className="truncate">{application.role?.trim() || emptyField}</div><div className="truncate text-xs text-muted-foreground">{application.jobID?.trim() || ''}</div></TableCell><TableCell className="w-[205px] px-3"><div className="truncate font-medium">{getCompanyName(application).trim() || emptyField}</div><div className="truncate text-xs text-muted-foreground">{getBusinessGroupName(application).trim() || ''}</div></TableCell><TableCell className="w-[125px] px-3"><div className="truncate">{application.city?.trim() || emptyField}</div><div className="truncate text-xs text-muted-foreground">{getArrangementLabel(application).trim() || emptyField}</div></TableCell><TableCell className="w-[140px] px-3"><div className="truncate">{getStageLabel(application).trim() || emptyField}</div><div className="truncate text-xs text-muted-foreground">{application.nextStep?.trim() || ''}</div></TableCell><TableCell className="w-[120px] px-3"><div className="truncate">{formatDisplayDate(application.dateApplied)}</div><div className="truncate whitespace-nowrap text-xs">{application.jobLink?.trim() ? <a href={application.jobLink} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-foreground underline" onClick={(event: React.MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}><span className="truncate">Open job</span><ExternalLink className="h-3 w-3 shrink-0" /></a> : <span className="text-muted-foreground">No link</span>}</div></TableCell></TableRow>; })}</TableBody></Table></div>}</CardContent>{visibleApplications.length > 0 ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 sm:flex sm:justify-center"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div> : null}</Card></div><AlertDialog open={Boolean(pendingCreateRecord)} onOpenChange={(open: boolean) => { if (!open) cancelPendingCreateRecord(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Create {pendingCreateRecord?.type === 'company' ? 'company' : 'business group'}?</AlertDialogTitle><AlertDialogDescription>This will create a new {pendingCreateRecord?.type === 'company' ? 'company' : 'business group'} row named {pendingCreateRecord ? `“${pendingCreateRecord.name}”` : 'this value'}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={createCompany.isPending || createBusinessGroup.isPending}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmPendingCreateRecord} disabled={createCompany.isPending || createBusinessGroup.isPending}>{createCompany.isPending || createBusinessGroup.isPending ? 'Creating…' : 'Create'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog open={discardAction !== null} onOpenChange={(open: boolean) => { if (!open) setDiscardAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>You have unsaved changes in this form. If you exit now, those changes will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { discardAction?.(); setDiscardAction(null); }}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog open={Boolean(applicationToDelete)} onOpenChange={(open: boolean) => { if (!open) setApplicationToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle><AlertDialogDescription>{applicationToDelete && (getApplicationFollowUpCounts(applicationToDelete.id).total > 0 || contactApplications.some((association: ContactApplication) => association.jobApplication?.id === applicationToDelete.id)) ? `This application has ${getApplicationFollowUpCounts(applicationToDelete.id).total} associated follow-ups and ${contactApplications.filter((association: ContactApplication) => association.jobApplication?.id === applicationToDelete.id).length} contact associations. To proceed, those linked records will be removed too.` : `This will permanently delete ${applicationToDelete ? `${applicationToDelete.role} at ${getCompanyName(applicationToDelete)}` : 'this item'}. This action cannot be undone.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteApplication.isPending || deleteContactApplication.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={handleDelete} disabled={deleteApplication.isPending || deleteFollowUp.isPending || deleteContactApplication.isPending}>{deleteApplication.isPending || deleteFollowUp.isPending || deleteContactApplication.isPending ? 'Deleting…' : applicationToDelete && (getApplicationFollowUpCounts(applicationToDelete.id).total > 0 || contactApplications.some((association: ContactApplication) => association.jobApplication?.id === applicationToDelete.id)) ? 'Delete linked records and application' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog open={Boolean(interactionToDelete)} onOpenChange={(open: boolean) => { if (!open) setInteractionToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this interaction?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this interaction. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteInteraction.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={removeInteraction} disabled={deleteInteraction.isPending}>{deleteInteraction.isPending ? 'Deleting…' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MessageSquarePlus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectFilter, type MultiSelectOption } from '@/components/multi-select-filter';
import { Textarea } from '@/components/ui/textarea';
import { InMemoryDataBanner } from '@/generated/components/in-memory-data-banner';
import { HAS_IN_MEMORY_TABLES } from '@/generated/hooks';
import { useCompanyList } from '@/generated/hooks/use-company';
import { useCreateInteraction, useDeleteInteraction, useInteractionList, useUpdateInteraction } from '@/generated/hooks/use-interaction';
import { useCareerData } from '@/hooks/use-career-data';
import { useSessionState } from '@/hooks/use-session-state';
import { formatDisplayDate } from '@/lib/display-date';
import { cn } from '@/lib/utils';
import { dateKeyToLocalDate, toDateKey } from '@/lib/follow-up-utils';
import { InteractionInteractionTypeKeyToLabel, type Interaction, type InteractionInteractionTypeKey } from '@/generated/models/interaction-model';
import type { JobApplication } from '@/generated/models/job-application-model';
import type { NetworkingContact } from '@/generated/models/networking-contact-model';

const pageSizeOptions = [5, 10, 20, 50] as const;
type PageSize = typeof pageSizeOptions[number];

type InteractionFormValue = {
  contactId: string;
  contactSearch: string;
  interactionDate: Date;
  interactionTypeKey: InteractionInteractionTypeKey;
  relatedApplicationId: string;
  applicationSearch: string;
  notes: string;
};

const createDefaultInteraction = (): InteractionFormValue => ({
  contactId: '',
  contactSearch: '',
  interactionDate: new Date(),
  interactionTypeKey: 'NetworkingChat',
  relatedApplicationId: '',
  applicationSearch: '',
  notes: '',
});

const toDateValue = (value: string) => dateKeyToLocalDate(value) ?? new Date();
// `cws_contact` is not required in Dataverse, so an interaction created by the
// canvas app, a flow, or an agent can arrive with the lookup empty even though
// the generated model types it as required. Read it defensively.
const unknownContactLabel = 'Unknown contact';
const getInteractionTitle = (contactName: string, typeKey: InteractionInteractionTypeKey, date: Date) => `${InteractionInteractionTypeKeyToLabel[typeKey]} with ${contactName} on ${formatDisplayDate(date)}`;
const getContactDisplay = (contact: NetworkingContact): string => {
  const role = contact.role?.trim();
  const companyName = contact.company?.companyName?.trim();
  const detail = [role, companyName].filter((value: string | undefined): value is string => Boolean(value)).join(', ');
  return detail ? `${contact.contactName} - ${detail}` : contact.contactName;
};
const getApplicationDisplay = (application: JobApplication): string => {
  const jobId = application.jobID?.trim();
  const companyName = application.company?.companyName?.trim();
  const role = jobId ? `${application.role} (${jobId})` : application.role;
  return companyName ? `${role} - ${companyName}` : role;
};

export default function InteractionsPage() {
  const { contacts, applications } = useCareerData();
  const { data: companyData } = useCompanyList();
  const { data: interactionData, isLoading } = useInteractionList();
  const createInteraction = useCreateInteraction();
  const updateInteraction = useUpdateInteraction();
  const deleteInteraction = useDeleteInteraction();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<InteractionFormValue>(() => createDefaultInteraction());
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [editForm, setEditForm] = useState<InteractionFormValue | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Interaction | null>(null);
  const [search, setSearch] = useSessionState('career-hub.interactions.search', '');
  const [companyFilter, setCompanyFilter] = useSessionState<string[]>('career-hub.interactions.company', ['all']);
  const [contactFilter, setContactFilter] = useSessionState<string[]>('career-hub.interactions.contact', ['all']);
  const [pageSize, setPageSize] = useSessionState<PageSize>('career-hub.interactions.page-size', 10);
  const [page, setPage] = useSessionState('career-hub.interactions.page', 1);

  const companies = companyData ?? [];
  const interactions = interactionData ?? [];
  const contactOptions: RefinedSearchOption[] = contacts.filter((contact: NetworkingContact) => Boolean(contact.id && contact.contactName)).map((contact: NetworkingContact) => ({ id: contact.id, label: contact.contactName, description: [contact.role, contact.company?.companyName].filter(Boolean).join(' - ') }));
  const companyFilterOptions: MultiSelectOption[] = companies.filter((company: typeof companies[number]) => Boolean(company.id && company.companyName)).map((company: typeof companies[number]) => ({ value: company.id, label: company.companyName }));
  const contactFilterOptions: MultiSelectOption[] = contacts.filter((contact: NetworkingContact) => Boolean(contact.id && contact.contactName)).map((contact: NetworkingContact) => ({ value: contact.id, label: contact.contactName }));
  const applicationOptions: RefinedSearchOption[] = applications.filter((application: JobApplication) => Boolean(application.id && application.role)).map((application: JobApplication) => ({ id: application.id, label: application.role, description: `${application.company?.companyName ?? 'Company'} - ${application.jobID ?? 'No job ID'}` }));

  const getContact = (contactId: string) => contacts.find((contact: NetworkingContact) => contact.id === contactId);
  const getApplication = (applicationId: string) => applications.find((application: JobApplication) => application.id === applicationId);
  const getInteractionContact = (interaction: Interaction): NetworkingContact | undefined => interaction.contact?.id ? getContact(interaction.contact.id) : undefined;
  const getInteractionApplication = (interaction: Interaction): JobApplication | undefined => interaction.relatedApplication ? getApplication(interaction.relatedApplication?.id) : undefined;

  const filteredInteractions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return interactions.filter((interaction: Interaction) => {
      const contact = getInteractionContact(interaction);
      const application = getInteractionApplication(interaction);
      const contactName = contact?.contactName ?? interaction.contact?.contactName ?? unknownContactLabel;
      const applicationRole = application?.role ?? interaction.relatedApplication?.role;
      const companyName = contact?.company?.companyName ?? application?.company?.companyName ?? '';
      const searchText = [interaction.interactionName, contactName, applicationRole, companyName, interaction.notes, InteractionInteractionTypeKeyToLabel[interaction.interactionTypeKey]].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      const matchesCompany = companyFilter.includes('all') || companyFilter.includes(contact?.company?.id ?? '') || companyFilter.includes(application?.company?.id ?? '');
      const matchesContact = contactFilter.includes('all') || contactFilter.includes(interaction.contact?.id ?? '');
      return matchesSearch && matchesCompany && matchesContact;
    }).sort((first: Interaction, second: Interaction) => second.interactionDate.localeCompare(first.interactionDate));
  }, [interactions, search, companyFilter, contactFilter, contacts, applications]);

  const totalPages = Math.max(1, Math.ceil(filteredInteractions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedInteractions = filteredInteractions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateForm = (field: keyof InteractionFormValue, value: InteractionFormValue[keyof InteractionFormValue]) => setForm((current: InteractionFormValue) => ({ ...current, [field]: value }));
  const updateEditForm = (field: keyof InteractionFormValue, value: InteractionFormValue[keyof InteractionFormValue]) => setEditForm((current: InteractionFormValue | null) => current ? { ...current, [field]: value } : current);
  const resetFilters = () => { setSearch(''); setCompanyFilter(['all']); setContactFilter(['all']); setPage(1); };

  const toFormValue = (interaction: Interaction): InteractionFormValue => {
    const contact = getInteractionContact(interaction);
    const application = interaction.relatedApplication ? getApplication(interaction.relatedApplication?.id) : undefined;
    return {
      contactId: interaction.contact?.id ?? '',
      contactSearch: contact?.contactName ?? interaction.contact?.contactName ?? '',
      interactionDate: toDateValue(interaction.interactionDate),
      interactionTypeKey: interaction.interactionTypeKey,
      relatedApplicationId: interaction.relatedApplication?.id ?? '',
      applicationSearch: application?.role ?? interaction.relatedApplication?.role ?? '',
      notes: interaction.notes ?? '',
    };
  };

  const startEdit = (interaction: Interaction) => { setEditingInteraction(interaction); setEditForm(toFormValue(interaction)); };

  const buildInteractionPayload = (value: InteractionFormValue) => {
    const selectedContact = getContact(value.contactId);
    const selectedApplication = value.relatedApplicationId ? getApplication(value.relatedApplicationId) : undefined;
    if (!selectedContact) return null;
    return {
      interactionName: getInteractionTitle(selectedContact.contactName, value.interactionTypeKey, value.interactionDate),
      contact: { id: selectedContact.id, contactName: selectedContact.contactName },
      interactionDate: toDateKey(value.interactionDate),
      interactionTypeKey: value.interactionTypeKey,
      relatedApplication: selectedApplication ? { id: selectedApplication.id, role: selectedApplication.role } : undefined,
      notes: value.notes.trim() || undefined,
    };
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildInteractionPayload(form);
    if (!payload) { toast.error('Contact is required'); return; }
    createInteraction.mutate(payload, { onSuccess: () => { toast.success('Interaction logged'); setForm(createDefaultInteraction()); setCreateOpen(false); }, onError: () => toast.error('Could not log interaction') });
  };

  const handleUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingInteraction || !editForm) return;
    const payload = buildInteractionPayload(editForm);
    if (!payload) { toast.error('Contact is required'); return; }
    updateInteraction.mutate({ id: editingInteraction.id, changedFields: payload }, { onSuccess: () => { toast.success('Interaction updated'); setEditingInteraction(null); setEditForm(null); }, onError: () => toast.error('Could not update interaction') });
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    deleteInteraction.mutate(deleteCandidate.id, { onSuccess: () => { toast.success('Interaction deleted'); if (editingInteraction?.id === deleteCandidate.id) { setEditingInteraction(null); setEditForm(null); } setDeleteCandidate(null); }, onError: () => toast.error('Could not delete interaction') });
  };

  const renderInteractionForm = (value: InteractionFormValue, onChange: (field: keyof InteractionFormValue, value: InteractionFormValue[keyof InteractionFormValue]) => void, onSubmit: (event: React.FormEvent<HTMLFormElement>) => void, pending: boolean, submitLabel: string, onCancel: () => void, interaction?: Interaction) => {
    const selectedContact = value.contactId ? getContact(value.contactId) : undefined;
    const selectedApplication = value.relatedApplicationId ? getApplication(value.relatedApplicationId) : undefined;
    const filteredContactOptions = contactOptions.filter((option: RefinedSearchOption) => {
      if (!selectedApplication?.company?.id) return true;
      const contact = getContact(option.id);
      return contact?.company?.id === selectedApplication.company?.id;
    });
    const filteredApplicationOptions = applicationOptions.filter((option: RefinedSearchOption) => {
      if (!selectedContact?.company?.id) return true;
      const application = getApplication(option.id);
      return application?.company?.id === selectedContact.company?.id;
    });
    return (
      <form className="grid gap-5" onSubmit={onSubmit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2.5">
            <Label>Interaction date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className={cn('h-11 w-full justify-start bg-white text-left font-normal text-foreground dark:bg-card dark:text-card-foreground', !value.interactionDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{formatDisplayDate(value.interactionDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={value.interactionDate} onSelect={(date: Date | undefined) => { if (date) onChange('interactionDate', date); }} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2.5">
            <Label>Type</Label>
            <Select value={value.interactionTypeKey} onValueChange={(nextValue: string) => onChange('interactionTypeKey', nextValue as InteractionInteractionTypeKey)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(InteractionInteractionTypeKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="space-y-2.5">
            <Label>Contact <span className="text-destructive">*</span></Label>
            {interaction ? (
              <div className="flex h-11 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">{value.contactSearch || 'No contact selected'}</div>
            ) : (
              <RefinedSearchBox id="interaction-contact" value={value.contactId ? (() => { const contact = contacts.find((candidate: NetworkingContact) => candidate.id === value.contactId); return contact ? getContactDisplay(contact) : value.contactSearch; })() : value.contactSearch} options={filteredContactOptions} placeholder={selectedApplication?.company?.companyName ? `Search contacts at ${selectedApplication.company?.companyName}` : 'Search contacts'} emptyLabel="No contacts found" createLabel="Use contact" onChange={(nextValue: string, selectedId?: string) => { onChange('contactSearch', nextValue); if (selectedId) { onChange('contactId', selectedId); const nextContact = getContact(selectedId); if (nextContact?.company?.id && selectedApplication?.company?.id && nextContact.company?.id !== selectedApplication.company?.id) { onChange('applicationSearch', ''); onChange('relatedApplicationId', ''); } } else if (!nextValue.trim()) { onChange('contactId', ''); } }} onClear={() => { onChange('contactSearch', ''); onChange('contactId', ''); }} />
            )}
          </div>
          <div className="space-y-2.5">
            <Label>Related application</Label>
            {interaction ? (
              <div className="flex h-11 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">{value.applicationSearch || 'No related application'}</div>
            ) : (
              <RefinedSearchBox id="interaction-application" value={value.relatedApplicationId ? (() => { const application = applications.find((candidate: JobApplication) => candidate.id === value.relatedApplicationId); return application ? getApplicationDisplay(application) : value.applicationSearch; })() : value.applicationSearch} options={filteredApplicationOptions} placeholder={selectedContact?.company?.companyName ? `Search applications at ${selectedContact.company?.companyName}` : 'Search applications'} emptyLabel="No applications found" createLabel="Use application" onChange={(nextValue: string, selectedId?: string) => { onChange('applicationSearch', nextValue); if (selectedId) { onChange('relatedApplicationId', selectedId); const nextApplication = getApplication(selectedId); if (nextApplication?.company?.id && selectedContact?.company?.id && nextApplication.company?.id !== selectedContact.company?.id) { onChange('contactSearch', ''); onChange('contactId', ''); } } else if (!nextValue.trim()) { onChange('relatedApplicationId', ''); } }} onClear={() => { onChange('applicationSearch', ''); onChange('relatedApplicationId', ''); }} />
            )}
          </div>
        </div>
        <div className="space-y-2.5"><Label>Notes</Label><Textarea value={value.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange('notes', event.target.value)} placeholder="Summary, commitments, useful context, next steps" /></div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          {interaction ? <Button type="button" variant="ghost" size="icon-sm" className="group ml-auto text-destructive hover:bg-background hover:text-destructive" onClick={() => setDeleteCandidate(interaction)} aria-label={`Delete ${interaction.interactionName}`}><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button> : null}
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <InMemoryDataBanner show={HAS_IN_MEMORY_TABLES} message="This app uses draft tables for testing. Data entered won't be saved. Contact the app owner to enable storage." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Interactions</h1><p className="text-muted-foreground">Review and log contact touchpoints across companies and applications.</p></div>
        <Dialog open={createOpen} onOpenChange={(open: boolean) => { setCreateOpen(open); if (open) setForm(createDefaultInteraction()); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Interaction</Button></DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-visible p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>Create interaction</DialogTitle><DialogDescription>Add a touchpoint with a required contact and optional related application.</DialogDescription></DialogHeader>{renderInteractionForm(form, updateForm, handleCreate, createInteraction.isPending, 'Save interaction', () => setCreateOpen(false))}</DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle><CardDescription>Narrow interactions by search, company, or contact.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,13rem)_minmax(10rem,13rem)_auto] lg:items-center">
          <div className="relative flex h-9 min-w-0 items-center rounded-md border bg-card text-card-foreground shadow-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setSearch(event.target.value); setPage(1); }} placeholder="Search interactions" className="h-full border-0 bg-card pl-9 shadow-none focus-visible:ring-1" /></div>
          <MultiSelectFilter label="Company" options={companyFilterOptions} selected={companyFilter} allValue="all" onSelectedChange={(selected: string[]) => { setCompanyFilter(selected); setPage(1); }} className="w-full lg:w-52" />
          <MultiSelectFilter label="Contact" options={contactFilterOptions} selected={contactFilter} allValue="all" onSelectedChange={(selected: string[]) => { setContactFilter(selected); setPage(1); }} className="w-full lg:w-52" />
          <Button className="h-9 w-full lg:w-auto lg:shrink-0" variant="outline" onClick={resetFilters}>Clear</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Interaction history</CardTitle><CardDescription>{isLoading ? 'Loading interactions…' : `${filteredInteractions.length} interaction${filteredInteractions.length === 1 ? '' : 's'} match the current filters`}</CardDescription></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"><Select value={String(pageSize)} onValueChange={(value: string) => { setPageSize(Number(value) as PageSize); setPage(1); }}><SelectTrigger size="sm" className="w-full py-0 sm:w-[110px]"><SelectValue aria-label="Rows per page" /></SelectTrigger><SelectContent>{pageSizeOptions.map((option: PageSize) => <SelectItem key={option} value={String(option)}>{option} rows</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:justify-end"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div></div>
        </CardHeader>
        <CardContent><div className="grid gap-2">{isLoading ? <Card><CardContent className="p-6 text-muted-foreground">Loading interactions…</CardContent></Card> : null}{!isLoading && filteredInteractions.length === 0 ? <Empty className="rounded-xl border bg-card py-12 text-card-foreground"><EmptyHeader><EmptyMedia variant="icon"><MessageSquarePlus className="h-6 w-6" /></EmptyMedia><EmptyTitle>No interactions match your filters</EmptyTitle><EmptyDescription>Clear filters or log a new contact touchpoint.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Interaction</Button></EmptyContent></Empty> : null}{paginatedInteractions.map((interaction: Interaction) => { const contact = getInteractionContact(interaction); const application = getInteractionApplication(interaction); const contactName = contact?.contactName ?? interaction.contact?.contactName ?? unknownContactLabel; const applicationRole = application?.role ?? interaction.relatedApplication?.role; return <Card key={interaction.id} onClick={() => startEdit(interaction)} className="cursor-pointer border-l-4 border-l-muted bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-l-muted hover:shadow-md"><CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 py-1.5"><div className="min-w-0"><h3 className="truncate text-sm font-semibold leading-5 text-card-foreground">{interaction.interactionName}</h3><p className="mt-0.5 truncate text-xs text-muted-foreground">{formatDisplayDate(interaction.interactionDate)} • {InteractionInteractionTypeKeyToLabel[interaction.interactionTypeKey]} • {contactName}</p>{applicationRole ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{applicationRole}</p> : null}{interaction.notes ? <p className="mt-0.5 line-clamp-1 text-xs text-foreground">{interaction.notes}</p> : null}</div><Button type="button" variant="outline" size="icon-sm" className="self-center" aria-label={`Delete ${interaction.interactionName}`} onClick={(event: React.MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); setDeleteCandidate(interaction); }}><Trash2 className="h-4 w-4" /></Button></CardContent></Card>; })}</div></CardContent>
        {paginatedInteractions.length > 0 ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 sm:flex sm:justify-center"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div> : null}
      </Card>

      <Dialog open={Boolean(editingInteraction && editForm)} onOpenChange={(open: boolean) => { if (!open) { setEditingInteraction(null); setEditForm(null); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-visible p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>Edit interaction</DialogTitle><DialogDescription>Update the touchpoint details or delete it.</DialogDescription></DialogHeader>{editingInteraction && editForm ? renderInteractionForm(editForm, updateEditForm, handleUpdate, updateInteraction.isPending, 'Save interaction', () => { setEditingInteraction(null); setEditForm(null); }, editingInteraction) : null}</DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open: boolean) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete interaction?</AlertDialogTitle><AlertDialogDescription>This permanently removes {deleteCandidate?.interactionName ?? 'this interaction'} from the interaction history.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={confirmDelete} disabled={deleteInteraction.isPending}>{deleteInteraction.isPending ? 'Deleting…' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

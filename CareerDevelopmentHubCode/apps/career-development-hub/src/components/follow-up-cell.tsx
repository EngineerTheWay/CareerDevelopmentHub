import { useMemo, useState } from 'react';
import { CalendarIcon, Check, CircleAlert, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import { FollowUpForm, createDefaultFollowUp, type FollowUpFormValue } from '@/components/follow-up-form';
import { Separator } from '@/components/ui/separator';
import { useCreateFollowUp, useDeleteFollowUp, useUpdateFollowUp } from '@/generated/hooks/use-follow-up';
import { useCreateInteraction, useDeleteInteraction } from '@/generated/hooks/use-interaction';
import { InteractionInteractionTypeKeyToLabel, type InteractionInteractionTypeKey } from '@/generated/models/interaction-model';
import type { FollowUp } from '@/generated/models/follow-up-model';
import type { JobApplication } from '@/generated/models/job-application-model';
import type { NetworkingContact } from '@/generated/models/networking-contact-model';
import { useCareerData } from '@/hooks/use-career-data';
import { cn } from '@/lib/utils';
import { dateKeyToLocalDate, todayDateKey, toDateKey } from '@/lib/follow-up-utils';
import { formatDisplayDate } from '@/lib/display-date';

const getApplicationCompanyName = (application: JobApplication): string => application.company?.companyName ?? 'Unknown company';
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

type FollowUpCellProps = {
  followUps: FollowUp[];
  item: NetworkingContact | JobApplication;
  type: 'Contact' | 'Application';
  label: string;
};

type CompleteInteractionForm = {
  followUp: FollowUp;
  contactSearch: string;
  applicationSearch: string;
  contactId: string;
  applicationId: string;
  interactionDate: string;
  interactionTypeKey: InteractionInteractionTypeKey;
  notes: string;
};

const getStatusLabel = (followUp: FollowUp) => followUp.statusKey === 'Open' ? 'Open' : 'Completed';
const today = todayDateKey;
const getDefaultTitle = (item: NetworkingContact | JobApplication, type: 'Contact' | 'Application', label: string) => {
  if (type === 'Application') {
    const application = item as JobApplication;
    return `Follow up on ${application.role} at ${getApplicationCompanyName(application)}`;
  }

  return `Follow up on ${label}`;
};
const toFormValue = (followUp: FollowUp): FollowUpFormValue => {
  const { id: _id, ...value } = followUp;
  void _id;
  return value;
};

export function FollowUpCell({ followUps, item, type, label }: FollowUpCellProps) {
  const { contacts, applications } = useCareerData();
  const createFollowUp = useCreateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();
  const updateFollowUp = useUpdateFollowUp();
  const createInteraction = useCreateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const [createOpen, setCreateOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<FollowUp | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [editForm, setEditForm] = useState<FollowUpFormValue | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [completeInteractionForm, setCompleteInteractionForm] = useState<CompleteInteractionForm | null>(null);
  const [form, setForm] = useState<FollowUpFormValue>(() => createDefaultFollowUp({
    title: getDefaultTitle(item, type, label),
    relatedTypeKey: type === 'Contact' ? 'Contact' : 'Application',
    relatedContact: type === 'Contact' ? { id: item.id, contactName: label } : undefined,
    relatedApplication: type === 'Application' ? { id: item.id, role: label } : undefined,
  }));
  const relatedFollowUps = followUps.filter((followUp: FollowUp) =>
    followUp.statusKey !== 'Completed' && (type === 'Contact'
      ? followUp.relatedTypeKey === 'Contact' && followUp.relatedContact?.id === item.id
      : followUp.relatedTypeKey === 'Application' && followUp.relatedApplication?.id === item.id),
  );
  const hasOverdue = relatedFollowUps.some((followUp: FollowUp) => followUp.dueDate < today());
  const selectedCompleteContact = completeInteractionForm?.contactId ? contacts.find((contact: NetworkingContact) => contact.id === completeInteractionForm.contactId) : undefined;
  const selectedCompleteApplication = completeInteractionForm?.applicationId ? applications.find((application: JobApplication) => application.id === completeInteractionForm.applicationId) : undefined;
  const contactOptions: RefinedSearchOption[] = useMemo(() => {
    const selectedApplicationCompanyId = selectedCompleteApplication?.company?.id;
    return contacts
      .filter((contact: NetworkingContact) => Boolean(contact.id && contact.contactName))
      .filter((contact: NetworkingContact) => !selectedApplicationCompanyId || contact.company?.id === selectedApplicationCompanyId)
      .map((contact: NetworkingContact) => ({ id: contact.id, label: contact.contactName, description: [contact.role, contact.company?.companyName].filter(Boolean).join(' - ') }));
  }, [contacts, selectedCompleteApplication?.company?.id]);
  const applicationOptions: RefinedSearchOption[] = useMemo(() => {
    const selectedContactCompanyId = selectedCompleteContact?.company?.id;
    return applications
      .filter((application: JobApplication) => Boolean(application.id && application.role))
      .filter((application: JobApplication) => !selectedContactCompanyId || application.company?.id === selectedContactCompanyId)
      .map((application: JobApplication) => ({ id: application.id, label: application.role, description: `${application.company?.companyName ?? 'Company'} - ${application.jobID ?? 'No job ID'}` }));
  }, [applications, selectedCompleteContact?.company?.id]);

  const updateForm = (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => setForm((current: FollowUpFormValue) => ({ ...current, [field]: value }));
  const updateEditForm = (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => setEditForm((current: FollowUpFormValue | null) => current ? { ...current, [field]: value } : current);
  const resetForm = () => setForm(createDefaultFollowUp({
    title: getDefaultTitle(item, type, label),
    relatedTypeKey: type === 'Contact' ? 'Contact' : 'Application',
    relatedContact: type === 'Contact' ? { id: item.id, contactName: label } : undefined,
    relatedApplication: type === 'Application' ? { id: item.id, role: label } : undefined,
  }));
  const startEdit = (followUp: FollowUp) => { setEditingId(followUp.id); setEditForm(toFormValue(followUp)); };
  const cancelEdit = () => { setEditingId(undefined); setEditForm(null); };
  const buildCompleteInteractionForm = (followUp: FollowUp): CompleteInteractionForm => {
    const relatedContact = followUp.relatedTypeKey === 'Contact' ? contacts.find((contact: NetworkingContact) => contact.id === followUp.relatedContact?.id) : undefined;
    const relatedApplication = followUp.relatedTypeKey === 'Application' ? applications.find((application: JobApplication) => application.id === followUp.relatedApplication?.id) : undefined;
    const applicationContact = relatedApplication ? contacts.find((contact: NetworkingContact) => contact.company?.id && contact.company?.id === relatedApplication.company?.id) : undefined;
    const defaultContact = relatedContact ?? applicationContact;
    const dueDate = dateKeyToLocalDate(followUp.dueDate);
    const todayDate = dateKeyToLocalDate(today()) ?? new Date();
    const defaultInteractionDate = dueDate && dueDate <= todayDate ? toDateKey(dueDate) : today();
    return { followUp, contactId: defaultContact?.id ?? '', contactSearch: defaultContact?.contactName ?? '', applicationId: relatedApplication?.id ?? '', applicationSearch: relatedApplication?.role ?? '', interactionDate: defaultInteractionDate, interactionTypeKey: 'NetworkingChat', notes: followUp.notes ?? '' };
  };
  const updateCompleteInteractionForm = (field: keyof CompleteInteractionForm, value: CompleteInteractionForm[keyof CompleteInteractionForm]) => setCompleteInteractionForm((current: CompleteInteractionForm | null) => current ? { ...current, [field]: value } : current);
  const handleCreateFollowUp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.dueDate) { toast.error('Title and due date are required'); return; }
    createFollowUp.mutate(form, { onSuccess: () => { toast.success('Follow-up added'); resetForm(); setCreateOpen(false); }, onError: () => toast.error('Could not add follow-up') });
  };
  const handleAddFromList = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.dueDate) { toast.error('Title and due date are required'); return; }
    createFollowUp.mutate(form, { onSuccess: () => { toast.success('Follow-up added'); resetForm(); setShowAddForm(false); }, onError: () => toast.error('Could not add follow-up') });
  };
  const saveEditFollowUp = (options?: { closeOnSuccess?: boolean; successMessage?: string; afterSave?: (savedFollowUp: FollowUp) => void }) => {
    if (!editingId || !editForm) return;
    if (!editForm.title.trim() || !editForm.dueDate) { toast.error('Title and due date are required'); return; }
    const changedFields = { ...editForm };
    updateFollowUp.mutate({ id: editingId, changedFields }, {
      onSuccess: () => {
        const savedFollowUp: FollowUp = { ...changedFields, id: editingId };
        toast.success(options?.successMessage ?? 'Follow-up updated');
        if (options?.closeOnSuccess ?? true) cancelEdit();
        options?.afterSave?.(savedFollowUp);
      },
      onError: () => toast.error('Could not update follow-up'),
    });
  };
  const handleEditFollowUp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveEditFollowUp();
  };
  const handleMarkCompleteEditingFollowUp = () => saveEditFollowUp({
    successMessage: 'Follow-up saved',
    afterSave: (savedFollowUp: FollowUp) => setCompleteInteractionForm(buildCompleteInteractionForm(savedFollowUp)),
  });
  const requestDelete = (followUp: FollowUp) => setDeleteCandidate(followUp);
  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const itemTitle = deleteCandidate.title;
    deleteFollowUp.mutate(deleteCandidate.id, { onSuccess: () => { toast.success(`Deleted ${itemTitle}`); setDeleteCandidate(null); if (editingId === deleteCandidate.id) cancelEdit(); }, onError: () => toast.error('Could not delete follow-up') });
  };
  const reopenFollowUp = (followUp: FollowUp, successMessage = 'Follow-up reopened') => updateFollowUp.mutate({ id: followUp.id, changedFields: { statusKey: 'Open', completedDate: '' } }, { onSuccess: () => toast.success(successMessage), onError: () => toast.error('Could not reopen follow-up') });
  const markCompleteOnly = (followUp: FollowUp) => updateFollowUp.mutate({ id: followUp.id, changedFields: { statusKey: 'Completed', completedDate: today() } }, { onSuccess: () => toast.success('Follow-up marked complete', { duration: 10000, action: { label: 'Undo', onClick: () => reopenFollowUp(followUp) } }), onError: () => toast.error('Could not complete follow-up') });
  const markComplete = (followUp: FollowUp) => setCompleteInteractionForm(buildCompleteInteractionForm(followUp));
  const completeWithInteraction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completeInteractionForm) return;
    const selectedContact = contacts.find((contact: NetworkingContact) => contact.id === completeInteractionForm.contactId);
    const selectedApplication = completeInteractionForm.applicationId ? applications.find((application: JobApplication) => application.id === completeInteractionForm.applicationId) : undefined;
    if (!selectedContact) { toast.error('Select a contact to create an interaction'); return; }
    const activeForm = completeInteractionForm;
    createInteraction.mutate({ interactionName: `${InteractionInteractionTypeKeyToLabel[activeForm.interactionTypeKey]} with ${selectedContact.contactName} on ${formatDisplayDate(activeForm.interactionDate)}`, contact: { id: selectedContact.id, contactName: selectedContact.contactName }, interactionDate: activeForm.interactionDate, interactionTypeKey: activeForm.interactionTypeKey, relatedApplication: selectedApplication ? { id: selectedApplication.id, role: selectedApplication.role } : undefined, notes: activeForm.notes.trim() || undefined }, {
      onSuccess: (createdInteraction) => {
        updateFollowUp.mutate({ id: activeForm.followUp.id, changedFields: { statusKey: 'Completed', completedDate: today() } }, {
          onSuccess: () => { toast.success('Follow-up completed and interaction logged', { duration: 10000, action: { label: 'Undo', onClick: () => { deleteInteraction.mutate(createdInteraction.id, { onSuccess: () => reopenFollowUp(activeForm.followUp, 'Interaction removed and follow-up reopened'), onError: () => toast.error('Could not delete the new interaction') }); } } }); setCompleteInteractionForm(null); },
          onError: () => toast.error('Interaction saved, but follow-up could not be completed'),
        });
      },
      onError: () => toast.error('Could not create interaction'),
    });
  };

  return (
    <div className="flex items-center">
      {relatedFollowUps.length > 0 ? (
        <Dialog open={listOpen} onOpenChange={setListOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className={`h-7 w-7 rounded-full border-2 p-0 transition hover:ring-2 hover:ring-offset-2 hover:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${hasOverdue ? 'border-accent bg-accent text-accent-foreground hover:ring-accent focus-visible:ring-accent' : 'border-primary bg-primary text-primary-foreground hover:ring-primary focus-visible:ring-primary'}`} aria-label={hasOverdue ? `${relatedFollowUps.length} overdue follow-ups` : `${relatedFollowUps.length} active follow-ups`} title={`${relatedFollowUps.length} active follow-up${relatedFollowUps.length === 1 ? '' : 's'}`}>
              <span className="text-xs font-semibold leading-none tabular-nums">{relatedFollowUps.length}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>Active follow-ups for {label}</DialogTitle><DialogDescription>Click a follow-up to edit it or add another one for this {type.toLowerCase()}.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              {relatedFollowUps.map((followUp: FollowUp) => (
                <div key={followUp.id} className={`rounded-lg border bg-card p-3 text-card-foreground transition hover:-translate-y-0.5 hover:shadow-md ${followUp.dueDate < today() ? 'border-l-4 border-l-accent' : ''}`}>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => startEdit(followUp)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div>
                        <p className="font-medium">{followUp.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={followUp.statusKey === 'Open' ? 'default' : 'secondary'}>{getStatusLabel(followUp)}</Badge>
                          <p className={followUp.dueDate < today() ? 'inline-flex items-center rounded-md border border-destructive px-2 py-1 text-sm font-medium text-foreground' : 'text-sm text-muted-foreground'}>{followUp.dueDate < today() ? <CircleAlert className="mr-1.5 h-3.5 w-3.5 text-destructive" aria-hidden="true" /> : null}Due {formatDisplayDate(followUp.dueDate)}</p>
                        </div>
                      </div>
                    </button>
                    <Button type="button" variant="outline" size="icon-sm" className="shrink-0" onClick={() => markComplete(followUp)} disabled={updateFollowUp.isPending} aria-label={`Mark ${followUp.title} complete`}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                  {followUp.notes ? <><Separator className="my-3" /><button type="button" onClick={() => startEdit(followUp)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-sm text-muted-foreground">{followUp.notes}</p></button></> : null}
                </div>
              ))}
              {showAddForm ? <div className="rounded-lg border bg-card p-3 text-card-foreground"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-medium">Add another follow-up</h3><Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</Button></div><FollowUpForm value={form} onChange={updateForm} onSubmit={handleAddFromList} pending={createFollowUp.isPending} submitLabel="Add follow-up" lockRelationship /></div> : <Button type="button" onClick={() => { resetForm(); setShowAddForm(true); }}><Plus className="mr-1.5 h-4 w-4" />Add another follow-up</Button>}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={createOpen} onOpenChange={(open: boolean) => { setCreateOpen(open); if (open) resetForm(); }}>
          <DialogTrigger asChild><Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-full border-2 border-secondary bg-secondary text-secondary-foreground" disabled={createFollowUp.isPending}><Plus className="h-3.5 w-3.5" /></Button></DialogTrigger>
          <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Create a follow-up</DialogTitle><DialogDescription>Add an active follow-up associated with {label}.</DialogDescription></DialogHeader><FollowUpForm value={form} onChange={updateForm} onSubmit={handleCreateFollowUp} pending={createFollowUp.isPending} submitLabel="Create follow-up" lockRelationship /></DialogContent>
        </Dialog>
      )}
      <Dialog open={completeInteractionForm !== null} onOpenChange={(open: boolean) => { if (!open) setCompleteInteractionForm(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-visible p-6 sm:max-w-2xl">
          <DialogHeader><DialogTitle>Complete follow-up</DialogTitle><DialogDescription>Complete this follow-up only, or log the completed touchpoint as an interaction.</DialogDescription></DialogHeader>
          {completeInteractionForm ? <form className="space-y-4" onSubmit={completeWithInteraction}>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Date</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className={cn('h-11 w-full justify-start bg-white text-left font-normal text-foreground dark:bg-card dark:text-card-foreground', !completeInteractionForm.interactionDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{completeInteractionForm.interactionDate ? formatDisplayDate(completeInteractionForm.interactionDate) : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateKeyToLocalDate(completeInteractionForm.interactionDate)} onSelect={(date: Date | undefined) => updateCompleteInteractionForm('interactionDate', date ? toDateKey(date) : '')} initialFocus /></PopoverContent></Popover></div><div className="space-y-2"><Label htmlFor="complete-interaction-type">Type</Label><Select value={completeInteractionForm.interactionTypeKey} onValueChange={(value: string) => updateCompleteInteractionForm('interactionTypeKey', value as InteractionInteractionTypeKey)}><SelectTrigger id="complete-interaction-type" className="h-11"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(InteractionInteractionTypeKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, typeLabel]: [string, string]) => <SelectItem key={key} value={key}>{typeLabel}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="grid gap-4">
              <div className="space-y-2"><Label htmlFor="complete-contact-search">Contact <span className="text-destructive" aria-hidden="true">*</span></Label><RefinedSearchBox id="complete-contact-search" value={completeInteractionForm.contactId ? (() => { const contact = contacts.find((candidate: NetworkingContact) => candidate.id === completeInteractionForm.contactId); return contact ? getContactDisplay(contact) : completeInteractionForm.contactSearch; })() : completeInteractionForm.contactSearch} options={contactOptions} placeholder={selectedCompleteApplication?.company?.companyName ? `Search contacts at ${selectedCompleteApplication.company?.companyName}` : 'Search contacts'} emptyLabel="No contacts found" createLabel="Create contact" disabled={completeInteractionForm.followUp.relatedTypeKey === 'Contact'} onChange={(nextValue: string, selectedId?: string) => { updateCompleteInteractionForm('contactSearch', nextValue); if (selectedId) { updateCompleteInteractionForm('contactId', selectedId); const selectedContact = contacts.find((contact: NetworkingContact) => contact.id === selectedId); const selectedApplication = applications.find((application: JobApplication) => application.id === completeInteractionForm.applicationId); if (selectedContact?.company?.id && selectedApplication?.company?.id && selectedContact.company?.id !== selectedApplication.company?.id) { updateCompleteInteractionForm('applicationSearch', ''); updateCompleteInteractionForm('applicationId', ''); } } else if (!nextValue.trim()) updateCompleteInteractionForm('contactId', ''); }} onClear={() => { updateCompleteInteractionForm('contactSearch', ''); updateCompleteInteractionForm('contactId', ''); }} /></div>
              <div className="space-y-2"><Label htmlFor="complete-application-search">Related application</Label><RefinedSearchBox id="complete-application-search" value={completeInteractionForm.applicationId ? (() => { const application = applications.find((candidate: JobApplication) => candidate.id === completeInteractionForm.applicationId); return application ? getApplicationDisplay(application) : completeInteractionForm.applicationSearch; })() : completeInteractionForm.applicationSearch} options={applicationOptions} placeholder={selectedCompleteContact?.company?.companyName ? `Search applications at ${selectedCompleteContact.company?.companyName}` : 'Search applications'} emptyLabel="No applications found" createLabel="Create application" disabled={completeInteractionForm.followUp.relatedTypeKey === 'Application'} onChange={(nextValue: string, selectedId?: string) => { updateCompleteInteractionForm('applicationSearch', nextValue); if (selectedId) { updateCompleteInteractionForm('applicationId', selectedId); const selectedApplication = applications.find((application: JobApplication) => application.id === selectedId); const selectedContact = contacts.find((contact: NetworkingContact) => contact.id === completeInteractionForm.contactId); if (selectedApplication?.company?.id && selectedContact?.company?.id && selectedApplication.company?.id !== selectedContact.company?.id) { updateCompleteInteractionForm('contactSearch', ''); updateCompleteInteractionForm('contactId', ''); } } else if (!nextValue.trim()) updateCompleteInteractionForm('applicationId', ''); }} onClear={() => { updateCompleteInteractionForm('applicationSearch', ''); updateCompleteInteractionForm('applicationId', ''); }} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="complete-interaction-notes">Notes</Label><Textarea id="complete-interaction-notes" value={completeInteractionForm.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateCompleteInteractionForm('notes', event.target.value)} placeholder="Notes from the conversation" /></div>
            <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={createInteraction.isPending || updateFollowUp.isPending}>Complete + log interaction</Button><Button type="button" variant="outline" onClick={() => { markCompleteOnly(completeInteractionForm.followUp); setCompleteInteractionForm(null); }} disabled={updateFollowUp.isPending}>Complete only</Button><Button type="button" variant="outline" className="ml-auto" onClick={() => setCompleteInteractionForm(null)}>Cancel</Button></div>
          </form> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editingId && editForm)} onOpenChange={(open: boolean) => { if (!open) cancelEdit(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit follow-up</DialogTitle><DialogDescription>Update this reminder or delete it.</DialogDescription></DialogHeader>
          {editingId && editForm ? (() => {
            const editingFollowUp = followUps.find((followUp: FollowUp) => followUp.id === editingId);
            return editingFollowUp ? <FollowUpForm value={editForm} onChange={updateEditForm} onSubmit={handleEditFollowUp} pending={updateFollowUp.isPending} submitLabel="Save changes" lockRelationship rightAction={<Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>} secondaryAction={<><Button type="button" variant="outline" onClick={() => editingFollowUp.statusKey === 'Completed' ? reopenFollowUp(editingFollowUp) : handleMarkCompleteEditingFollowUp()} disabled={updateFollowUp.isPending}>{editingFollowUp.statusKey === 'Completed' ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />} {editingFollowUp.statusKey === 'Completed' ? 'Reopen' : 'Mark complete'}</Button><Button type="button" variant="ghost" size="icon-sm" className="group text-destructive hover:bg-background hover:text-destructive" onClick={() => requestDelete(editingFollowUp)} disabled={deleteFollowUp.isPending} aria-label={`Delete ${editingFollowUp.title}`}><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button></>} /> : null;
          })() : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteCandidate !== null} onOpenChange={(open: boolean) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {deleteCandidate?.title ?? 'this item'}. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={confirmDelete} disabled={deleteFollowUp.isPending}>{deleteFollowUp.isPending ? 'Deleting…' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

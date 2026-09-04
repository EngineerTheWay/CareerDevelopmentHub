import { useEffect, useRef, useState } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, CalendarIcon, Check, ClockAlert, ContactRound, ListChecks, Plus, RotateCcw, Search, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createCompanyOrAdopt, createBusinessGroupOrAdopt } from '@/lib/unique-records';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';




import { AdminPanel } from '@/components/admin-panel';
import { ApplicationForm, initialApplicationForm, toApplicationPayload, type JobApplicationFormValue } from '@/components/application-form';
import { FollowUpForm, createDefaultFollowUp, type FollowUpFormValue } from '@/components/follow-up-form';
import { useUnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ContactForm, findByName, initialContactForm, type ContactFormState } from '@/pages/contacts';


import { InMemoryDataBanner } from '@/generated/components/in-memory-data-banner';
import { HAS_IN_MEMORY_TABLES } from '@/generated/hooks';
import { InteractionInteractionTypeKeyToLabel, type InteractionInteractionTypeKey } from '@/generated/models/interaction-model';
import { useCompanyList, useCreateCompany } from '@/generated/hooks/use-company';
import { useBusinessGroupList, useCreateBusinessGroup } from '@/generated/hooks/use-business-group';
import { useCreateFollowUp, useDeleteFollowUp, useUpdateFollowUp } from '@/generated/hooks/use-follow-up';
import { useCreateInteraction, useDeleteInteraction } from '@/generated/hooks/use-interaction';
import type { Company } from '@/generated/models/company-model';
import { JobApplicationStageKeyToLabel, type JobApplication, type JobApplicationStageKey } from '@/generated/models/job-application-model';
type CompleteInteractionForm = {
  followUp: FollowUp;
  contactSearch: string;
  applicationSearch: string;
  contactId: string;
  applicationId: string;
  interactionDate: Date;
  interactionTypeKey: InteractionInteractionTypeKey;
  notes: string;
};

import { useCareerData, useCreateApplication, useCreateContact, type FollowUp } from '@/hooks/use-career-data';
import { useUser } from '@/hooks/use-user';
import { useSessionDateState } from '@/hooks/use-session-state';
import { formatDisplayDate } from '@/lib/display-date';
import { dateKeyToLocalDate, toDateKey } from '@/lib/follow-up-utils';
type ContactFormValue = ContactFormState;
type ApplicationFormValue = JobApplicationFormValue;





const today = () => format(new Date(), 'yyyy-MM-dd');


const followUpListLayoutTransition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const } as const;
const normalizeName = (name: string) => name.trim().toLowerCase();


export default function HomePage() {
  const { data: user } = useUser();

  const { contacts, applications, followUps, isLoading } = useCareerData();
  const { data: companyData } = useCompanyList();
  const { data: businessGroupData } = useBusinessGroupList();
  const companies = companyData ?? [];
  const businessGroups = businessGroupData ?? [];
  const createContact = useCreateContact();
  const createApplication = useCreateApplication();
  const queryClient = useQueryClient();
  const createCompany = useCreateCompany();
  const createBusinessGroup = useCreateBusinessGroup();
  const createFollowUp = useCreateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();
  const updateFollowUp = useUpdateFollowUp();
  const [contactOpen, setContactOpen] = useState(false);
  const createInteraction = useCreateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [completeInteractionForm, setCompleteInteractionForm] = useState<CompleteInteractionForm | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<FollowUp | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<null | 'contact-create' | 'application-create' | 'follow-up-create' | 'calendar-follow-up-edit'>(null);

  const [calendarFollowUp, setCalendarFollowUp] = useState<FollowUp | null>(null);



  const [selectedCalendarDate, setSelectedCalendarDate] = useSessionDateState('career-hub.dashboard.selected-calendar-date', new Date());
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useSessionDateState('career-hub.dashboard.selected-calendar-month', new Date());


  const [draggingCalendarFollowUpId, setDraggingCalendarFollowUpId] = useState<string | null>(null);
  const calendarMonthHoverTimeoutRef = useRef<number | null>(null);
  const quickViewCalendarRef = useRef<HTMLDivElement | null>(null);
  const quickViewFollowUpScrollRef = useRef<HTMLDivElement | null>(null);
  const [quickViewScrollFade, setQuickViewScrollFade] = useState({ top: false, bottom: false });
  const [contactForm, setContactForm] = useState<ContactFormValue>(initialContactForm);
  const [applicationForm, setApplicationForm] = useState<ApplicationFormValue>(initialApplicationForm);
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormValue>(() => createDefaultFollowUp());

  const [quickViewCalendarHeight, setQuickViewCalendarHeight] = useState<number | undefined>(undefined);
  const [calendarFollowUpForm, setCalendarFollowUpForm] = useState<FollowUpFormValue>(() => createDefaultFollowUp());
  const activeApplications = applications.filter((application: JobApplication) => application.stageKey !== 'Closed');
  const openFollowUps = followUps.filter((item: FollowUp) => item.statusKey === 'Open');
  const overdueFollowUps = openFollowUps.filter((item: FollowUp) => item.dueDate < today());

  const stageEntries = Object.entries(JobApplicationStageKeyToLabel) as Array<[JobApplicationStageKey, string]>;
  const stageCounts = stageEntries.map(([stageKey, label]: [JobApplicationStageKey, string]) => ({
    stageKey,
    label,
    value: applications.filter((application: JobApplication) => application.stageKey === stageKey).length,
  }));
  const getContactById = (contactId: string) => contacts.find((contact: typeof contacts[number]) => contact.id === contactId);
  const getApplicationById = (applicationId: string) => applications.find((application: JobApplication) => application.id === applicationId);
  const selectedCompleteContact = completeInteractionForm?.contactId ? getContactById(completeInteractionForm.contactId) : undefined;
  const selectedCompleteApplication = completeInteractionForm?.applicationId ? getApplicationById(completeInteractionForm.applicationId) : undefined;
  const contactOptions: RefinedSearchOption[] = contacts
    .filter((contact: typeof contacts[number]) => Boolean(contact.id && contact.contactName))
    .filter((contact: typeof contacts[number]) => !selectedCompleteApplication?.company?.id || contact.company?.id === selectedCompleteApplication.company?.id)
    .map((contact: typeof contacts[number]) => ({ id: contact.id, label: contact.contactName, description: [contact.role, contact.company?.companyName].filter(Boolean).join(' - ') }));
  const applicationOptions: RefinedSearchOption[] = applications
    .filter((application: JobApplication) => Boolean(application.id && application.role))
    .filter((application: JobApplication) => !selectedCompleteContact?.company?.id || application.company?.id === selectedCompleteContact.company?.id)
    .map((application: JobApplication) => ({ id: application.id, label: application.role, description: `${application.company?.companyName ?? 'Company'} - ${application.jobID ?? 'No job ID'}` }));
  const buildCompleteInteractionForm = (followUp: FollowUp): CompleteInteractionForm => {
    const relatedContact = followUp.relatedTypeKey === 'Contact' ? getContactById(followUp.relatedContact?.id ?? '') : undefined;
    const relatedApplication = followUp.relatedTypeKey === 'Application' ? getApplicationById(followUp.relatedApplication?.id ?? '') : undefined;
    const dueDate = dateKeyToLocalDate(followUp.dueDate);
    const todayDate = dateKeyToLocalDate(today()) ?? new Date();
    const defaultInteractionDate = dueDate && dueDate <= todayDate ? dueDate : todayDate;
    return {
      followUp,
      contactId: relatedContact?.id ?? '',
      contactSearch: relatedContact?.contactName ?? '',
      applicationId: relatedApplication?.id ?? '',
      applicationSearch: relatedApplication?.role ?? '',
      interactionDate: defaultInteractionDate,
      interactionTypeKey: 'NetworkingChat',
      notes: followUp.notes ?? '',
    };
  };
  const updateCompleteInteractionForm = (field: keyof CompleteInteractionForm, value: CompleteInteractionForm[keyof CompleteInteractionForm]) => setCompleteInteractionForm((current: CompleteInteractionForm | null) => current ? { ...current, [field]: value } : current);
  const maxStageCount = Math.max(...stageCounts.map((stage: { stageKey: JobApplicationStageKey; label: string; value: number }) => stage.value), 1);




  const updateQuickViewScrollFade = () => {
    const scrollElement = quickViewFollowUpScrollRef.current;
    if (!scrollElement) { setQuickViewScrollFade({ top: false, bottom: false }); return; }
    const canScroll = scrollElement.scrollHeight > scrollElement.clientHeight + 1;
    setQuickViewScrollFade({
      top: canScroll && scrollElement.scrollTop > 1,
      bottom: canScroll && scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 1,
    });
  };
  const updateCalendarFollowUpForm = (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => setCalendarFollowUpForm((current: FollowUpFormValue) => ({ ...current, [field]: value }));
  const toFollowUpFormValue = (followUp: FollowUp): FollowUpFormValue => { const { id: _id, ...value } = followUp; void _id; return value; };

  const openCalendarFollowUpDetail = (followUp: FollowUp) => { setCalendarFollowUp(followUp); setCalendarFollowUpForm(toFollowUpFormValue(followUp)); };
  const rescheduleCalendarFollowUp = (followUp: FollowUp, date: Date) => {
    const nextDueDate = format(date, 'yyyy-MM-dd');
    const previousDueDate = followUp.dueDate;
    if (previousDueDate === nextDueDate) { setDraggingCalendarFollowUpId(null); return; }
    updateFollowUp.mutate({ id: followUp.id, changedFields: { dueDate: nextDueDate } }, {
      onSuccess: () => toast.success(`Rescheduled ${followUp.title}`, {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => updateFollowUp.mutate({ id: followUp.id, changedFields: { dueDate: previousDueDate } }, {
            onSuccess: () => toast.success('Reschedule undone'),
            onError: () => toast.error('Could not undo reschedule'),
          }),
        },
      }),
      onError: () => toast.error('Could not reschedule follow-up'),
      onSettled: () => setDraggingCalendarFollowUpId(null),
    });
  };
  const clearCalendarMonthHover = () => {
    if (calendarMonthHoverTimeoutRef.current !== null) {
      window.clearTimeout(calendarMonthHoverTimeoutRef.current);
      calendarMonthHoverTimeoutRef.current = null;
    }
  };
  const shiftCalendarMonth = (direction: 'previous' | 'next') => {
    setSelectedCalendarMonth((current: Date) => {
      const nextMonth = new Date(current);
      nextMonth.setMonth(current.getMonth() + (direction === 'next' ? 1 : -1));
      return nextMonth;
    });
  };
  const handleCalendarDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingCalendarFollowUpId) return;
    event.preventDefault();
    const target = event.target as HTMLElement;
    const nextButton = target.closest('.rdp-button_next');
    const previousButton = target.closest('.rdp-button_previous');
    if (!nextButton && !previousButton) {
      clearCalendarMonthHover();
      return;
    }
    if (calendarMonthHoverTimeoutRef.current !== null) return;
    calendarMonthHoverTimeoutRef.current = window.setTimeout(() => {
      shiftCalendarMonth(nextButton ? 'next' : 'previous');
      calendarMonthHoverTimeoutRef.current = null;
    }, 1000);
  };
  const handleCalendarDateDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingCalendarFollowUpId) return;
    event.preventDefault();
    clearCalendarMonthHover();
    const followUpId = event.dataTransfer.getData('text/plain') || draggingCalendarFollowUpId;
    const followUp = openFollowUps.find((item: FollowUp) => item.id === followUpId);
    const target = event.target as HTMLElement;
    const dayButton = target.closest('button[aria-label]');
    const ariaLabel = dayButton?.getAttribute('aria-label') ?? '';
    const droppedDate = new Date(ariaLabel.replace(/(\d+)(st|nd|rd|th)/, '$1'));
    if (!followUp || Number.isNaN(droppedDate.getTime())) return;
    setSelectedCalendarDate(droppedDate);
    rescheduleCalendarFollowUp(followUp, droppedDate);
  };
  const isContactFormDirty = () => JSON.stringify(contactForm) !== JSON.stringify(initialContactForm);
  const isApplicationFormDirty = () => JSON.stringify(applicationForm) !== JSON.stringify(initialApplicationForm);
  const isFollowUpFormDirty = (value: FollowUpFormValue, baseline: FollowUpFormValue) => JSON.stringify(value) !== JSON.stringify(baseline);
  const discardChanges = (target: NonNullable<typeof pendingDiscard>) => {
    if (target === 'contact-create') { setContactOpen(false); setContactForm(initialContactForm); }
    if (target === 'application-create') { setApplicationOpen(false); setApplicationForm(initialApplicationForm); }
    if (target === 'follow-up-create') { setFollowUpOpen(false); setFollowUpForm(createDefaultFollowUp()); }

    if (target === 'calendar-follow-up-edit') { setCalendarFollowUp(null); setCalendarFollowUpForm(createDefaultFollowUp()); }
    setPendingDiscard(null);
  };
  const requestDiscardChanges = (target: NonNullable<typeof pendingDiscard>) => setPendingDiscard(target);

  const cancelCalendarFollowUpEdit = () => {
    if (!calendarFollowUp) { setCalendarFollowUpForm(createDefaultFollowUp()); return; }
    const baseline = toFollowUpFormValue(calendarFollowUp);
    if (!isFollowUpFormDirty(calendarFollowUpForm, baseline)) { setCalendarFollowUp(null); setCalendarFollowUpForm(createDefaultFollowUp()); return; }
    requestDiscardChanges('calendar-follow-up-edit');
  };
  const handleCalendarFollowUpOpenChange = (open: boolean) => {
    if (open) return;
    cancelCalendarFollowUpEdit();
  };
  const handleContactOpenChange = (open: boolean) => { if (open) { setContactOpen(true); return; } if (!isContactFormDirty()) { setContactOpen(false); setContactForm(initialContactForm); return; } requestDiscardChanges('contact-create'); };
  const handleApplicationOpenChange = (open: boolean) => { if (open) { setApplicationOpen(true); return; } if (!isApplicationFormDirty()) { setApplicationOpen(false); setApplicationForm(initialApplicationForm); return; } requestDiscardChanges('application-create'); };
  const handleFollowUpOpenChange = (open: boolean) => { if (open) { const defaultFollowUp = createDefaultFollowUp(); setFollowUpForm({ ...defaultFollowUp, dueDate: selectedCalendarDate ? format(selectedCalendarDate, 'yyyy-MM-dd') : defaultFollowUp.dueDate }); setFollowUpOpen(true); return; } if (!isFollowUpFormDirty(followUpForm, createDefaultFollowUp())) { setFollowUpOpen(false); setFollowUpForm(createDefaultFollowUp()); return; } requestDiscardChanges('follow-up-create'); };
  const openCreateFollowUpForSelectedDate = () => {
    const defaultFollowUp = createDefaultFollowUp();
    setFollowUpForm({ ...defaultFollowUp, dueDate: selectedCalendarDate ? format(selectedCalendarDate, 'yyyy-MM-dd') : defaultFollowUp.dueDate });
    setFollowUpOpen(true);
  };
  const updateContactForm = (field: keyof ContactFormValue, value: string | string[]) => setContactForm((current: ContactFormValue) => ({ ...current, [field]: value }));

  const updateApplicationForm = (field: keyof ApplicationFormValue, value: string | string[]) => setApplicationForm((current: ApplicationFormValue) => ({ ...current, [field]: value }));
  const updateFollowUpForm = (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => setFollowUpForm((current: FollowUpFormValue) => ({ ...current, [field]: value }));

  const handleCreateContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactForm.contactName.trim()) { toast.error('Contact name is required'); return; }
    if (!contactForm.companyName.trim()) { toast.error('Company is required'); return; }
    try {
      const companyName = contactForm.companyName.trim();
      const businessGroupName = contactForm.businessGroupName.trim();
      const existingCompany = findByName(companies, (company: Company) => company.companyName, companyName);
      const company = existingCompany ?? (await createCompanyOrAdopt(() => createCompany.mutateAsync({ companyName }), companyName, queryClient)).record;
      const existingBusinessGroup = businessGroupName ? (contactForm.businessGroupId ? businessGroups.find((group: typeof businessGroups[number]) => group.id === contactForm.businessGroupId && group.company?.id === company.id) : businessGroups.find((group: typeof businessGroups[number]) => group.businessGroupName.trim().toLowerCase() === businessGroupName.toLowerCase() && group.company?.id === company.id)) : undefined;
      const businessGroup = businessGroupName ? existingBusinessGroup ?? (await createBusinessGroupOrAdopt(() => createBusinessGroup.mutateAsync({ businessGroupName, company: { id: company.id, companyName: company.companyName } }), businessGroupName, company.id, queryClient)).record : undefined;
      await createContact.mutateAsync({
        contactName: contactForm.contactName.trim(),
        role: contactForm.role.trim() || undefined,
        company: { id: company.id, companyName: company.companyName },
        businessGroup: businessGroup ? { id: businessGroup.id, businessGroupName: businessGroup.businessGroupName } : undefined,
        city: contactForm.city.trim() || undefined,
        email: contactForm.email.trim() || undefined,
        relationshipKey: contactForm.relationshipKey,
        notes: contactForm.notes.trim() || undefined,
      });
      toast.success('Contact created');
      setContactForm(initialContactForm);
      setContactOpen(false);
    } catch (error: unknown) {
      console.error('Could not create contact', error);
      toast.error('Could not create contact');
    }
  };

  const handleCreateApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!applicationForm.role.trim() || !applicationForm.companyName.trim()) { toast.error('Role and company are required'); return; }
    try {
      const companyName = applicationForm.companyName.trim();
      const businessGroupName = applicationForm.businessGroupName?.trim();
      const existingCompany = applicationForm.companyId ? companies.find((companyRecord: Company) => companyRecord.id === applicationForm.companyId) : companies.find((companyRecord: Company) => normalizeName(companyRecord.companyName) === normalizeName(companyName));
      const company = existingCompany ?? (await createCompanyOrAdopt(() => createCompany.mutateAsync({ companyName }), companyName, queryClient)).record;
      const existingBusinessGroup = businessGroupName ? businessGroups.find((businessGroupRecord: typeof businessGroups[number]) => normalizeName(businessGroupRecord.businessGroupName) === normalizeName(businessGroupName) && (!businessGroupRecord.company?.id || businessGroupRecord.company?.id === company.id)) : undefined;
      const businessGroup = businessGroupName ? existingBusinessGroup ?? (await createBusinessGroupOrAdopt(() => createBusinessGroup.mutateAsync({ businessGroupName, company: { id: company.id, companyName: company.companyName } }), businessGroupName, company.id, queryClient)).record : undefined;
      createApplication.mutate(toApplicationPayload(applicationForm, { id: company.id, companyName: company.companyName }, businessGroup ? { id: businessGroup.id, businessGroupName: businessGroup.businessGroupName } : undefined), {
        onSuccess: () => { toast.success('Application created'); setApplicationForm(initialApplicationForm); setApplicationOpen(false); },
        onError: (error: unknown) => { console.error('Could not create application', error); toast.error('Could not create application'); },
      });
    } catch (error: unknown) {
      console.error('Could not create company or business group', error);
      toast.error('Could not create company or business group');
    }
  };

  const handleCreateFollowUp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followUpForm.title.trim() || !followUpForm.dueDate) { toast.error('Title and due date are required'); return; }
    createFollowUp.mutate(followUpForm, {
      onSuccess: () => { toast.success('Follow-up created'); setFollowUpForm(createDefaultFollowUp()); setFollowUpOpen(false); },
      onError: () => toast.error('Could not create follow-up'),
    });
  };

  const saveCalendarFollowUp = (options?: { closeOnSuccess?: boolean; successMessage?: string; afterSave?: (savedFollowUp: FollowUp) => void }) => {
    if (!calendarFollowUp) return;
    if (!calendarFollowUpForm.title.trim() || !calendarFollowUpForm.dueDate) { toast.error('Title and due date are required'); return; }
    const changedFields = { ...calendarFollowUpForm };
    updateFollowUp.mutate({ id: calendarFollowUp.id, changedFields }, {
      onSuccess: () => {
        const savedFollowUp: FollowUp = { ...changedFields, id: calendarFollowUp.id };
        toast.success(options?.successMessage ?? 'Follow-up updated');
        if (options?.closeOnSuccess ?? true) {
          setCalendarFollowUp(null);
          setCalendarFollowUpForm(createDefaultFollowUp());
        }
        options?.afterSave?.(savedFollowUp);
      },
      onError: () => toast.error('Could not update follow-up'),
    });
  };
  const handleUpdateCalendarFollowUp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveCalendarFollowUp();
  };


  const requestDeleteFollowUp = (followUp: FollowUp) => {
    setDeleteCandidate(followUp);
  };
  const confirmDeleteFollowUp = () => {
    if (!deleteCandidate) return;
    const itemTitle = deleteCandidate.title;
    deleteFollowUp.mutate(deleteCandidate.id, {
      onSuccess: () => {
        toast.success(`Deleted ${itemTitle}`);
        setDeleteCandidate(null);

        setCalendarFollowUp(null);
        setCalendarFollowUpForm(createDefaultFollowUp());
      },
      onError: () => toast.error('Could not delete follow-up'),
    });
  };

  const reopenFollowUp = (followUp: FollowUp, successMessage = 'Follow-up reopened') => updateFollowUp.mutate({ id: followUp.id, changedFields: { statusKey: 'Open', completedDate: '' } }, { onSuccess: () => toast.success(successMessage), onError: () => toast.error('Could not reopen follow-up') });
  const markCompleteOnly = (followUp: FollowUp) => updateFollowUp.mutate({ id: followUp.id, changedFields: { statusKey: 'Completed', completedDate: today() } }, { onSuccess: () => { toast.success('Follow-up marked complete', { duration: 10000, action: { label: 'Undo', onClick: () => reopenFollowUp(followUp) } }); setCalendarFollowUp(null); }, onError: () => toast.error('Could not complete follow-up') });
  const markCalendarFollowUpComplete = () => saveCalendarFollowUp({ successMessage: 'Follow-up saved', afterSave: (savedFollowUp: FollowUp) => setCompleteInteractionForm(buildCompleteInteractionForm(savedFollowUp)) });
  const markFollowUpComplete = (followUp: FollowUp) => setCompleteInteractionForm(buildCompleteInteractionForm(followUp));
  const completeWithInteraction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completeInteractionForm) return;
    const selectedContact = completeInteractionForm.contactId ? getContactById(completeInteractionForm.contactId) : undefined;
    const selectedApplication = completeInteractionForm.applicationId ? getApplicationById(completeInteractionForm.applicationId) : undefined;
    if (!selectedContact) { toast.error('Select a contact to create an interaction'); return; }
    const activeForm = completeInteractionForm;
    const interactionName = `${InteractionInteractionTypeKeyToLabel[activeForm.interactionTypeKey]} with ${selectedContact.contactName} on ${formatDisplayDate(activeForm.interactionDate)}`;
    createInteraction.mutate({ interactionName, contact: { id: selectedContact.id, contactName: selectedContact.contactName }, interactionDate: toDateKey(activeForm.interactionDate), interactionTypeKey: activeForm.interactionTypeKey, relatedApplication: selectedApplication ? { id: selectedApplication.id, role: selectedApplication.role } : undefined, notes: activeForm.notes.trim() || undefined }, {
      onSuccess: (createdInteraction) => {
        updateFollowUp.mutate({ id: activeForm.followUp.id, changedFields: { statusKey: 'Completed', completedDate: today() } }, {
          onSuccess: () => {
            toast.success('Follow-up completed and interaction logged', { duration: 10000, action: { label: 'Undo', onClick: () => { deleteInteraction.mutate(createdInteraction.id, { onSuccess: () => reopenFollowUp(activeForm.followUp, 'Interaction removed and follow-up reopened'), onError: () => toast.error('Could not delete the new interaction') }); } } });
            setCompleteInteractionForm(null);
            setCalendarFollowUp(null);
          },
          onError: () => toast.error('Interaction saved, but follow-up could not be completed'),
        });
      },
      onError: () => toast.error('Could not create interaction'),
    });
  };

  const hasUnsavedChanges = (contactOpen && isContactFormDirty()) || (applicationOpen && isApplicationFormDirty()) || (followUpOpen && isFollowUpFormDirty(followUpForm, createDefaultFollowUp())) || Boolean(calendarFollowUp && isFollowUpFormDirty(calendarFollowUpForm, toFollowUpFormValue(calendarFollowUp)));
  const guardRegistration = {
    isDirty: hasUnsavedChanges,
    onDiscard: () => {
      setContactOpen(false); setContactForm(initialContactForm);
      setApplicationOpen(false); setApplicationForm(initialApplicationForm);
      setFollowUpOpen(false); setFollowUpForm(createDefaultFollowUp());

      setCalendarFollowUp(null); setCalendarFollowUpForm(createDefaultFollowUp());
    },
  };
  const guard = useUnsavedChangesGuard(guardRegistration);


  const metrics = [
    { label: 'Active Applications', value: activeApplications.length, description: 'Jobs you are still pursuing.', actionLabel: 'Open applications', action: () => guard?.requestNavigation('/applications?stage=active'), icon: BriefcaseBusiness },
    { label: 'Total Applications', value: applications.length, description: 'All applications in your job search.', actionLabel: 'Open applications', action: () => guard?.requestNavigation('/applications?stage=all'), icon: BarChart3 },
    { label: 'Total Contacts', value: contacts.length, description: 'People in your career network.', actionLabel: 'Open contacts', action: () => guard?.requestNavigation('/contacts'), icon: ContactRound },
    { label: 'Overdue', value: overdueFollowUps.length, description: 'Follow-ups past their due date.', actionLabel: 'Open overdue', action: () => guard?.requestNavigation('/follow-ups?status=action-needed'), icon: ClockAlert },
  ];
  const selectedCalendarFollowUps = selectedCalendarDate
    ? openFollowUps.filter((item: FollowUp) => isSameDay(parseISO(item.dueDate), selectedCalendarDate)).sort((a: FollowUp, b: FollowUp) => a.dueDate.localeCompare(b.dueDate))
    : [];
  useEffect(() => {
    const calendarElement = quickViewCalendarRef.current;
    if (!calendarElement) return;
    const updateHeight = () => setQuickViewCalendarHeight(calendarElement.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(calendarElement);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [selectedCalendarMonth]);
  useEffect(() => {
    updateQuickViewScrollFade();
  }, [selectedCalendarFollowUps.length, quickViewCalendarHeight]);

  const followUpDueDates = openFollowUps.map((item: FollowUp) => parseISO(item.dueDate));



  return (
    <div className="space-y-6">
      <InMemoryDataBanner show={HAS_IN_MEMORY_TABLES} message="This app uses draft tables for testing. Data entered won't be saved. Contact the app owner to enable storage." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user?.firstName ? `${user.firstName}'s Career Dashboard` : 'Career Dashboard'}</h1>
          <p className="text-muted-foreground">Quickly add the next contact, application, or follow-up.</p>


        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
          <Dialog open={contactOpen} onOpenChange={handleContactOpenChange}>
            <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Contact</Button></DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl">
              <DialogHeader><DialogTitle>New contact</DialogTitle><DialogDescription>Add someone to your career network.</DialogDescription></DialogHeader>
              <ContactForm value={contactForm} onChange={updateContactForm} onSubmit={handleCreateContact} pending={createContact.isPending || createCompany.isPending || createBusinessGroup.isPending} submitLabel="Create contact" companies={companies} businessGroups={businessGroups} applications={activeApplications} />
            </DialogContent>
          </Dialog>
          <Dialog open={applicationOpen} onOpenChange={handleApplicationOpenChange}>
            <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Application</Button></DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-3xl">
              <DialogHeader><DialogTitle>Create application</DialogTitle><DialogDescription>Add a job application from the dashboard.</DialogDescription></DialogHeader>
              <ApplicationForm value={applicationForm} onChange={updateApplicationForm} onSubmit={handleCreateApplication} pending={createApplication.isPending || createCompany.isPending || createBusinessGroup.isPending} submitLabel="Create application" companies={companies} businessGroups={businessGroups} />
            </DialogContent>
          </Dialog>
          <Dialog open={followUpOpen} onOpenChange={handleFollowUpOpenChange}>
            <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Follow-up</Button></DialogTrigger>
            <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto p-6 sm:max-w-2xl">
              <DialogHeader><DialogTitle>Create follow-up</DialogTitle><DialogDescription>Add an open reminder from the dashboard.</DialogDescription></DialogHeader>
              <FollowUpForm value={followUpForm} onChange={updateFollowUpForm} onSubmit={handleCreateFollowUp} pending={createFollowUp.isPending} submitLabel="Create follow-up" contacts={contacts} applications={activeApplications} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <section className="grid items-stretch gap-3 transition-[grid-template-rows] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:grid-cols-2">
        <Card className="flex h-full flex-col bg-card text-card-foreground">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>Application pipeline</CardTitle>
                <CardDescription>Applications grouped by current stage.</CardDescription>
              </div>
              <Button type="button" size="sm" onClick={() => guard?.requestNavigation('/applications?stage=active')} className="shrink-0">
                <BriefcaseBusiness className="h-4 w-4" />
                View Applications
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            {applications.length === 0 && !isLoading ? (
              <Empty className="flex-1 rounded-xl border border-dashed bg-muted py-8 text-muted-foreground">
                <EmptyMedia variant="icon">
                  <BriefcaseBusiness className="h-6 w-6" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No applications yet</EmptyTitle>
                  <EmptyDescription>Create your first application to start tracking stage progress.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" size="sm" onClick={() => setApplicationOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add application
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid gap-3">
                {stageCounts.map((stage: { stageKey: JobApplicationStageKey; label: string; value: number }) => {
                  const width = `${Math.max((stage.value / maxStageCount) * 100, stage.value > 0 ? 8 : 2)}%`;
                  return (
                    <button key={stage.stageKey} type="button" onClick={() => guard?.requestNavigation(`/applications?stage=${stage.stageKey}`)} className="group grid gap-1.5 rounded-lg p-2 text-left transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{stage.label}</span>
                        <span className="font-semibold text-foreground">{isLoading ? '…' : stage.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

          </CardContent>
        </Card>
        <div className="min-w-0 h-full transition-[height,min-height] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
          <Card className="flex h-full flex-col items-stretch justify-start overflow-hidden bg-card text-card-foreground transition-[height,min-height] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
            <CardHeader className="shrink-0 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="whitespace-nowrap">Quick view calendar</CardTitle>
                  <CardDescription className="whitespace-nowrap">Open follow-ups by due date.</CardDescription>
                </div>
                <Button type="button" size="sm" onClick={() => guard?.requestNavigation('/follow-ups?view=calendar&status=open')} className="w-full shrink-0 sm:w-auto">
                  <CalendarDays className="h-4 w-4" />
                  Open Calendar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid min-w-0 shrink-0 items-stretch gap-3 overflow-hidden xl:grid-cols-[minmax(14.5rem,15.75rem)_minmax(0,1fr)]">
              <div ref={quickViewCalendarRef} className="flex h-full min-w-0 max-w-full justify-center overflow-x-auto pb-1" onDragOver={handleCalendarDragOver} onDragLeave={clearCalendarMonthHover} onDrop={handleCalendarDateDrop}>
                <Calendar
                  mode="single"
                  month={selectedCalendarMonth}
                  onMonthChange={setSelectedCalendarMonth}
                  selected={selectedCalendarDate}
                  onSelect={(date: Date | undefined) => { if (date) setSelectedCalendarDate(date); }}
                  modifiers={{ hasFollowUp: followUpDueDates }}
                  modifiersClassNames={{ hasFollowUp: 'font-semibold underline decoration-primary decoration-2 underline-offset-4' }}

                  className="mx-auto w-fit min-w-max rounded-md border bg-card p-1.5 text-card-foreground [--cell-size:1.95rem] [&_.rdp-month_caption]:h-7 [&_.rdp-caption_label]:text-xs [&_.rdp-weekday]:text-[0.62rem] [&_.rdp-day_button]:text-[0.7rem]"
                />
              </div>
              <div className="grid min-h-0 min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden self-start" style={quickViewCalendarHeight ? { height: quickViewCalendarHeight, maxHeight: quickViewCalendarHeight } : undefined} onDragOver={(event: React.DragEvent<HTMLDivElement>) => { if (draggingCalendarFollowUpId && selectedCalendarDate) event.preventDefault(); }} onDrop={(event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); const followUpId = event.dataTransfer.getData('text/plain') || draggingCalendarFollowUpId; const followUp = openFollowUps.find((item: FollowUp) => item.id === followUpId); if (followUp && selectedCalendarDate) rescheduleCalendarFollowUp(followUp, selectedCalendarDate); }}>
                <div className={draggingCalendarFollowUpId ? 'relative z-10 shrink-0 rounded-md border border-border bg-secondary px-2.5 py-2 text-secondary-foreground shadow-sm transform-none' : 'relative z-10 shrink-0 bg-card transform-none'}>
                  <p className="whitespace-nowrap text-xs font-medium text-foreground">{selectedCalendarDate ? formatDisplayDate(selectedCalendarDate) : 'Select a date'}</p>
                  <p className="whitespace-nowrap text-[0.7rem] text-muted-foreground">{draggingCalendarFollowUpId ? 'Drag to a date on the calendar to reschedule' : `${selectedCalendarFollowUps.length} open follow-up${selectedCalendarFollowUps.length === 1 ? '' : 's'}`}</p>
                </div>
                <div className="relative min-h-0 w-full min-w-0 max-w-full overflow-hidden">
                  <motion.div ref={quickViewFollowUpScrollRef} layout="position" transition={followUpListLayoutTransition} onScroll={updateQuickViewScrollFade} className="grid h-full min-h-0 w-full min-w-0 max-w-full auto-rows-max content-start gap-2.5 overflow-x-hidden overflow-y-auto pr-1.5 [scrollbar-gutter:stable]">
                    <AnimatePresence initial={false} mode="popLayout">
                      {selectedCalendarFollowUps.length === 0 ? (
                        <motion.div key="empty" layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={followUpListLayoutTransition} className="w-full min-w-0 rounded-lg border border-dashed bg-muted px-3 py-4 text-muted-foreground">
                          <div className="min-w-0 space-y-3">
                            <p className="text-[0.7rem] text-muted-foreground">Pick another date or create a follow-up.</p>
                            <Button type="button" size="sm" variant="outline" onClick={openCreateFollowUpForSelectedDate}>
                              <Plus className="h-4 w-4" />
                              Create follow-up
                            </Button>
                          </div>
                        </motion.div>
                      ) : null}
                      {selectedCalendarFollowUps.map((item: FollowUp) => {
                        const isOverdue = item.dueDate <= today();
                        const cardStateClass = isOverdue ? 'border border-border border-l-4 border-l-accent bg-card text-card-foreground hover:border-border hover:border-l-accent hover:bg-card hover:shadow-md' : 'border border-border border-l-4 border-l-primary bg-card text-card-foreground hover:border-border hover:border-l-primary hover:bg-card hover:shadow-md';
                        const dragStateClass = draggingCalendarFollowUpId === item.id ? 'shadow-md opacity-80' : '';
                        return (
                          <div key={item.id} draggable onDragStart={(event: React.DragEvent<HTMLDivElement>) => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; setDraggingCalendarFollowUpId(item.id); }} onDragEnd={() => { clearCalendarMonthHover(); setDraggingCalendarFollowUpId(null); }} className={`group flex w-full min-w-0 max-w-full shrink-0 cursor-grab items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 transition-[background-color,border-color,box-shadow,outline-color,transform] hover:-translate-y-0.5 active:cursor-grabbing ${dragStateClass} ${cardStateClass}`}>
                            <button type="button" onClick={() => openCalendarFollowUpDetail(item)} className="min-w-0 flex-1 text-left focus-visible:outline-none">
                              <span className="block truncate text-xs font-medium">{item.title}</span>
                              <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">{isOverdue ? `Overdue · ${item.relatedContact?.contactName ?? item.relatedApplication?.role ?? 'Standalone'}` : item.relatedContact?.contactName ?? item.relatedApplication?.role ?? 'Standalone'}</span>
                            </button>
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => item.statusKey === 'Completed' ? reopenFollowUp(item) : markFollowUpComplete(item)} disabled={updateFollowUp.isPending} aria-label={item.statusKey === 'Completed' ? `Reopen ${item.title}` : `Mark ${item.title} complete`}>
                              {item.statusKey === 'Completed' ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </Button>
                          </div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                  <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-card to-transparent transition-opacity duration-200 ${quickViewScrollFade.top ? 'opacity-100' : 'opacity-0'}`} />
                  <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-card to-transparent transition-opacity duration-200 ${quickViewScrollFade.bottom ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="overflow-hidden bg-card text-card-foreground">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>Quick view</CardTitle>
                <CardDescription>Career search totals and prioritized next steps.</CardDescription>
              </div>
              <div className="hidden sm:block">
                <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" className="shrink-0" aria-label="Open data management">
                      <Settings className="h-4 w-4" />
                      Data Management
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto bg-card p-6 text-card-foreground sm:max-w-5xl">
                    <DialogHeader><DialogTitle>Data Management</DialogTitle><DialogDescription>Manage contacts, applications, follow-ups, companies, and business groups.</DialogDescription></DialogHeader>
                    <AdminPanel applications={applications} contacts={contacts} followUps={followUps} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map(({ label, value, description, actionLabel, action, icon: Icon }: { label: string; value: number; description: string; actionLabel: string; action: () => void; icon: typeof BriefcaseBusiness }) => (
                <button key={label} type="button" onClick={action} className="group h-full cursor-pointer rounded-xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className={label === 'Overdue' && value > 0 ? 'flex h-full flex-col items-start justify-start overflow-hidden bg-card border-l-4 border-l-accent text-card-foreground transition-[height,min-height,box-shadow] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-md' : 'flex h-full flex-col items-start justify-start overflow-hidden bg-card text-card-foreground transition-[height,min-height,box-shadow] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-md'}>
                    <CardHeader className="w-full shrink-0 pb-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardDescription className="whitespace-nowrap">{label}</CardDescription>
                          <CardTitle className="whitespace-nowrap text-2xl">{isLoading ? '…' : value}</CardTitle>
                        </div>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="w-full shrink-0 space-y-3">
                      <p className="text-xs text-muted-foreground">{description}</p>
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                        {actionLabel}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>

          </CardContent>
        </Card>
      </section>

      <Dialog open={calendarFollowUp !== null} onOpenChange={handleCalendarFollowUpOpenChange}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>View or edit follow-up</DialogTitle>
            <DialogDescription>Update this reminder from the selected calendar date.</DialogDescription>
          </DialogHeader>
          {calendarFollowUp ? (
            <FollowUpForm value={calendarFollowUpForm} onChange={updateCalendarFollowUpForm} onSubmit={handleUpdateCalendarFollowUp} pending={updateFollowUp.isPending} submitLabel="Save changes" lockRelationship contacts={contacts} applications={applications} rightAction={<Button type="button" variant="outline" onClick={cancelCalendarFollowUpEdit}>Cancel</Button>} secondaryAction={<><Button type="button" variant="outline" onClick={() => calendarFollowUp.statusKey === 'Completed' ? reopenFollowUp(calendarFollowUp) : markCalendarFollowUpComplete()} disabled={updateFollowUp.isPending}>{calendarFollowUp.statusKey === 'Completed' ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />} {calendarFollowUp.statusKey === 'Completed' ? 'Reopen' : 'Mark complete'}</Button><Button type="button" variant="ghost" size="icon-sm" className="group text-destructive hover:bg-background hover:text-destructive" onClick={() => requestDeleteFollowUp(calendarFollowUp)} disabled={deleteFollowUp.isPending} aria-label={`Delete ${calendarFollowUp.title}`}><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button></>} />
          ) : null}
        </DialogContent>
      </Dialog>


      <Dialog open={Boolean(completeInteractionForm)} onOpenChange={(open: boolean) => { if (!open) setCompleteInteractionForm(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-visible p-6 sm:max-w-2xl">
          <DialogHeader><DialogTitle>Complete follow-up</DialogTitle><DialogDescription>Complete this follow-up only, or log the completed touchpoint as an interaction.</DialogDescription></DialogHeader>
          {completeInteractionForm ? (
            <form className="grid gap-5" onSubmit={completeWithInteraction}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2.5"><Label>Interaction date</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-11 w-full justify-start bg-white text-left font-normal text-foreground dark:bg-card dark:text-card-foreground"><CalendarIcon className="mr-2 h-4 w-4" />{formatDisplayDate(completeInteractionForm.interactionDate)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={completeInteractionForm.interactionDate} onSelect={(date: Date | undefined) => { if (date) updateCompleteInteractionForm('interactionDate', date); }} initialFocus /></PopoverContent></Popover></div>
                <div className="space-y-2.5"><Label>Type</Label><Select value={completeInteractionForm.interactionTypeKey} onValueChange={(value: string) => updateCompleteInteractionForm('interactionTypeKey', value as InteractionInteractionTypeKey)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(InteractionInteractionTypeKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid gap-5">
                <div className="space-y-2.5"><Label>Contact <span className="text-destructive">*</span></Label><RefinedSearchBox id="dashboard-complete-interaction-contact" value={completeInteractionForm.contactId ? getContactById(completeInteractionForm.contactId)?.contactName ?? completeInteractionForm.contactSearch : completeInteractionForm.contactSearch} options={contactOptions} placeholder="Search contacts" emptyLabel="No contacts found" createLabel="Use contact" disabled={completeInteractionForm.followUp.relatedTypeKey === 'Contact'} onChange={(nextValue: string, selectedId?: string) => { updateCompleteInteractionForm('contactSearch', nextValue); if (selectedId) { updateCompleteInteractionForm('contactId', selectedId); const selectedContact = getContactById(selectedId); const selectedApplication = getApplicationById(completeInteractionForm.applicationId); if (selectedContact?.company?.id && selectedApplication?.company?.id && selectedContact.company?.id !== selectedApplication.company?.id) { updateCompleteInteractionForm('applicationSearch', ''); updateCompleteInteractionForm('applicationId', ''); } } else if (!nextValue.trim()) updateCompleteInteractionForm('contactId', ''); }} onClear={() => { updateCompleteInteractionForm('contactSearch', ''); updateCompleteInteractionForm('contactId', ''); }} /></div>
                <div className="space-y-2.5"><Label>Related application</Label><RefinedSearchBox id="dashboard-complete-interaction-application" value={completeInteractionForm.applicationId ? getApplicationById(completeInteractionForm.applicationId)?.role ?? completeInteractionForm.applicationSearch : completeInteractionForm.applicationSearch} options={applicationOptions} placeholder={selectedCompleteContact?.company?.companyName ? `Search applications at ${selectedCompleteContact.company?.companyName}` : 'Search applications'} emptyLabel="No applications found" createLabel="Use application" disabled={completeInteractionForm.followUp.relatedTypeKey === 'Application'} onChange={(nextValue: string, selectedId?: string) => { updateCompleteInteractionForm('applicationSearch', nextValue); if (selectedId) { updateCompleteInteractionForm('applicationId', selectedId); const selectedApplication = getApplicationById(selectedId); const selectedContact = getContactById(completeInteractionForm.contactId); if (selectedApplication?.company?.id && selectedContact?.company?.id && selectedApplication.company?.id !== selectedContact.company?.id) { updateCompleteInteractionForm('contactSearch', ''); updateCompleteInteractionForm('contactId', ''); } } else if (!nextValue.trim()) updateCompleteInteractionForm('applicationId', ''); }} onClear={() => { updateCompleteInteractionForm('applicationSearch', ''); updateCompleteInteractionForm('applicationId', ''); }} /></div>
              </div>
              <div className="space-y-2.5"><Label>Notes</Label><Textarea value={completeInteractionForm.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateCompleteInteractionForm('notes', event.target.value)} placeholder="Summary, commitments, useful context, next steps" /></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={createInteraction.isPending || updateFollowUp.isPending}>{createInteraction.isPending || updateFollowUp.isPending ? 'Saving…' : 'Complete + log interaction'}</Button>
                  <Button type="button" variant="outline" onClick={() => { markCompleteOnly(completeInteractionForm.followUp); setCompleteInteractionForm(null); }}>Complete only</Button>
                </div>
                <Button type="button" variant="outline" onClick={() => setCompleteInteractionForm(null)} className="sm:ml-auto">Cancel</Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCandidate !== null} onOpenChange={(open: boolean) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteCandidate?.title ?? 'this item'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="delete-confirm-button" onClick={confirmDeleteFollowUp} disabled={deleteFollowUp.isPending}>
              {deleteFollowUp.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDiscard !== null} onOpenChange={(open: boolean) => { if (!open) setPendingDiscard(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes in this form. If you exit now, those changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDiscard) discardChanges(pendingDiscard); }}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


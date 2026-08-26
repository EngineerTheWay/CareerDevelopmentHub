import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isWithinInterval, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarCheck, CalendarIcon, Check, CircleAlert, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { FollowUpForm, createDefaultFollowUp, type FollowUpFormValue } from '@/components/follow-up-form';
import { useUnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MultiSelectFilter, type MultiSelectOption } from '@/components/multi-select-filter';
import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import { InMemoryDataBanner } from '@/generated/components/in-memory-data-banner';
import { HAS_IN_MEMORY_TABLES } from '@/generated/hooks';
import { useCreateFollowUp, useDeleteFollowUp, useUpdateFollowUp } from '@/generated/hooks/use-follow-up';
import { useCreateInteraction, useDeleteInteraction } from '@/generated/hooks/use-interaction';
import { getFollowUpStatusLabel, getFollowUpTypeLabel, useCareerData, type FollowUp } from '@/hooks/use-career-data';
import { InteractionInteractionTypeKeyToLabel, type InteractionInteractionTypeKey } from '@/generated/models/interaction-model';

import { dateKeyToLocalDate, isFollowUpOverdue, todayDateKey, toDateKey } from '@/lib/follow-up-utils';
import { useSessionState } from '@/hooks/use-session-state';
import { formatDisplayDate } from '@/lib/display-date';


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
type RelationshipFilter = 'all' | 'contact' | 'application' | 'standalone';
type StatusFilter = 'action-needed' | 'open' | 'completed' | 'all';
type ViewMode = 'list' | 'calendar';
type DateFilter = 'all' | 'today' | 'week' | 'next-week' | 'month';
type CalendarRangeMode = 'day' | 'week' | 'month';
const relationshipFilterOptions: Array<MultiSelectOption<RelationshipFilter>> = [
  { value: 'all', label: 'All types' },
  { value: 'application', label: 'Applications' },
  { value: 'contact', label: 'Contacts' },
  { value: 'standalone', label: 'Standalone' },
];
const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'action-needed', label: 'Action Needed' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];
const calendarRangeOptions: Array<{ value: CalendarRangeMode; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];
const dateFilterOptions: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'next-week', label: 'Next week' },
  { value: 'month', label: 'This month' },
];
const today = todayDateKey;
const pageSizeOptions = [5, 10, 20, 50] as const;
const editingFollowUpTransition = { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const } as const;


type PageSize = typeof pageSizeOptions[number];

export default function FollowUpsPage() {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const requestedStatus = searchParams.get('status');
  const isRequestedView = (value: string | null): value is ViewMode => value === 'list' || value === 'calendar';
  const isRequestedStatus = (value: string | null): value is StatusFilter => value === 'action-needed' || value === 'open' || value === 'completed' || value === 'all';

  const { contacts, applications, followUps, isLoading } = useCareerData();
  const createFollowUp = useCreateFollowUp();
  const createInteraction = useCreateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const updateFollowUp = useUpdateFollowUp();

  const deleteFollowUp = useDeleteFollowUp();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FollowUpFormValue>(() => createDefaultFollowUp());
  const [editingId, setEditingId] = useState<string>();
  const [editForm, setEditForm] = useState<FollowUpFormValue | null>(null);
  const [search, setSearch] = useSessionState('career-hub.follow-ups.search', '');
  const [relationshipFilter, setRelationshipFilter] = useSessionState<RelationshipFilter[]>('career-hub.follow-ups.relationship-filter', ['all']);
  const [statusFilter, setStatusFilter] = useSessionState<StatusFilter>('career-hub.follow-ups.status-filter', 'action-needed');
  const [completeInteractionForm, setCompleteInteractionForm] = useState<CompleteInteractionForm | null>(null);
  const [viewMode, setViewMode] = useSessionState<ViewMode>('career-hub.follow-ups.view-mode', 'list');
  const [hoveredViewMode, setHoveredViewMode] = useState<ViewMode | null>(null);
  const [dateFilter, setDateFilter] = useSessionState<DateFilter>('career-hub.follow-ups.date-filter', 'all');


  const [pageSize, setPageSize] = useSessionState<PageSize>('career-hub.follow-ups.page-size', 10);
  const [page, setPage] = useSessionState('career-hub.follow-ups.page', 1);
  const [selectedDate, setSelectedDate] = useSessionState('career-hub.follow-ups.selected-date', today());
  const [selectedMonth, setSelectedMonth] = useSessionState('career-hub.follow-ups.selected-month', today());
  const [calendarRangeMode, setCalendarRangeMode] = useSessionState<CalendarRangeMode>('career-hub.follow-ups.calendar-range-mode', 'day');
  const [hoveredCalendarRangeMode, setHoveredCalendarRangeMode] = useState<CalendarRangeMode | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<FollowUp | null>(null);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const [draggingFollowUpId, setDraggingFollowUpId] = useState<string | null>(null);
  const calendarMonthHoverTimeoutRef = useRef<number | null>(null);
  const mainCalendarRef = useRef<HTMLDivElement | null>(null);
  const mainCalendarFollowUpScrollRef = useRef<HTMLDivElement | null>(null);
  const [mainCalendarHeight, setMainCalendarHeight] = useState<number | undefined>(undefined);
  const [mainCalendarScrollFade, setMainCalendarScrollFade] = useState({ top: false, bottom: false });
  useEffect(() => {
    if (isRequestedView(requestedView)) { setViewMode(requestedView); }
    if (isRequestedStatus(requestedStatus)) { setStatusFilter(requestedStatus); setPage(1); }
  }, [requestedStatus, requestedView, setPage, setStatusFilter, setViewMode]);


  const activeApplications = useMemo(() => applications.filter((application: typeof applications[number]) => application.stageKey !== 'Closed'), [applications]);
  const getDisplayTypeLabel = (followUp: FollowUp) => getFollowUpTypeLabel(followUp).replace('None/', '');
  const getAssociatedLabel = (followUp: FollowUp) => {
    if (followUp.relatedTypeKey === 'Contact') {
      const contactName = followUp.relatedContact?.contactName || 'Contact not selected';
      const contact = contacts.find((item: typeof contacts[number]) => item.id === followUp.relatedContact?.id);
      const companyName = contact?.company?.companyName;
      return companyName ? `${contactName} - ${companyName}` : contactName;
    }
    if (followUp.relatedTypeKey === 'Application') {
      const role = followUp.relatedApplication?.role || 'Application not selected';
      const application = applications.find((item: typeof applications[number]) => item.id === followUp.relatedApplication?.id);
      const companyName = application?.company?.companyName;
      return companyName ? `${role} - ${companyName}` : role;
    }
    return 'Standalone';
  };
  const dueCutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return format(date, 'yyyy-MM-dd');
  }, []);
  const baseFilteredFollowUps = useMemo(() => followUps.filter((followUp: FollowUp) => {
    const normalizedSearch = search.trim().toLowerCase();
    const searchText = [followUp.title, followUp.notes, getDisplayTypeLabel(followUp), getAssociatedLabel(followUp), getFollowUpStatusLabel(followUp), followUp.dueDate, followUp.completedDate].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
    const matchesRelationship = relationshipFilter.includes('all') || (relationshipFilter.includes('contact') && followUp.relatedTypeKey === 'Contact') || (relationshipFilter.includes('application') && followUp.relatedTypeKey === 'Application') || (relationshipFilter.includes('standalone') && followUp.relatedTypeKey === 'NoneStandalone');
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'action-needed' && followUp.statusKey === 'Open' && (isFollowUpOverdue(followUp) || followUp.dueDate <= dueCutoff)) || (statusFilter === 'open' && followUp.statusKey === 'Open') || (statusFilter === 'completed' && followUp.statusKey === 'Completed');
    return matchesSearch && matchesRelationship && matchesStatus;
  }), [followUps, relationshipFilter, statusFilter, search, dueCutoff]);
  const filteredFollowUps = useMemo(() => {
    const now = new Date();
    const nextWeekStart = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
    const nextWeekEnd = endOfWeek(nextWeekStart);
    const dateRange = dateFilter === 'today' ? { start: now, end: now } : dateFilter === 'week' ? { start: startOfWeek(now), end: endOfWeek(now) } : dateFilter === 'next-week' ? { start: nextWeekStart, end: nextWeekEnd } : dateFilter === 'month' ? { start: startOfMonth(now), end: endOfMonth(now) } : null;
    return baseFilteredFollowUps.filter((followUp: FollowUp) => {
      if (!dateRange) return true;
      const dueDate = dateKeyToLocalDate(followUp.dueDate);
      if (!dueDate) return false;
      return dateFilter === 'today' ? isSameDay(dueDate, now) : isWithinInterval(dueDate, dateRange);
    }).sort((a: FollowUp, b: FollowUp) => statusFilter === 'completed' ? (b.completedDate ?? b.dueDate).localeCompare(a.completedDate ?? a.dueDate) : a.dueDate.localeCompare(b.dueDate));
  }, [baseFilteredFollowUps, dateFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredFollowUps.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedFollowUps = filteredFollowUps.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedDateFollowUps = useMemo(() => {
    const activeSelectedDate = dateKeyToLocalDate(selectedDate);
    if (!activeSelectedDate) return [];
    const rangeStart = calendarRangeMode === 'day' ? activeSelectedDate : calendarRangeMode === 'week' ? startOfWeek(activeSelectedDate) : startOfMonth(activeSelectedDate);
    const rangeEnd = calendarRangeMode === 'day' ? activeSelectedDate : calendarRangeMode === 'week' ? endOfWeek(activeSelectedDate) : endOfMonth(activeSelectedDate);
    return filteredFollowUps.filter((followUp: FollowUp) => {
      const dueDate = dateKeyToLocalDate(followUp.dueDate);
      if (!dueDate) return false;
      return calendarRangeMode === 'day' ? isSameDay(dueDate, activeSelectedDate) : isWithinInterval(dueDate, { start: rangeStart, end: rangeEnd });
    });
  }, [calendarRangeMode, filteredFollowUps, selectedDate]);
  const selectedRangeLabel = useMemo(() => {
    const activeSelectedDate = dateKeyToLocalDate(selectedDate);
    if (!activeSelectedDate) return 'Select a date';
    if (calendarRangeMode === 'day') return formatDisplayDate(activeSelectedDate);
    if (calendarRangeMode === 'week') return `${format(activeSelectedDate ? startOfWeek(activeSelectedDate) : new Date(), 'MMM dd')} – ${format(activeSelectedDate ? endOfWeek(activeSelectedDate) : new Date(), 'MMM dd, yyyy')}`;
    return format(activeSelectedDate, 'MMM yyyy');
  }, [calendarRangeMode, selectedDate]);
  const currentWeekDates = useMemo(() => { const activeSelectedDate = dateKeyToLocalDate(selectedDate); return calendarRangeMode === 'week' && activeSelectedDate ? eachDayOfInterval({ start: startOfWeek(activeSelectedDate), end: endOfWeek(activeSelectedDate) }) : []; }, [calendarRangeMode, selectedDate]);
  const selectedMonthDates = useMemo(() => { const activeSelectedDate = dateKeyToLocalDate(selectedDate); return calendarRangeMode === 'month' && activeSelectedDate ? eachDayOfInterval({ start: startOfMonth(activeSelectedDate), end: endOfMonth(activeSelectedDate) }) : []; }, [calendarRangeMode, selectedDate]);
  const followUpDueDates = filteredFollowUps.filter((followUp: FollowUp) => followUp.statusKey === 'Open').map((followUp: FollowUp) => dateKeyToLocalDate(followUp.dueDate)).filter((date: Date | undefined): date is Date => Boolean(date));
  const followUpCountsByDate = useMemo(() => filteredFollowUps.reduce<Record<string, { open: number; overdue: number }>>((counts: Record<string, { open: number; overdue: number }>, followUp: FollowUp) => {
    if (followUp.statusKey !== 'Open') return counts;
    const dateKey = toDateKey(followUp.dueDate);
    const existing = counts[dateKey] ?? { open: 0, overdue: 0 };
    counts[dateKey] = {
      open: existing.open + 1,
      overdue: existing.overdue + (isFollowUpOverdue(followUp) ? 1 : 0),
    };
    return counts;
  }, {}), [filteredFollowUps]);
  const getContactById = (contactId: string) => contacts.find((contact: typeof contacts[number]) => contact.id === contactId);
  const getApplicationById = (applicationId: string) => applications.find((application: typeof applications[number]) => application.id === applicationId);
  const selectedCompleteContact = completeInteractionForm?.contactId ? getContactById(completeInteractionForm.contactId) : undefined;
  const selectedCompleteApplication = completeInteractionForm?.applicationId ? getApplicationById(completeInteractionForm.applicationId) : undefined;
  const contactOptions: RefinedSearchOption[] = contacts
    .filter((contact: typeof contacts[number]) => Boolean(contact.id && contact.contactName))
    .filter((contact: typeof contacts[number]) => !selectedCompleteApplication?.company?.id || contact.company?.id === selectedCompleteApplication.company?.id)
    .map((contact: typeof contacts[number]) => ({ id: contact.id, label: contact.contactName, description: [contact.role, contact.company?.companyName].filter(Boolean).join(' - ') }));
  const applicationOptions: RefinedSearchOption[] = applications
    .filter((application: typeof applications[number]) => Boolean(application.id && application.role))
    .filter((application: typeof applications[number]) => !selectedCompleteContact?.company?.id || application.company?.id === selectedCompleteContact.company?.id)
    .map((application: typeof applications[number]) => ({ id: application.id, label: application.role, description: `${application.company?.companyName ?? 'Company'} - ${application.jobID ?? 'No job ID'}` }));
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
  const updateMainCalendarScrollFade = () => {
    const scrollElement = mainCalendarFollowUpScrollRef.current;
    if (!scrollElement) { setMainCalendarScrollFade({ top: false, bottom: false }); return; }
    const canScroll = scrollElement.scrollHeight > scrollElement.clientHeight + 1;
    setMainCalendarScrollFade({
      top: canScroll && scrollElement.scrollTop > 1,
      bottom: canScroll && scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 1,
    });
  };
  const isMissingRequiredRelatedItem = (value: FollowUpFormValue) => (value.relatedTypeKey === 'Contact' && !value.relatedContact?.id) || (value.relatedTypeKey === 'Application' && !value.relatedApplication?.id);
  const updateForm = (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => setForm((current: FollowUpFormValue) => ({ ...current, [field]: value }));
  const updateEditForm = (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => setEditForm((current: FollowUpFormValue | null) => current ? { ...current, [field]: value } : current);
  const toFormValue = (followUp: FollowUp): FollowUpFormValue => { const { id: _id, ...value } = followUp; void _id; return value; };
  const resetFilters = () => { setSearch(''); setStatusFilter('action-needed'); setRelationshipFilter(['all']); setDateFilter('all'); setPage(1); };
  const startEdit = (followUp: FollowUp) => { setEditingId(followUp.id); setEditForm(toFormValue(followUp)); };
  const saveEditFollowUp = (options?: { closeOnSuccess?: boolean; successMessage?: string; afterSave?: (savedFollowUp: FollowUp) => void }) => {
    if (!editingId || !editForm) return;
    if (!editForm.title.trim() || !editForm.dueDate) { toast.error('Title and due date are required'); return; }
    const changedFields = { ...editForm };
    updateFollowUp.mutate({ id: editingId, changedFields }, {
      onSuccess: () => {
        const savedFollowUp: FollowUp = { ...changedFields, id: editingId };
        toast.success(options?.successMessage ?? 'Follow-up updated');
        if (options?.closeOnSuccess ?? true) {
          setEditingId(undefined);
          setEditForm(null);
        }
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
  const handleReopenEditingFollowUp = (followUp: FollowUp) => updateFollowUp.mutate({ id: followUp.id, changedFields: { ...editForm, statusKey: 'Open', completedDate: '' } }, {
    onSuccess: () => {
      toast.success('Follow-up reopened');
      setEditForm((current: FollowUpFormValue | null) => current ? { ...current, statusKey: 'Open', completedDate: '' } : current);
    },
    onError: () => toast.error('Could not reopen follow-up'),
  });
  const rescheduleFollowUp = (followUp: FollowUp, date: Date) => {
    const nextDueDate = toDateKey(date);
    const previousDueDate = followUp.dueDate;
    if (previousDueDate === nextDueDate) { setDraggingFollowUpId(null); return; }
    const changedFields: Partial<Omit<FollowUp, 'id'>> = { dueDate: nextDueDate };

    updateFollowUp.mutate({ id: followUp.id, changedFields }, {
      onSuccess: () => {
        toast.success(`Rescheduled ${followUp.title}`, {
          duration: 10000,
          action: {
            label: 'Undo',
            onClick: () => updateFollowUp.mutate({ id: followUp.id, changedFields: { dueDate: previousDueDate } }, {
              onSuccess: () => toast.success('Reschedule undone'),
              onError: () => toast.error('Could not undo reschedule'),
            }),
          },
        });
      },
      onError: () => toast.error('Could not reschedule follow-up'),
      onSettled: () => setDraggingFollowUpId(null),
    });
  };
  const clearCalendarMonthHover = () => {
    if (calendarMonthHoverTimeoutRef.current !== null) {
      window.clearTimeout(calendarMonthHoverTimeoutRef.current);
      calendarMonthHoverTimeoutRef.current = null;
    }
  };
  const shiftCalendarMonth = (direction: 'previous' | 'next') => {
    setSelectedMonth((current: string) => {
      const currentMonth = dateKeyToLocalDate(current);
      if (!currentMonth) return current;
      currentMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return toDateKey(currentMonth);
    });
  };
  const handleCalendarDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingFollowUpId) return;
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
    if (!draggingFollowUpId) return;
    event.preventDefault();
    clearCalendarMonthHover();
    const followUpId = event.dataTransfer.getData('text/plain') || draggingFollowUpId;
    const followUp = followUps.find((item: FollowUp) => item.id === followUpId);
    const target = event.target as HTMLElement;
    const dayButton = target.closest('button[aria-label]');
    const ariaLabel = dayButton?.getAttribute('aria-label') ?? '';
    const droppedDate = new Date(ariaLabel.replace(/(\d+)(st|nd|rd|th)/, '$1'));
    if (!followUp || Number.isNaN(droppedDate.getTime())) return;
    setSelectedDate(format(droppedDate, 'yyyy-MM-dd'));
    rescheduleFollowUp(followUp, droppedDate);
  };
  const reopenFollowUp = (followUp: FollowUp, successMessage = 'Follow-up reopened') => updateFollowUp.mutate({ id: followUp.id, changedFields: { statusKey: 'Open', completedDate: '' } }, { onSuccess: () => toast.success(successMessage), onError: () => toast.error('Could not reopen follow-up') });
  const markCompleteOnly = (followUp: FollowUp) => updateFollowUp.mutate({ id: followUp.id, changedFields: { statusKey: 'Completed', completedDate: today() } }, { onSuccess: () => toast.success('Follow-up marked complete', { duration: 10000, action: { label: 'Undo', onClick: () => reopenFollowUp(followUp) } }), onError: () => toast.error('Could not complete follow-up') });
  const markComplete = (followUp: FollowUp) => setCompleteInteractionForm(buildCompleteInteractionForm(followUp));
  const completeWithInteraction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completeInteractionForm) return;
    const selectedContact = completeInteractionForm.contactId ? getContactById(completeInteractionForm.contactId) : undefined;
    const selectedApplication = completeInteractionForm.applicationId ? getApplicationById(completeInteractionForm.applicationId) : undefined;
    if (!selectedContact) { toast.error('Select a contact to create an interaction'); return; }
    const activeForm = completeInteractionForm;
    const interactionName = `${InteractionInteractionTypeKeyToLabel[activeForm.interactionTypeKey]} with ${selectedContact.contactName} on ${formatDisplayDate(activeForm.interactionDate)}`;
    createInteraction.mutate({
      interactionName,
      contact: { id: selectedContact.id, contactName: selectedContact.contactName },
      interactionDate: toDateKey(activeForm.interactionDate),
      interactionTypeKey: activeForm.interactionTypeKey,
      relatedApplication: selectedApplication ? { id: selectedApplication.id, role: selectedApplication.role } : undefined,
      notes: activeForm.notes.trim() || undefined,
    }, {
      onSuccess: (createdInteraction) => {
        updateFollowUp.mutate({ id: activeForm.followUp.id, changedFields: { statusKey: 'Completed', completedDate: today() } }, {
          onSuccess: () => {
            toast.success('Follow-up completed and interaction logged', {
              duration: 10000,
              action: {
                label: 'Undo',
                onClick: () => {
                  deleteInteraction.mutate(createdInteraction.id, {
                    onSuccess: () => {
                      updateFollowUp.mutate({ id: activeForm.followUp.id, changedFields: { statusKey: 'Open', completedDate: '' } }, {
                        onSuccess: () => toast.success('Interaction removed and follow-up reopened'),
                        onError: () => toast.error('Interaction removed, but follow-up could not be reopened'),
                      });
                    },
                    onError: () => toast.error('Could not delete the new interaction'),
                  });
                },
              },
            });
            setCompleteInteractionForm(null);
          },
          onError: () => toast.error('Interaction saved, but follow-up could not be completed'),
        });
      },
      onError: () => toast.error('Could not create interaction'),
    });
  };
  const requestDelete = (followUp: FollowUp) => setDeleteCandidate(followUp);
  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const itemTitle = deleteCandidate.title;
    deleteFollowUp.mutate(deleteCandidate.id, { onSuccess: () => { toast.success(`Deleted ${itemTitle}`); if (editingId === deleteCandidate.id) { setEditingId(undefined); setEditForm(null); } setDeleteCandidate(null); }, onError: () => toast.error('Could not delete follow-up') });
  };
  const isFollowUpFormDirty = (value: FollowUpFormValue, baseline: FollowUpFormValue) => JSON.stringify(value) !== JSON.stringify(baseline);
  const createFormDirty = createOpen && isFollowUpFormDirty(form, createDefaultFollowUp());
  const editingFollowUp = editingId ? followUps.find((followUp: FollowUp) => followUp.id === editingId) : undefined;
  const editFormDirty = Boolean(editForm && editingFollowUp && isFollowUpFormDirty(editForm, toFormValue(editingFollowUp)));
  const guardRegistration = useMemo(() => ({ isDirty: createFormDirty || editFormDirty, onDiscard: () => { setCreateOpen(false); setForm(createDefaultFollowUp()); setEditingId(undefined); setEditForm(null); } }), [createFormDirty, editFormDirty]);
  useUnsavedChangesGuard(guardRegistration);
  const requestDiscard = (action: () => void) => setDiscardAction(() => action);
  const cancelEdit = () => {
    if (!editForm) { setEditingId(undefined); return; }
    if (!editFormDirty) { setEditingId(undefined); setEditForm(null); return; }
    requestDiscard(() => { setEditingId(undefined); setEditForm(null); });
  };
  useLayoutEffect(() => {
    if (viewMode !== 'calendar') return;
    const calendarElement = mainCalendarRef.current;
    if (!calendarElement) return;

    let animationFrameId: number | null = null;
    const updateHeight = () => {
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        setMainCalendarHeight(calendarElement.getBoundingClientRect().height);
        animationFrameId = null;
      });
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(calendarElement);
    window.addEventListener('resize', updateHeight);

    return () => {
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [viewMode, selectedMonth, filteredFollowUps.length]);
  useEffect(() => {
    updateMainCalendarScrollFade();
  }, [selectedDateFollowUps.length, mainCalendarHeight, calendarRangeMode]);
  const handleCreateOpenChange = (open: boolean) => {
    if (open) { setCreateOpen(true); setForm(createDefaultFollowUp()); return; }
    if (!createFormDirty) { setCreateOpen(false); setForm(createDefaultFollowUp()); return; }
    requestDiscard(() => { setCreateOpen(false); setForm(createDefaultFollowUp()); });
  };
  const openCreateFollowUpForSelectedDate = () => {
    const defaultFollowUp = createDefaultFollowUp();
    setForm({ ...defaultFollowUp, dueDate: selectedDate });
    setCreateOpen(true);
  };
  const handleCreateFollowUp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.dueDate) { toast.error('Title and due date are required'); return; }
    if (isMissingRequiredRelatedItem(form)) { toast.error('Select a contact or application for this follow-up'); return; }
    createFollowUp.mutate({ ...form, completedDate: form.statusKey === 'Completed' ? form.completedDate || today() : '' }, {
      onSuccess: () => {
        toast.success('Follow-up created');
        setForm(createDefaultFollowUp());
        setCreateOpen(false);
      },
      onError: (error: Error) => toast.error(error.message || 'Could not create follow-up'),
    });
  };

  const renderFollowUpCard = (item: FollowUp) => {
    const isOverdue = isFollowUpOverdue(item);
    const borderAccent = isOverdue ? 'border-l-accent hover:border-l-accent' : item.statusKey === 'Completed' ? 'border-l-muted hover:border-l-muted' : 'border-l-primary hover:border-l-primary';

    return (
      <motion.div key={item.id} layout transition={editingFollowUpTransition} className="min-w-0 overflow-anchor-none px-1 py-0.5">
        <Card draggable={viewMode === 'calendar'} onDragStart={(event: React.DragEvent<HTMLDivElement>) => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; setDraggingFollowUpId(item.id); }} onDragEnd={() => { clearCalendarMonthHover(); setDraggingFollowUpId(null); }} onClick={() => startEdit(item)} className={`border-l-4 bg-card text-card-foreground shadow-sm transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${viewMode === 'calendar' ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingFollowUpId === item.id ? 'ring-2 ring-ring' : ''} ${borderAccent}`}>
          <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5">
            <div className="min-w-0 rounded-md">
              <div className="mb-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
                <Badge className="min-w-0 max-w-[18rem] flex-shrink truncate" variant="outline">{getAssociatedLabel(item)}</Badge>
                <Badge className="shrink-0" variant={getFollowUpStatusLabel(item) === 'Open' ? 'default' : 'secondary'}>{getFollowUpStatusLabel(item)}</Badge>
              </div>
              <h3 className="min-w-0 truncate text-sm font-semibold leading-5 text-card-foreground">{item.title}</h3>
              <p className="mt-1 min-w-0 truncate text-xs text-muted-foreground">{item.notes ?? 'No notes'}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 self-center" onClick={(event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
              <span className={isOverdue ? 'inline-flex shrink-0 items-center justify-center rounded-md border border-destructive px-1.5 py-0.5 text-center text-xs font-medium text-foreground' : 'shrink-0 text-center text-xs text-muted-foreground'}>
                {isOverdue ? <CircleAlert className="mr-1 h-3 w-3 text-destructive" aria-hidden="true" /> : null}
                {item.statusKey === 'Completed' ? `Completed ${formatDisplayDate(item.completedDate)}` : `Due ${formatDisplayDate(item.dueDate)}`}
              </span>
              <div className="flex shrink-0 items-center justify-center gap-1">
                {item.statusKey === 'Open' ? <Button variant="outline" size="icon-sm" onClick={() => markComplete(item)} disabled={updateFollowUp.isPending} aria-label="Mark follow-up complete"><Check className="h-4 w-4" /></Button> : <Button variant="outline" size="icon-sm" onClick={() => reopenFollowUp(item)} disabled={updateFollowUp.isPending} aria-label="Reopen follow-up"><RotateCcw className="h-4 w-4" /></Button>}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <InMemoryDataBanner show={HAS_IN_MEMORY_TABLES} message="This app uses draft tables for testing. Data entered won't be saved. Contact the app owner to enable storage." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-muted-foreground">Stay on top of reminders for contacts, applications, and one-off tasks.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Follow-up</Button></DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-visible p-6 sm:max-w-2xl">
            <DialogHeader><DialogTitle>Create a follow-up</DialogTitle><DialogDescription>Add a reminder for a contact, application, or standalone task.</DialogDescription></DialogHeader>
            <FollowUpForm value={form} onChange={updateForm} onSubmit={handleCreateFollowUp} pending={createFollowUp.isPending} submitLabel="Create follow-up" contacts={contacts} applications={activeApplications} />
          </DialogContent>


        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Filters</CardTitle>
              <CardDescription>Narrow follow-ups by search, status, type, or view.</CardDescription>
            </div>
            <div className="flex h-9 w-full items-center justify-center gap-1 rounded-md border bg-card p-1 text-card-foreground shadow-sm sm:w-auto" onMouseLeave={() => setHoveredViewMode(null)}>
              {(['list', 'calendar'] as ViewMode[]).map((mode: ViewMode) => {
                const isActive = viewMode === mode;
                const isHovered = hoveredViewMode === mode;
                return (
                  <Button key={mode} type="button" size="sm" variant="ghost" className={`relative h-7 min-w-[76px] overflow-hidden px-3 text-[0.9375rem] font-semibold leading-5 transition-colors duration-150 hover:bg-transparent ${isActive ? 'text-primary-foreground hover:text-primary-foreground' : 'text-card-foreground'}`} onMouseEnter={() => setHoveredViewMode(mode)} onFocus={() => setHoveredViewMode(mode)} onClick={() => setViewMode(mode)}>
                    {isHovered && !isActive ? <span className="absolute inset-x-0.5 inset-y-0.5 rounded-sm bg-accent text-accent-foreground" /> : null}
                    {isActive ? <span className="absolute inset-x-0.5 inset-y-0.5 rounded-sm bg-primary text-primary-foreground" /> : null}
                    <span className="relative z-10 capitalize">{mode}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(9rem,12rem)_minmax(10rem,13rem)_auto] lg:items-center">
          <div className="relative flex h-9 min-w-0 items-center rounded-md border bg-card text-card-foreground shadow-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setSearch(event.target.value); setPage(1); }} placeholder="Search follow-ups" className="h-full border-0 bg-card pl-9 shadow-none focus-visible:ring-1" />
          </div>
          <Select value={statusFilter} onValueChange={(value: StatusFilter) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger size="sm" className="h-9 w-full py-0 lg:w-[12rem]" aria-label="Status filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((option: { value: StatusFilter; label: string }) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <MultiSelectFilter label="Follow-up type" options={relationshipFilterOptions} selected={relationshipFilter} allValue="all" onChange={(selected: RelationshipFilter[]) => { setRelationshipFilter(selected); setPage(1); }} className="w-full lg:w-[13rem]" />
          <Button className="h-9 w-full lg:w-auto lg:shrink-0" variant="outline" onClick={resetFilters}>Clear</Button>
        </CardContent>
      </Card>

      {viewMode === 'calendar' ? (
        <Card>
          <CardHeader>
            <CardTitle>Follow-ups calendar</CardTitle>
            <CardDescription>{isLoading ? 'Loading follow-ups…' : `${filteredFollowUps.length} follow-ups match the current filters`}</CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 items-start gap-5 overflow-hidden xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <div ref={mainCalendarRef} className="flex min-w-0 justify-center overflow-x-auto overflow-y-hidden pb-1 xl:justify-start" onDragOver={handleCalendarDragOver} onDragLeave={clearCalendarMonthHover} onDrop={handleCalendarDateDrop}>
              <Calendar mode="single" month={dateKeyToLocalDate(selectedMonth)} onMonthChange={(month: Date) => setSelectedMonth(toDateKey(month))} selected={dateKeyToLocalDate(selectedDate)} onSelect={(date: Date | undefined) => { if (date) setSelectedDate(toDateKey(date)); }} modifiers={{ hasFollowUp: followUpDueDates, currentWeek: currentWeekDates, selectedMonthRange: selectedMonthDates }} modifiersClassNames={{ hasFollowUp: 'font-semibold underline decoration-primary decoration-2 underline-offset-4', currentWeek: 'outline outline-1 outline-dashed outline-border outline-offset-[-3px]', selectedMonthRange: 'outline outline-1 outline-dashed outline-border outline-offset-[-3px]', today: 'rounded-md border-2 border-accent' }} components={{ DayButton: (dayButtonProps: React.ComponentProps<typeof CalendarDayButton>) => { const dateKey = toDateKey(dayButtonProps.day.date); const counts = followUpCountsByDate[dateKey]; const count = counts?.open ?? 0; const badgeClassName = counts?.overdue ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'; return <div className="relative h-full w-full"><CalendarDayButton {...dayButtonProps} className={`${dayButtonProps.className ?? ''} relative z-0`} /><span className={count > 0 ? `pointer-events-none absolute -right-0.5 -top-0.5 z-20 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold leading-none shadow-sm ring-2 ring-card ${badgeClassName}` : 'sr-only'}>{count > 0 ? count : ''}</span></div>; } }} className="w-fit max-w-none shrink-0 rounded-md border bg-card text-card-foreground [--cell-size:clamp(2.2rem,8vw,3.25rem)] xl:[--cell-size:3.25rem]" />
            </div>
            <div className="flex min-w-0 overflow-hidden" style={mainCalendarHeight ? { height: `${mainCalendarHeight}px`, maxHeight: `${mainCalendarHeight}px` } : { height: '28rem', maxHeight: '28rem' }}>
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden" onDragOver={(event: React.DragEvent<HTMLDivElement>) => { if (draggingFollowUpId) event.preventDefault(); }} onDrop={(event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); const followUpId = event.dataTransfer.getData('text/plain') || draggingFollowUpId; const followUp = followUps.find((item: FollowUp) => item.id === followUpId); const dropDate = dateKeyToLocalDate(selectedDate); if (followUp && dropDate) rescheduleFollowUp(followUp, dropDate); }}>
                <div className={`${draggingFollowUpId ? 'rounded-lg bg-secondary p-3 text-secondary-foreground' : ''}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedRangeLabel}</p>
                      <p className="text-sm text-muted-foreground">{draggingFollowUpId ? 'Drag to a date on the calendar to reschedule' : `${selectedDateFollowUps.length} matching follow-up${selectedDateFollowUps.length === 1 ? '' : 's'}`}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8" onClick={openCreateFollowUpForSelectedDate}>
                        <Plus className="h-4 w-4" />
                        Create
                      </Button>
                      <div className="flex h-8 shrink-0 items-center gap-1 rounded-md border bg-card p-1 text-card-foreground shadow-sm" onMouseLeave={() => setHoveredCalendarRangeMode(null)}>
                        {calendarRangeOptions.map((option: { value: CalendarRangeMode; label: string }) => {
                          const isActive = calendarRangeMode === option.value;
                          const isHovered = hoveredCalendarRangeMode === option.value;
                          return (
                            <Button key={option.value} type="button" size="sm" variant="ghost" className={`relative h-6 overflow-hidden px-2 text-xs transition-colors duration-200 hover:bg-transparent ${isActive ? 'text-primary-foreground hover:text-primary-foreground' : 'text-card-foreground'}`} onMouseEnter={() => setHoveredCalendarRangeMode(option.value)} onFocus={() => setHoveredCalendarRangeMode(option.value)} onClick={() => setCalendarRangeMode(option.value)}>
                              {isHovered && !isActive ? <span className="absolute inset-x-0.5 inset-y-0.5 rounded-sm bg-accent text-accent-foreground" /> : null}
                              {isActive ? <span className="absolute inset-x-0.5 inset-y-0.5 rounded-sm bg-primary text-primary-foreground" /> : null}
                              <span className="relative z-10">{option.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                  <div ref={mainCalendarFollowUpScrollRef} onScroll={updateMainCalendarScrollFade} className="h-full min-w-0 space-y-2 overflow-x-hidden overflow-y-auto px-1 pt-1 scroll-pt-1 [scrollbar-gutter:stable]">
                    {selectedDateFollowUps.length === 0 ? <div className="min-w-0 rounded-lg border bg-card p-4 text-sm text-card-foreground"><p className="text-muted-foreground">Pick another date, check the filter, or create a new follow-up.</p></div> : null}
                    {selectedDateFollowUps.map((item: FollowUp) => renderFollowUpCard(item))}
                  </div>
                  <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-card to-transparent transition-opacity duration-200 ${mainCalendarScrollFade.top ? 'opacity-100' : 'opacity-0'}`} />
                  <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card to-transparent transition-opacity duration-200 ${mainCalendarScrollFade.bottom ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Follow-ups list</CardTitle>
              <CardDescription>{isLoading ? 'Loading follow-ups…' : `${filteredFollowUps.length} follow-ups match the current filters`}</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Select value={dateFilter} onValueChange={(value: DateFilter) => { setDateFilter(value); setPage(1); }}>
                <SelectTrigger size="sm" className="w-full py-0 sm:w-[150px]" aria-label="Date filter">
                  <SelectValue placeholder="All dates" />
                </SelectTrigger>
                <SelectContent>
                  {dateFilterOptions.map((option: { value: DateFilter; label: string }) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(pageSize)} onValueChange={(value: string) => { setPageSize(Number(value) as PageSize); setPage(1); }}><SelectTrigger size="sm" className="w-full py-0 sm:w-[110px]"><SelectValue aria-label="Rows per page" /></SelectTrigger><SelectContent>{pageSizeOptions.map((option: PageSize) => <SelectItem key={option} value={String(option)}>{option} rows</SelectItem>)}</SelectContent></Select>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:justify-end"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {isLoading ? <Card><CardContent className="p-6 text-muted-foreground">Loading reminders…</CardContent></Card> : null}
              {!isLoading && filteredFollowUps.length === 0 ? <Empty className="rounded-xl border bg-card py-12 text-card-foreground"><EmptyHeader><EmptyMedia variant="icon"><CalendarCheck className="h-6 w-6" /></EmptyMedia><EmptyTitle>No follow-ups match your filters</EmptyTitle><EmptyDescription>Clear filters or create a follow-up to keep your next outreach visible.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => { setCreateOpen(true); setForm(createDefaultFollowUp()); }}><Plus className="h-4 w-4" /> Follow-up</Button></EmptyContent></Empty> : null}
              {paginatedFollowUps.map((item: FollowUp) => renderFollowUpCard(item))}
            </div>
          </CardContent>
          {paginatedFollowUps.length > 0 ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 md:flex md:justify-center"><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</Button><span className="whitespace-nowrap text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current: number) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</Button></div> : null}
        </Card>
      )}

      <Dialog open={Boolean(completeInteractionForm)} onOpenChange={(open: boolean) => { if (!open) setCompleteInteractionForm(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete follow-up</DialogTitle>
            <DialogDescription>Complete this follow-up only, or log the completed touchpoint as an interaction.</DialogDescription>
          </DialogHeader>
          {completeInteractionForm ? (
            <form className="grid gap-5" onSubmit={completeWithInteraction}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label>Interaction date</Label>
                  <Popover>
                    <PopoverTrigger asChild><Button type="button" variant="outline" className="h-11 w-full justify-start bg-white text-left font-normal text-foreground dark:bg-card dark:text-card-foreground"><CalendarIcon className="mr-2 h-4 w-4" />{formatDisplayDate(completeInteractionForm.interactionDate)}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={completeInteractionForm.interactionDate} onSelect={(date: Date | undefined) => { if (date) updateCompleteInteractionForm('interactionDate', date); }} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2.5">
                  <Label>Type</Label>
                  <Select value={completeInteractionForm.interactionTypeKey} onValueChange={(value: string) => updateCompleteInteractionForm('interactionTypeKey', value as InteractionInteractionTypeKey)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(InteractionInteractionTypeKeyToLabel).filter(([key]: [string, string]) => Boolean(key)).map(([key, label]: [string, string]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-5">
                <div className="space-y-2.5">
                  <Label>Contact <span className="text-destructive">*</span></Label>
                  <RefinedSearchBox id="complete-interaction-contact" value={completeInteractionForm.contactId ? getContactById(completeInteractionForm.contactId)?.contactName ?? completeInteractionForm.contactSearch : completeInteractionForm.contactSearch} options={contactOptions} placeholder={selectedCompleteApplication?.company?.companyName ? `Search contacts at ${selectedCompleteApplication.company?.companyName}` : 'Search contacts'} emptyLabel="No contacts found" createLabel="Use contact" disabled={completeInteractionForm.followUp.relatedTypeKey === 'Contact'} onChange={(nextValue: string, selectedId?: string) => { updateCompleteInteractionForm('contactSearch', nextValue); if (selectedId) { updateCompleteInteractionForm('contactId', selectedId); const selectedContact = getContactById(selectedId); const selectedApplication = getApplicationById(completeInteractionForm.applicationId); if (selectedContact?.company?.id && selectedApplication?.company?.id && selectedContact.company?.id !== selectedApplication.company?.id) { updateCompleteInteractionForm('applicationSearch', ''); updateCompleteInteractionForm('applicationId', ''); } } else if (!nextValue.trim()) updateCompleteInteractionForm('contactId', ''); }} onClear={() => { updateCompleteInteractionForm('contactSearch', ''); updateCompleteInteractionForm('contactId', ''); }} />
                </div>
                <div className="space-y-2.5">
                  <Label>Related application</Label>
                  <RefinedSearchBox id="complete-interaction-application" value={completeInteractionForm.applicationId ? getApplicationById(completeInteractionForm.applicationId)?.role ?? completeInteractionForm.applicationSearch : completeInteractionForm.applicationSearch} options={applicationOptions} placeholder={selectedCompleteContact?.company?.companyName ? `Search applications at ${selectedCompleteContact.company?.companyName}` : 'Search applications'} emptyLabel="No applications found" createLabel="Use application" disabled={completeInteractionForm.followUp.relatedTypeKey === 'Application'} onChange={(nextValue: string, selectedId?: string) => { updateCompleteInteractionForm('applicationSearch', nextValue); if (selectedId) { updateCompleteInteractionForm('applicationId', selectedId); const selectedApplication = getApplicationById(selectedId); const selectedContact = getContactById(completeInteractionForm.contactId); if (selectedApplication?.company?.id && selectedContact?.company?.id && selectedApplication.company?.id !== selectedContact.company?.id) { updateCompleteInteractionForm('contactSearch', ''); updateCompleteInteractionForm('contactId', ''); } } else if (!nextValue.trim()) updateCompleteInteractionForm('applicationId', ''); }} onClear={() => { updateCompleteInteractionForm('applicationSearch', ''); updateCompleteInteractionForm('applicationId', ''); }} />
                </div>
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
      <Dialog open={Boolean(editingId && editForm)} onOpenChange={(open: boolean) => { if (!open) cancelEdit(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit follow-up</DialogTitle>
            <DialogDescription>Update the reminder details or delete it.</DialogDescription>
          </DialogHeader>
          {editingFollowUp && editForm ? (
            <FollowUpForm value={editForm} onChange={updateEditForm} onSubmit={handleEditFollowUp} pending={updateFollowUp.isPending} submitLabel="Save changes" lockRelationship contacts={contacts} applications={applications} rightAction={<Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>} secondaryAction={<>{editingFollowUp.statusKey === 'Open' ? <Button type="button" variant="outline" onClick={handleMarkCompleteEditingFollowUp} disabled={updateFollowUp.isPending}><Check className="h-4 w-4" /> Mark complete</Button> : editingFollowUp.statusKey === 'Completed' ? <Button type="button" variant="outline" onClick={() => handleReopenEditingFollowUp(editingFollowUp)} disabled={updateFollowUp.isPending}><RotateCcw className="h-4 w-4" /> Reopen</Button> : null}<Button type="button" variant="ghost" size="icon-sm" className="group text-destructive hover:bg-background hover:text-destructive" onClick={() => requestDelete(editingFollowUp)} disabled={deleteFollowUp.isPending} aria-label={`Delete ${editingFollowUp.title}`}><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button></>} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCandidate !== null} onOpenChange={(open: boolean) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure you want to delete this item?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {deleteCandidate?.title ?? 'this item'}. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="delete-confirm-button" onClick={confirmDelete} disabled={deleteFollowUp.isPending}>{deleteFollowUp.isPending ? 'Deleting…' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={discardAction !== null} onOpenChange={(open: boolean) => { if (!open) setDiscardAction(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>You have unsaved changes in this form. If you exit now, those changes will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { discardAction?.(); setDiscardAction(null); }}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';
import type { FollowUp, FollowUpRelatedTypeKey, FollowUpStatusKey } from '@/generated/models/follow-up-model';
import type { JobApplication } from '@/generated/models/job-application-model';
import type { NetworkingContact } from '@/generated/models/networking-contact-model';
import { cn } from '@/lib/utils';
import { dateKeyToLocalDate, isFollowUpOverdue, toDateKey } from '@/lib/follow-up-utils';
import { formatDisplayDate } from '@/lib/display-date';

export type FollowUpFormValue = Omit<FollowUp, 'id'>;



const relatedTypeOptions: Array<{ key: FollowUpRelatedTypeKey; label: string }> = [
  { key: 'Contact', label: 'Contact' },
  { key: 'Application', label: 'Application' },
  { key: 'NoneStandalone', label: 'Standalone' },
];

type RelatedItemSelectorProps = {
  label: string;
  value?: string;
  placeholder: string;
  emptyMessage: string;
  items: Array<{ id: string; primary: string; secondary?: string; search: string }>;
  onSelect: (id: string) => void;
};

function RelatedItemSelector({ label, value, placeholder, emptyMessage, items, onSelect }: RelatedItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item: { id: string; primary: string; secondary?: string; search: string }) => item.id === value);
  const requiredMark = <span className="text-destructive" aria-hidden="true">*</span>;

  return (
    <div className="min-w-0 space-y-2">
      <Label className="leading-4">{label} {requiredMark}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-11 min-w-0 w-full max-w-full justify-between overflow-hidden border-input bg-white font-normal text-foreground shadow-sm hover:bg-white hover:text-foreground focus-visible:ring-0 dark:bg-card dark:text-card-foreground dark:hover:bg-card">
            <span className="min-w-0 flex-1 truncate text-left">{selectedItem ? `${selectedItem.primary}${selectedItem.secondary ? ` — ${selectedItem.secondary}` : ''}` : placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-50 w-[var(--radix-popover-trigger-width)] border-border bg-popover p-0 text-popover-foreground shadow-md" onWheel={(event: React.WheelEvent<HTMLDivElement>) => event.stopPropagation()} onTouchMove={(event: React.TouchEvent<HTMLDivElement>) => event.stopPropagation()}>
          <Command className="bg-popover text-popover-foreground [&_[cmdk-group]]:p-0 [&_[data-slot=command-input-wrapper]]:m-0 [&_[data-slot=command-input-wrapper]]:h-10 [&_[data-slot=command-input-wrapper]]:rounded-none [&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-border [&_[data-slot=command-input-wrapper]]:bg-transparent [&_[data-slot=command-input-wrapper]]:text-popover-foreground [&_[data-slot=command-input-wrapper]]:shadow-none [&_[data-slot=command-input-wrapper]]:ring-0 [&_[data-slot=command-input-wrapper]]:outline-none [&_[data-slot=command-input-wrapper]]:focus-within:ring-0 [&_[data-slot=command-input]]:h-10 [&_[data-slot=command-input]]:rounded-none [&_[data-slot=command-input]]:border-0 [&_[data-slot=command-input]]:bg-transparent [&_[data-slot=command-input]]:shadow-none [&_[data-slot=command-input]]:ring-0 [&_[data-slot=command-input]]:outline-none [&_[data-slot=command-input]]:focus-visible:ring-0 [&_[data-slot=command-input]]:focus-visible:outline-none">
            <CommandInput placeholder={placeholder} />
            <CommandList className="max-h-[220px] overflow-y-auto overscroll-contain">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {items.filter((item: { id: string; primary: string; secondary?: string; search: string }) => item.id).map((item: { id: string; primary: string; secondary?: string; search: string }) => (
                  <CommandItem
                    key={item.id}
                    value={item.search}
                    onSelect={() => {
                      onSelect(item.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('h-4 w-4', value === item.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="min-w-0">
                      <p className="truncate">{item.primary}</p>
                      {item.secondary ? <p className="truncate text-xs text-muted-foreground">{item.secondary}</p> : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
const toDate = (value?: string) => dateKeyToLocalDate(value);
const getApplicationCompanyName = (application: JobApplication): string => application.company?.companyName ?? 'Unknown company';


export const createDefaultFollowUp = (overrides?: Partial<FollowUpFormValue>): FollowUpFormValue => ({
  title: '',
  dueDate: format(new Date(), 'yyyy-MM-dd'),
  statusKey: 'Open',
  relatedTypeKey: 'NoneStandalone',
  notes: '',

  ...overrides,
});

type FollowUpFormProps = {
  value: FollowUpFormValue;
  onChange: (field: keyof FollowUpFormValue, value: FollowUpFormValue[keyof FollowUpFormValue]) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  submitLabel: string;
  lockRelationship?: boolean;
  contacts?: NetworkingContact[];
  applications?: JobApplication[];
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;

};
export function FollowUpForm({ value, onChange, onSubmit, pending, submitLabel, lockRelationship = false, contacts = [], applications = [], leftAction, rightAction, secondaryAction }: FollowUpFormProps) {
  const isOverdue = isFollowUpOverdue(value);
  const setDate = (date?: Date) => {
    const nextDateKey = date ? toDateKey(date) : '';
    onChange('dueDate', nextDateKey);

  };
  const requiredMark = <span className="text-destructive" aria-hidden="true">*</span>;


  const handleRelatedTypeChange = (nextValue: FollowUpRelatedTypeKey) => {
    onChange('relatedTypeKey', nextValue);
    if (nextValue !== 'Contact') onChange('relatedContact', undefined);
    if (nextValue !== 'Application') onChange('relatedApplication', undefined);
  };
  const handleContactChange = (contactId: string) => {
    const selectedContact = contacts.find((contact: NetworkingContact) => contact.id === contactId);
    onChange('relatedContact', selectedContact ? { id: selectedContact.id, contactName: selectedContact.contactName } : undefined);
  };
  const handleApplicationChange = (applicationId: string) => {
    const selectedApplication = applications.find((application: JobApplication) => application.id === applicationId);
    onChange('relatedApplication', selectedApplication ? { id: selectedApplication.id, role: selectedApplication.role } : undefined);
  };
  const contactItems = contacts.map((contact: NetworkingContact) => {
    const companyName = contact.company?.companyName;
    return {
      id: contact.id,
      primary: contact.contactName,
      secondary: companyName,
      search: `${contact.contactName} ${companyName ?? ''}`,
    };
  });
  const applicationItems = applications.map((application: JobApplication) => {
    const companyName = getApplicationCompanyName(application);
    return {
      id: application.id,
      primary: application.role,
      secondary: companyName,
      search: `${application.role} ${companyName} ${application.city ?? ''} ${application.jobID ?? ''}`,
    };
  });
  const associatedLabel = value.relatedTypeKey === 'Contact'
    ? (() => {
      const contact = contacts.find((item: NetworkingContact) => item.id === value.relatedContact?.id);
      const contactName = contact?.contactName ?? value.relatedContact?.contactName ?? 'No contact associated';
      const companyName = contact?.company?.companyName;
      return companyName ? `${contactName} - ${companyName}` : contactName;
    })()
    : value.relatedTypeKey === 'Application'
      ? (() => {
        const application = applications.find((item: JobApplication) => item.id === value.relatedApplication?.id);
        const role = application?.role ?? value.relatedApplication?.role ?? 'No application associated';
        const jobId = application?.jobID ? ` (${application.jobID})` : '';
        const companyName = application?.company?.companyName ?? 'Company not recorded';
        return `${role}${jobId} - ${companyName}`;
      })()
      : 'Standalone follow-up';

  return (
    <form className="grid w-full min-w-0 max-w-full gap-x-5 gap-y-4 md:grid-cols-2" onSubmit={onSubmit}>
      <div className="min-w-0 max-w-full space-y-2 md:col-span-2">
        <Label htmlFor="follow-up-title" className="leading-4">Title {requiredMark}</Label>
        <Input id="follow-up-title" className="h-11 min-w-0 max-w-full" value={value.title} required onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('title', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="leading-4">Due date {requiredMark}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={cn('h-11 w-full justify-start bg-white text-left font-normal text-foreground shadow-sm hover:bg-white hover:text-foreground dark:bg-card dark:text-card-foreground dark:hover:bg-card', !value.dueDate && 'text-muted-foreground', isOverdue && 'border-destructive text-foreground ring-1 ring-inset ring-destructive')}>
              {isOverdue ? <CircleAlert className="mr-2 h-4 w-4 text-destructive" aria-hidden="true" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
              {value.dueDate ? formatDisplayDate(value.dueDate) : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto bg-white p-0 text-foreground dark:bg-card dark:text-card-foreground">
            <Calendar mode="single" selected={toDate(value.dueDate)} onSelect={(date?: Date) => setDate(date)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label htmlFor="follow-up-status" className="leading-4">Status {requiredMark}</Label>
        <Input id="follow-up-status" value={value.statusKey === 'Open' ? 'Open' : 'Completed'} readOnly className="h-11 bg-muted text-muted-foreground" />
      </div>
      <div className="min-w-0 space-y-2">
        <Label className="leading-4">Type {requiredMark}</Label>
        <Select value={value.relatedTypeKey} onValueChange={handleRelatedTypeChange} disabled={lockRelationship}>
          <SelectTrigger className={lockRelationship ? 'h-11 bg-muted text-muted-foreground' : 'h-11'}><SelectValue /></SelectTrigger>
          <SelectContent>
            {relatedTypeOptions.filter((option: { key: FollowUpRelatedTypeKey; label: string }) => option.key).map((option: { key: FollowUpRelatedTypeKey; label: string }) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {value.statusKey === 'Completed' ? (
        <div className="min-w-0 max-w-full space-y-2">
          <Label htmlFor="follow-up-completed-date" className="leading-4">Completed on</Label>
          <Input id="follow-up-completed-date" value={formatDisplayDate(value.completedDate || format(new Date(), 'yyyy-MM-dd'))} readOnly className="h-11 bg-muted text-muted-foreground" />
        </div>
      ) : null}
      {value.relatedTypeKey === 'Contact' && !lockRelationship ? (
        <div className="md:col-span-2"><RelatedItemSelector label="Contact" value={value.relatedContact?.id} placeholder="Search contacts" emptyMessage="No contacts found." items={contactItems} onSelect={handleContactChange} /></div>
      ) : null}
      {value.relatedTypeKey === 'Application' && !lockRelationship ? (
        <div className="md:col-span-2"><RelatedItemSelector label="Application" value={value.relatedApplication?.id} placeholder="Search applications" emptyMessage="No active applications found." items={applicationItems} onSelect={handleApplicationChange} /></div>
      ) : null}
      {lockRelationship && value.relatedTypeKey !== 'NoneStandalone' ? (
        <div className="min-w-0 max-w-full space-y-2 md:col-span-2">
          <Label htmlFor="follow-up-associated-item" className="leading-4">Associated {value.relatedTypeKey === 'Contact' ? 'contact' : 'application'}</Label>
          <Input id="follow-up-associated-item" value={associatedLabel} readOnly className="h-11 min-w-0 max-w-full bg-muted text-muted-foreground" />
        </div>
      ) : null}
      <div className="min-w-0 max-w-full space-y-2 md:col-span-2">
        <Label htmlFor="follow-up-notes" className="leading-4">Notes</Label>
        <Textarea id="follow-up-notes" className="min-h-28 min-w-0 max-w-full resize-y whitespace-pre-wrap break-words [overflow-wrap:anywhere]" wrap="soft" value={value.notes ?? ''} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange('notes', event.target.value)} />
      </div>


      <div className="flex flex-wrap items-center gap-2 pt-1 md:col-span-2">
        {leftAction}
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
        {rightAction}
        {secondaryAction ? <div className="ml-auto flex items-center gap-2 whitespace-nowrap">{secondaryAction}</div> : null}
      </div>
    </form>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RefinedSearchBox, type RefinedSearchOption } from '@/components/refined-search-box';
import type { JobApplication, JobApplicationArrangementKey, JobApplicationStageKey } from '@/generated/models/job-application-model';
import type { Company } from '@/generated/models/company-model';
import type { NetworkingContact } from '@/generated/models/networking-contact-model';
import type { BusinessGroup } from '@/generated/models/business-group-model';

import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/display-date';
import { dateKeyToLocalDate, toDateKey } from '@/lib/follow-up-utils';

export type JobApplicationFormValue = {
  role: string;
  companyName: string;
  companyId?: string;
  businessGroupName?: string;
  businessGroupId?: string;
  arrangementKey?: JobApplicationArrangementKey;
  jobID?: string;
  city?: string;
  stageKey: JobApplicationStageKey;
  jobLink?: string;
  contactIds: string[];
  dateApplied?: string;
  nextStep?: string;
  notes?: string;
};

export const createDefaultApplicationForm = (): JobApplicationFormValue => ({
  role: '',
  companyName: '',
  businessGroupName: '',
  arrangementKey: 'Hybrid',
  jobID: '',
  city: '',
  stageKey: 'Applied',
  contactIds: [],
  jobLink: '',
  dateApplied: format(new Date(), 'yyyy-MM-dd'),
  nextStep: '',
  notes: '',
});
export const initialApplicationForm = createDefaultApplicationForm();

const stageOptions: Array<{ key: JobApplicationStageKey; label: string }> = [
  { key: 'Researching', label: 'Researching' },
  { key: 'Applied', label: 'Applied' },
  { key: 'Interviewing', label: 'Interviewing' },
  { key: 'Offer', label: 'Offer' },
  { key: 'Closed', label: 'Closed' },
];



const arrangementOptions: Array<{ key: JobApplicationArrangementKey; label: string }> = [
  { key: 'Remote', label: 'Remote' },
  { key: 'Hybrid', label: 'Hybrid' },
  { key: 'OnSite', label: 'On-site' },
];


const toDate = (value?: string) => dateKeyToLocalDate(value);
const optionalText = (text?: string) => text?.trim() ? text.trim() : undefined;

export const toApplicationFormValue = (application: JobApplication, contactIds: string[] = []): JobApplicationFormValue => ({
  role: application.role,
  companyName: application.company?.companyName ?? '',
  companyId: application.company?.id,
  businessGroupName: application.businessGroup?.businessGroupName ?? '',
  businessGroupId: application.businessGroup?.id,
  arrangementKey: application.arrangementKey,
  jobID: application.jobID ?? '',
  city: application.city ?? '',
  contactIds,
  stageKey: application.stageKey,
  jobLink: application.jobLink ?? '',
  dateApplied: application.dateApplied ?? '',
  nextStep: application.nextStep ?? '',
  notes: application.notes ?? '',
});

export function toApplicationPayload(value: JobApplicationFormValue, company: Pick<Company, 'id' | 'companyName'>, businessGroup?: Pick<BusinessGroup, 'id' | 'businessGroupName'> | null): Omit<JobApplication, 'id'> & { businessGroup?: Pick<BusinessGroup, 'id' | 'businessGroupName'> | null } {
  return {
    role: value.role.trim(),
    company,
    businessGroup: businessGroup ?? undefined,
    arrangementKey: value.arrangementKey,
    stageKey: value.stageKey,
    jobID: optionalText(value.jobID),
    city: optionalText(value.city),
    jobLink: optionalText(value.jobLink),
    dateApplied: optionalText(value.dateApplied),
    nextStep: optionalText(value.nextStep),
    notes: optionalText(value.notes),
  };
}

type ApplicationFormProps = {
  value: JobApplicationFormValue;
  onChange: (field: keyof JobApplicationFormValue, value: string | string[]) => void;
  contacts?: NetworkingContact[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  submitLabel: string;
  companies?: Company[];
  businessGroups?: BusinessGroup[];
  deleteAction?: React.ReactNode;


  onCreateCompany?: (name: string) => void;
  onCreateBusinessGroup?: (name: string) => void;
};



export function ApplicationForm({ value, onChange, onSubmit, pending, submitLabel, companies = [], businessGroups = [], contacts = [], deleteAction, onCreateCompany, onCreateBusinessGroup }: ApplicationFormProps) {
  const setDate = (field: 'dateApplied', date?: Date) => onChange(field, date ? toDateKey(date) : '');
  const requiredMark = <span className="text-destructive" aria-hidden="true">*</span>;
  const companyOptions = companies
    .filter((company: Company) => Boolean(company.id && company.companyName?.trim()))
    .sort((first: Company, second: Company) => first.companyName.localeCompare(second.companyName));
  const selectedCompanyId = value.companyId || companyOptions.find((company: Company) => company.companyName.toLowerCase() === value.companyName.trim().toLowerCase())?.id;

  const hasCompanyName = Boolean(value.companyName.trim());
  const [contactSearch, setContactSearch] = useState('');
  const contactOptions = contacts
    .filter((contact: NetworkingContact) => Boolean(contact.id && contact.contactName?.trim()))
    .filter((contact: NetworkingContact) => Boolean(selectedCompanyId && contact.company?.id === selectedCompanyId))
    .sort((first: NetworkingContact, second: NetworkingContact) => first.contactName.localeCompare(second.contactName));
  const filteredContactOptions = contactOptions.filter((contact: NetworkingContact) => {
    const normalizedSearch = contactSearch.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return [contact.contactName, contact.role, contact.email, contact.city, contact.businessGroup?.businessGroupName].some((fieldValue: string | undefined) => fieldValue?.toLowerCase().includes(normalizedSearch));
  });
  const selectedContacts = contactOptions.filter((contact: NetworkingContact) => value.contactIds.includes(contact.id));
  const selectedContactLabel = selectedContacts.length === 0 ? 'Select contacts' : selectedContacts.length === 1 ? selectedContacts[0].contactName : `${selectedContacts.length} contacts selected`;
  const toggleContact = (contactId: string, checked: boolean) => {
    onChange('contactIds', checked ? Array.from(new Set([...value.contactIds, contactId])) : value.contactIds.filter((id: string) => id !== contactId));
  };
  const businessGroupOptions = businessGroups
    .filter((group: BusinessGroup) => Boolean(group.id && group.businessGroupName?.trim()))
    .filter((group: BusinessGroup) => Boolean(selectedCompanyId && group.company?.id === selectedCompanyId))
    .sort((first: BusinessGroup, second: BusinessGroup) => first.businessGroupName.localeCompare(second.businessGroupName));
  const companySearchOptions: RefinedSearchOption[] = companyOptions.map((company: Company) => ({ id: company.id, label: company.companyName }));
  const businessGroupSearchOptions: RefinedSearchOption[] = selectedCompanyId ? businessGroupOptions.map((group: BusinessGroup) => ({ id: group.id, label: group.businessGroupName, description: value.companyName })) : [];
  const businessGroupEmptyLabel = hasCompanyName ? `No groups by this name for ${value.companyName.trim()}` : 'Enter a company first';
  const handleCompanyChange = (nextName: string, selectedId?: string) => {
    const matchedCompany = selectedId ? companyOptions.find((company: Company) => company.id === selectedId) : companyOptions.find((company: Company) => company.companyName.toLowerCase() === nextName.trim().toLowerCase());
    onChange('companyName', nextName);
    onChange('companyId', matchedCompany?.id ?? '');
    onChange('businessGroupName', '');
    onChange('businessGroupId', '');
    onChange('contactIds', []);
  };
  const handleBusinessGroupChange = (nextName: string, selectedId?: string) => {
    const matchedGroup = selectedId ? businessGroupOptions.find((group: BusinessGroup) => group.id === selectedId) : businessGroupOptions.find((group: BusinessGroup) => group.businessGroupName.toLowerCase() === nextName.trim().toLowerCase());
    onChange('businessGroupName', nextName);
    onChange('businessGroupId', matchedGroup?.id ?? '');
  };
  return (
    <form className="grid gap-x-5 gap-y-5 md:grid-cols-2" onSubmit={onSubmit}>
      <div className="space-y-2.5">
        <Label htmlFor="application-role">Role {requiredMark}</Label>
        <Input id="application-role" className="h-11" value={value.role} required onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('role', event.target.value)} />
      </div>
      <div className="space-y-2.5"><Label>Stage {requiredMark}</Label><Select value={value.stageKey} onValueChange={(nextValue: JobApplicationStageKey) => onChange('stageKey', nextValue)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{stageOptions.filter((option: { key: JobApplicationStageKey; label: string }) => option.key).map((option: { key: JobApplicationStageKey; label: string }) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2.5"><Label htmlFor="application-company">Company {requiredMark}</Label><RefinedSearchBox id="application-company" value={value.companyName} options={companySearchOptions} placeholder="Search or type a new company" emptyLabel="No matching companies" createLabel="Create company" onChange={handleCompanyChange} onCreate={onCreateCompany} /></div>
      <div className="space-y-2.5"><Label htmlFor="application-business-group">Business group</Label><RefinedSearchBox id="application-business-group" value={value.businessGroupName ?? ''} options={businessGroupSearchOptions} placeholder={hasCompanyName ? 'Search or type a new business group' : 'Enter a company first'} emptyLabel={businessGroupEmptyLabel} createLabel="Create business group" disabled={!hasCompanyName} onChange={handleBusinessGroupChange} onCreate={onCreateBusinessGroup} onClear={() => { onChange('businessGroupName', ''); onChange('businessGroupId', ''); }} /></div>
      <div className="space-y-2.5"><Label htmlFor="application-job-id">Job ID</Label><Input id="application-job-id" className="h-11" value={value.jobID ?? ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('jobID', event.target.value)} /></div>
      <div className="space-y-2.5"><Label htmlFor="application-job-link">Job Link</Label><Input id="application-job-link" className="h-11" value={value.jobLink ?? ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('jobLink', event.target.value)} /></div>
      <div className="space-y-2.5"><Label>Work Arrangement</Label><Select value={value.arrangementKey ?? 'Hybrid'} onValueChange={(nextValue: JobApplicationArrangementKey) => onChange('arrangementKey', nextValue)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{arrangementOptions.filter((option: { key: JobApplicationArrangementKey; label: string }) => option.key).map((option: { key: JobApplicationArrangementKey; label: string }) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2.5"><Label htmlFor="application-city">City</Label><Input id="application-city" className="h-11" value={value.city ?? ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('city', event.target.value)} /></div>
      <div className="space-y-2.5">
        <Label>Date Applied</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={cn('h-11 w-full justify-start bg-white text-left font-normal text-foreground shadow-sm hover:bg-white hover:text-foreground dark:bg-card dark:text-card-foreground dark:hover:bg-card', !value.dateApplied && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value.dateApplied ? formatDisplayDate(value.dateApplied) : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto bg-white p-0 text-foreground dark:bg-card dark:text-card-foreground">
            <Calendar mode="single" selected={toDate(value.dateApplied)} onSelect={(date?: Date) => setDate('dateApplied', date)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2.5"><Label htmlFor="application-next-step">Next step</Label><Input id="application-next-step" className="h-11" value={value.nextStep ?? ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange('nextStep', event.target.value)} placeholder="Add the next action" /></div>

      <div className="space-y-2.5 md:col-span-2">
        <Label htmlFor="application-contacts">Associated Contacts</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="application-contacts" type="button" variant="outline" className="h-11 w-full justify-between bg-white font-normal text-foreground dark:bg-card dark:text-card-foreground" disabled={!selectedCompanyId}>
              <span className="truncate">{selectedCompanyId ? selectedContactLabel : 'Select a company first'}</span>
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
            <Input value={contactSearch} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setContactSearch(event.target.value)} placeholder="Search contacts" className="mb-2 h-9" />
            <div className="max-h-64 overscroll-contain space-y-1 overflow-y-auto pr-1" onWheel={(event: React.WheelEvent<HTMLDivElement>) => event.stopPropagation()}>
              {contactOptions.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">{selectedCompanyId ? 'No contacts for this company.' : 'Select a company first.'}</p> : filteredContactOptions.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No contacts match your search.</p> : filteredContactOptions.map((contact: NetworkingContact) => {
                const checked = value.contactIds.includes(contact.id);
                return <button key={contact.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-popover-foreground hover:bg-muted" onClick={() => toggleContact(contact.id, !checked)}><span className="flex h-4 w-4 items-center justify-center rounded-sm border border-input bg-background text-foreground">{checked ? <Check className="h-3 w-3" /> : null}</span><span className="min-w-0 flex-1"><span className="block truncate">{contact.contactName}</span>{contact.role?.trim() ? <span className="block truncate text-xs text-muted-foreground">{contact.role}</span> : null}</span></button>;
              })}
            </div>
            {selectedContacts.length > 0 ? <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange('contactIds', [])}>Clear selected</Button> : null}
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2.5 md:col-span-2"><Label htmlFor="application-notes">Notes</Label><Textarea id="application-notes" className="min-h-28" value={value.notes ?? ''} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange('notes', event.target.value)} placeholder="Add interview details, recruiter notes, or next steps" rows={4} /></div>
      <div className="flex items-center justify-between gap-3 pt-2 md:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>{deleteAction}</div>
    </form>
  );
}

export function ApplicationDeleteButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return <Button type="button" variant="ghost" size="icon-sm" className="group text-destructive hover:bg-card hover:text-destructive" onClick={onClick} disabled={disabled} aria-label="Delete application" title="Delete application"><Trash2 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:-rotate-6" /></Button>;
}

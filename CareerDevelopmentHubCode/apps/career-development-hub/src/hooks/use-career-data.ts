import { useFollowUpList } from '@/generated/hooks/use-follow-up';
import { useCreateJobApplication, useDeleteJobApplication, useJobApplicationList, useUpdateJobApplication } from '@/generated/hooks/use-job-application';
import { useCreateNetworkingContact, useDeleteNetworkingContact, useNetworkingContactList, useUpdateNetworkingContact } from '@/generated/hooks/use-networking-contact';
import {
  JobApplicationArrangementKeyToLabel,
  JobApplicationStageKeyToLabel,
  type JobApplication,
} from '@/generated/models/job-application-model';
import {
  FollowUpRelatedTypeKeyToLabel,
  FollowUpStatusKeyToLabel,
  type FollowUp as FollowUpRecord,
} from '@/generated/models/follow-up-model';
export type ApplicationStage = (typeof JobApplicationStageKeyToLabel)[keyof typeof JobApplicationStageKeyToLabel];


export type FollowUp = FollowUpRecord;

export const dataverseFields = {
  contacts: ['Contact Name'],
  applications: ['Role', 'Job ID', 'Company', 'Business Group', 'Arrangement', 'City', 'Stage', 'Job Link', 'Date Applied', 'Next Step', 'Notes'],
};

export const getCompanyName = (application: JobApplication): string => application.company?.companyName ?? 'Unknown company';
export const getArrangementLabel = (application: JobApplication): string => application.arrangementKey ? (application.arrangementKey === 'OnSite' ? 'On-Site' : JobApplicationArrangementKeyToLabel[application.arrangementKey]) : '';
export const getBusinessGroupName = (application: JobApplication): string => application.businessGroup?.businessGroupName ?? '';
export const getStageLabel = (application: JobApplication): ApplicationStage => JobApplicationStageKeyToLabel[application.stageKey];


export const getFollowUpTypeLabel = (followUp: FollowUpRecord) => FollowUpRelatedTypeKeyToLabel[followUp.relatedTypeKey];
export const getFollowUpStatusLabel = (followUp: FollowUpRecord) => FollowUpStatusKeyToLabel[followUp.statusKey];

export const useContacts = useNetworkingContactList;
export const useApplications = useJobApplicationList;
export const useCreateContact = useCreateNetworkingContact;
export const useCreateApplication = useCreateJobApplication;
export const useUpdateContact = useUpdateNetworkingContact;
export const useUpdateApplication = useUpdateJobApplication;
export const useDeleteContact = useDeleteNetworkingContact;
export const useDeleteApplication = useDeleteJobApplication;

export const useCareerData = () => {
  const contactsQuery = useNetworkingContactList();
  const applicationsQuery = useJobApplicationList();
  const followUpsQuery = useFollowUpList();
  const contacts = contactsQuery.data ?? [];
  const applications = applicationsQuery.data ?? [];
  const followUps = followUpsQuery.data ?? [];

  return {
    contacts,
    applications,
    followUps,
    isLoading: contactsQuery.isLoading || applicationsQuery.isLoading || followUpsQuery.isLoading,
    error: contactsQuery.error ?? applicationsQuery.error ?? followUpsQuery.error,
  };
};

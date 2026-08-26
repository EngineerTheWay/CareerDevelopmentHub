import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { JobApplicationService } from "../services/job-application-service";
import type { JobApplication } from "../models/job-application-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all JobApplication records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, role, arrangementKey, city, dateApplied, jobID, jobLink, nextStep, notes, stageKey
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useJobApplicationList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["jobApplication-list", options],
    queryFn: () => JobApplicationService.getAll(options),
  });
}

/**
 * Retrieve a single JobApplication record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useJobApplication(id: string) {
  return useQuery({
    queryKey: ["jobApplication", id],
    queryFn: () => JobApplicationService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new JobApplication record.
 * @remarks Form validation: use CreateJobApplicationSchema with zodResolver for type-safe create forms
 */
export function useCreateJobApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<JobApplication, "id">) => JobApplicationService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["jobApplication-list"] });
    },
  });
}

/**
 * Update an existing JobApplication record.
 * @remarks Form validation: use UpdateJobApplicationSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateJobApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<JobApplication, "id">>;
    }) => JobApplicationService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["jobApplication-list"] });
      client.invalidateQueries({ queryKey: ["jobApplication", variables.id] });
    },
  });
}

/**
 * Delete a JobApplication record by its unique identifier.
 */
export function useDeleteJobApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => JobApplicationService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["jobApplication-list"] });
      client.invalidateQueries({ queryKey: ["jobApplication", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const JobApplication_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { JobApplicationSchema, CreateJobApplicationSchema, UpdateJobApplicationSchema } from "../validators/job-application-validator";
export type { JobApplicationInput, CreateJobApplicationInput, UpdateJobApplicationInput } from "../validators/job-application-validator";
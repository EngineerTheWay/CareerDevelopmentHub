import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FollowUpService } from "../services/follow-up-service";
import type { FollowUp } from "../models/follow-up-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all FollowUp records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, title, completedDate, dueDate, notes, outlookCalendarId, outlookEventId, relatedTypeKey, reminderAllDay, reminderEnabled, reminderEndAt, reminderLastSyncedAt, reminderSnycStatusKey, reminderStartAt, reminderSyncError, reminderTimeZone, statusKey
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useFollowUpList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["followUp-list", options],
    queryFn: () => FollowUpService.getAll(options),
  });
}

/**
 * Retrieve a single FollowUp record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useFollowUp(id: string) {
  return useQuery({
    queryKey: ["followUp", id],
    queryFn: () => FollowUpService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new FollowUp record.
 * @remarks Form validation: use CreateFollowUpSchema with zodResolver for type-safe create forms
 */
export function useCreateFollowUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<FollowUp, "id">) => FollowUpService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["followUp-list"] });
    },
  });
}

/**
 * Update an existing FollowUp record.
 * @remarks Form validation: use UpdateFollowUpSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateFollowUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<FollowUp, "id">>;
    }) => FollowUpService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["followUp-list"] });
      client.invalidateQueries({ queryKey: ["followUp", variables.id] });
    },
  });
}

/**
 * Delete a FollowUp record by its unique identifier.
 */
export function useDeleteFollowUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FollowUpService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["followUp-list"] });
      client.invalidateQueries({ queryKey: ["followUp", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const FollowUp_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { FollowUpSchema, CreateFollowUpSchema, UpdateFollowUpSchema } from "../validators/follow-up-validator";
export type { FollowUpInput, CreateFollowUpInput, UpdateFollowUpInput } from "../validators/follow-up-validator";
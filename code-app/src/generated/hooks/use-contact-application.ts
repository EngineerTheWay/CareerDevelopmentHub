import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContactApplicationService } from "../services/contact-application-service";
import type { ContactApplication } from "../models/contact-application-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all ContactApplication records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, contactApplicationName
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useContactApplicationList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["contactApplication-list", options],
    queryFn: () => ContactApplicationService.getAll(options),
  });
}

/**
 * Retrieve a single ContactApplication record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useContactApplication(id: string) {
  return useQuery({
    queryKey: ["contactApplication", id],
    queryFn: () => ContactApplicationService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new ContactApplication record.
 * @remarks Form validation: use CreateContactApplicationSchema with zodResolver for type-safe create forms
 */
export function useCreateContactApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ContactApplication, "id">) => ContactApplicationService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["contactApplication-list"] });
    },
  });
}

/**
 * Update an existing ContactApplication record.
 * @remarks Form validation: use UpdateContactApplicationSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateContactApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<ContactApplication, "id">>;
    }) => ContactApplicationService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["contactApplication-list"] });
      client.invalidateQueries({ queryKey: ["contactApplication", variables.id] });
    },
  });
}

/**
 * Delete a ContactApplication record by its unique identifier.
 */
export function useDeleteContactApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ContactApplicationService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["contactApplication-list"] });
      client.invalidateQueries({ queryKey: ["contactApplication", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const ContactApplication_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { ContactApplicationSchema, CreateContactApplicationSchema, UpdateContactApplicationSchema } from "../validators/contact-application-validator";
export type { ContactApplicationInput, CreateContactApplicationInput, UpdateContactApplicationInput } from "../validators/contact-application-validator";
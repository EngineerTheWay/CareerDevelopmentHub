import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NetworkingContactService } from "../services/networking-contact-service";
import type { NetworkingContact } from "../models/networking-contact-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all NetworkingContact records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, contactName, city, email, notes, relationshipKey, role
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useNetworkingContactList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["networkingContact-list", options],
    queryFn: () => NetworkingContactService.getAll(options),
  });
}

/**
 * Retrieve a single NetworkingContact record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useNetworkingContact(id: string) {
  return useQuery({
    queryKey: ["networkingContact", id],
    queryFn: () => NetworkingContactService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new NetworkingContact record.
 * @remarks Form validation: use CreateNetworkingContactSchema with zodResolver for type-safe create forms
 */
export function useCreateNetworkingContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<NetworkingContact, "id">) => NetworkingContactService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["networkingContact-list"] });
    },
  });
}

/**
 * Update an existing NetworkingContact record.
 * @remarks Form validation: use UpdateNetworkingContactSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateNetworkingContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<NetworkingContact, "id">>;
    }) => NetworkingContactService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["networkingContact-list"] });
      client.invalidateQueries({ queryKey: ["networkingContact", variables.id] });
    },
  });
}

/**
 * Delete a NetworkingContact record by its unique identifier.
 */
export function useDeleteNetworkingContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => NetworkingContactService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["networkingContact-list"] });
      client.invalidateQueries({ queryKey: ["networkingContact", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const NetworkingContact_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { NetworkingContactSchema, CreateNetworkingContactSchema, UpdateNetworkingContactSchema } from "../validators/networking-contact-validator";
export type { NetworkingContactInput, CreateNetworkingContactInput, UpdateNetworkingContactInput } from "../validators/networking-contact-validator";
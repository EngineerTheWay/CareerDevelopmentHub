import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BusinessGroupService } from "../services/business-group-service";
import type { BusinessGroup } from "../models/business-group-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all BusinessGroup records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, businessGroupName
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useBusinessGroupList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["businessGroup-list", options],
    queryFn: () => BusinessGroupService.getAll(options),
  });
}

/**
 * Retrieve a single BusinessGroup record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useBusinessGroup(id: string) {
  return useQuery({
    queryKey: ["businessGroup", id],
    queryFn: () => BusinessGroupService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new BusinessGroup record.
 * @remarks Form validation: use CreateBusinessGroupSchema with zodResolver for type-safe create forms
 */
export function useCreateBusinessGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<BusinessGroup, "id">) => BusinessGroupService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["businessGroup-list"] });
    },
  });
}

/**
 * Update an existing BusinessGroup record.
 * @remarks Form validation: use UpdateBusinessGroupSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateBusinessGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<BusinessGroup, "id">>;
    }) => BusinessGroupService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["businessGroup-list"] });
      client.invalidateQueries({ queryKey: ["businessGroup", variables.id] });
    },
  });
}

/**
 * Delete a BusinessGroup record by its unique identifier.
 */
export function useDeleteBusinessGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => BusinessGroupService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["businessGroup-list"] });
      client.invalidateQueries({ queryKey: ["businessGroup", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const BusinessGroup_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { BusinessGroupSchema, CreateBusinessGroupSchema, UpdateBusinessGroupSchema } from "../validators/business-group-validator";
export type { BusinessGroupInput, CreateBusinessGroupInput, UpdateBusinessGroupInput } from "../validators/business-group-validator";
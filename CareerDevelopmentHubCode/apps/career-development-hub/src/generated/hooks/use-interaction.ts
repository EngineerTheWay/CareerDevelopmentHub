import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InteractionService } from "../services/interaction-service";
import type { Interaction } from "../models/interaction-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all Interaction records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, interactionName, interactionDate, interactionTypeKey, notes
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useInteractionList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["interaction-list", options],
    queryFn: () => InteractionService.getAll(options),
  });
}

/**
 * Retrieve a single Interaction record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useInteraction(id: string) {
  return useQuery({
    queryKey: ["interaction", id],
    queryFn: () => InteractionService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new Interaction record.
 * @remarks Form validation: use CreateInteractionSchema with zodResolver for type-safe create forms
 */
export function useCreateInteraction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Interaction, "id">) => InteractionService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["interaction-list"] });
    },
  });
}

/**
 * Update an existing Interaction record.
 * @remarks Form validation: use UpdateInteractionSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateInteraction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<Interaction, "id">>;
    }) => InteractionService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["interaction-list"] });
      client.invalidateQueries({ queryKey: ["interaction", variables.id] });
    },
  });
}

/**
 * Delete a Interaction record by its unique identifier.
 */
export function useDeleteInteraction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => InteractionService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["interaction-list"] });
      client.invalidateQueries({ queryKey: ["interaction", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const Interaction_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { InteractionSchema, CreateInteractionSchema, UpdateInteractionSchema } from "../validators/interaction-validator";
export type { InteractionInput, CreateInteractionInput, UpdateInteractionInput } from "../validators/interaction-validator";
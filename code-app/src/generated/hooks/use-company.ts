import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CompanyService } from "../services/company-service";
import type { Company } from "../models/company-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all Company records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, companyName
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useCompanyList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["company-list", options],
    queryFn: () => CompanyService.getAll(options),
  });
}

/**
 * Retrieve a single Company record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useCompany(id: string) {
  return useQuery({
    queryKey: ["company", id],
    queryFn: () => CompanyService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new Company record.
 * @remarks Form validation: use CreateCompanySchema with zodResolver for type-safe create forms
 */
export function useCreateCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Company, "id">) => CompanyService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["company-list"] });
    },
  });
}

/**
 * Update an existing Company record.
 * @remarks Form validation: use UpdateCompanySchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<Company, "id">>;
    }) => CompanyService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["company-list"] });
      client.invalidateQueries({ queryKey: ["company", variables.id] });
    },
  });
}

/**
 * Delete a Company record by its unique identifier.
 */
export function useDeleteCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => CompanyService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["company-list"] });
      client.invalidateQueries({ queryKey: ["company", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const Company_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { CompanySchema, CreateCompanySchema, UpdateCompanySchema } from "../validators/company-validator";
export type { CompanyInput, CreateCompanyInput, UpdateCompanyInput } from "../validators/company-validator";
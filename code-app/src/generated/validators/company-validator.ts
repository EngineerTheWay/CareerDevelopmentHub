import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for Company validation
 */
export const CompanySchema = z.object({
  id: guid(),
  companyName: z.string().min(1, { message: "Company Name is required" }),
});

/**
 * Schema for creating a new Company (omits system-generated ID)
 */
export const CreateCompanySchema = CompanySchema.omit({ id: true });

/**
 * Schema for updating an existing Company
 */
export const UpdateCompanySchema = CompanySchema;

export type CompanyInput = z.infer<typeof CompanySchema>;
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for BusinessGroup validation
 */
export const BusinessGroupSchema = z.object({
  id: guid(),
  businessGroupName: z.string().min(1, { message: "Business Group Name is required" }),
  company: z.object({ id: guid(), companyName: z.string() }),
});

/**
 * Schema for creating a new BusinessGroup (omits system-generated ID)
 */
export const CreateBusinessGroupSchema = BusinessGroupSchema.omit({ id: true });

/**
 * Schema for updating an existing BusinessGroup
 */
export const UpdateBusinessGroupSchema = BusinessGroupSchema;

export type BusinessGroupInput = z.infer<typeof BusinessGroupSchema>;
export type CreateBusinessGroupInput = z.infer<typeof CreateBusinessGroupSchema>;
export type UpdateBusinessGroupInput = z.infer<typeof UpdateBusinessGroupSchema>;
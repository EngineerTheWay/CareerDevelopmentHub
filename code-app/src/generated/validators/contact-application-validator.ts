import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for ContactApplication validation
 */
export const ContactApplicationSchema = z.object({
  id: guid(),
  contactApplicationName: z.string().min(1, { message: "Contact Application Name is required" }),
  jobApplication: z.object({ id: guid(), role: z.string() }),
  networkingContact: z.object({ id: guid(), contactName: z.string() }),
});

/**
 * Schema for creating a new ContactApplication (omits system-generated ID)
 */
export const CreateContactApplicationSchema = ContactApplicationSchema.omit({ id: true });

/**
 * Schema for updating an existing ContactApplication
 */
export const UpdateContactApplicationSchema = ContactApplicationSchema;

export type ContactApplicationInput = z.infer<typeof ContactApplicationSchema>;
export type CreateContactApplicationInput = z.infer<typeof CreateContactApplicationSchema>;
export type UpdateContactApplicationInput = z.infer<typeof UpdateContactApplicationSchema>;
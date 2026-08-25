import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for NetworkingContact validation
 */
export const NetworkingContactSchema = z.object({
  id: guid(),
  contactName: z.string().min(1, { message: "Contact Name is required" }),
  businessGroup: z.object({ id: guid(), businessGroupName: z.string() }).optional(),
  city: z.string().optional(),
  company: z.object({ id: guid(), companyName: z.string() }),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  relationshipKey: z.enum(['New', 'Recruiter', 'HiringManager', 'Warm', 'Mentor', 'Dormant']),
  role: z.string().optional(),
});

/**
 * Schema for creating a new NetworkingContact (omits system-generated ID)
 */
export const CreateNetworkingContactSchema = NetworkingContactSchema.omit({ id: true });

/**
 * Schema for updating an existing NetworkingContact
 */
export const UpdateNetworkingContactSchema = NetworkingContactSchema;

export type NetworkingContactInput = z.infer<typeof NetworkingContactSchema>;
export type CreateNetworkingContactInput = z.infer<typeof CreateNetworkingContactSchema>;
export type UpdateNetworkingContactInput = z.infer<typeof UpdateNetworkingContactSchema>;
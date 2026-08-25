import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for Interaction validation
 */
export const InteractionSchema = z.object({
  id: guid(),
  interactionName: z.string(),
  contact: z.object({ id: guid(), contactName: z.string() }),
  interactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").min(1, { message: "Interaction Date is required" }),
  interactionTypeKey: z.enum(['NetworkingChat', 'LinkedIn', 'Email', 'Call', 'Meeting', 'Event', 'Interview', 'Other']),
  notes: z.string().optional(),
  relatedApplication: z.object({ id: guid(), role: z.string() }).optional(),
});

/**
 * Schema for creating a new Interaction (omits system-generated ID)
 */
export const CreateInteractionSchema = InteractionSchema.omit({ id: true });

/**
 * Schema for updating an existing Interaction
 */
export const UpdateInteractionSchema = InteractionSchema;

export type InteractionInput = z.infer<typeof InteractionSchema>;
export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>;
export type UpdateInteractionInput = z.infer<typeof UpdateInteractionSchema>;
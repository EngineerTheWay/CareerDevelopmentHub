import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for FollowUp validation
 */
export const FollowUpSchema = z.object({
  id: guid(),
  title: z.string().min(1, { message: "Title is required" }),
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").min(1, { message: "Due Date is required" }),
  notes: z.string().optional(),
  outlookCalendarId: z.string().optional(),
  outlookEventId: z.string().optional(),
  relatedApplication: z.object({ id: guid(), role: z.string() }).optional(),
  relatedContact: z.object({ id: guid(), contactName: z.string() }).optional(),
  relatedTypeKey: z.enum(['Contact', 'Application', 'NoneStandalone']),
  reminderAllDay: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderEndAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").optional(),
  reminderLastSyncedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").optional(),
  reminderSnycStatusKey: z.enum(['NotSynced', 'Synced', 'Conflict', 'Error']).optional(),
  reminderStartAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").optional(),
  reminderSyncError: z.string().optional(),
  reminderTimeZone: z.string().optional(),
  statusKey: z.enum(['Open', 'Completed']),
});

/**
 * Schema for creating a new FollowUp (omits system-generated ID)
 */
export const CreateFollowUpSchema = FollowUpSchema.omit({ id: true });

/**
 * Schema for updating an existing FollowUp
 */
export const UpdateFollowUpSchema = FollowUpSchema;

export type FollowUpInput = z.infer<typeof FollowUpSchema>;
export type CreateFollowUpInput = z.infer<typeof CreateFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof UpdateFollowUpSchema>;
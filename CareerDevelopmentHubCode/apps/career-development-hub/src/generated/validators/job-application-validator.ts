import { z } from 'zod';

// Dataverse generates sequential GUIDs whose version nibble is `f`, so they are
// not RFC-4122 UUIDs and zod's .uuid() rejects them. Match any hex GUID instead.
const guid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Must be a GUID' });

/**
 * Zod schema for JobApplication validation
 */
export const JobApplicationSchema = z.object({
  id: guid(),
  role: z.string().min(1, { message: "Role is required" }),
  arrangementKey: z.enum(['Remote', 'OnSite', 'Hybrid']).optional(),
  businessGroup: z.object({ id: guid(), businessGroupName: z.string() }).optional(),
  city: z.string().optional(),
  company: z.object({ id: guid(), companyName: z.string() }),
  dateApplied: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  jobID: z.string().optional(),
  jobLink: z.string().url().optional(),
  nextStep: z.string().optional(),
  notes: z.string().optional(),
  stageKey: z.enum(['Researching', 'Applied', 'Interviewing', 'Offer', 'Closed']),
});

/**
 * Schema for creating a new JobApplication (omits system-generated ID)
 */
export const CreateJobApplicationSchema = JobApplicationSchema.omit({ id: true });

/**
 * Schema for updating an existing JobApplication
 */
export const UpdateJobApplicationSchema = JobApplicationSchema;

export type JobApplicationInput = z.infer<typeof JobApplicationSchema>;
export type CreateJobApplicationInput = z.infer<typeof CreateJobApplicationSchema>;
export type UpdateJobApplicationInput = z.infer<typeof UpdateJobApplicationSchema>;
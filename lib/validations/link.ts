import { z } from "zod";

export const addLinkSchema = z.object({
  targetCaseId: z.string().uuid(), // UUID of the case to link to
  note: z.string().max(500).optional(),
});

export type AddLinkInput = z.infer<typeof addLinkSchema>;

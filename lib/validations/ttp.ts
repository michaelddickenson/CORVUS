import { z } from "zod";

export const addTtpSchema = z.object({
  techniqueId:   z.string().min(1).max(20),   // e.g. T1059.001
  techniqueName: z.string().min(1).max(300),
  tactic:        z.string().min(1).max(100),
  description:   z.string().max(5000).optional(), // analyst notes
});

export type AddTtpInput = z.infer<typeof addTtpSchema>;

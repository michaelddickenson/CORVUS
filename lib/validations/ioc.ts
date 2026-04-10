import { z } from "zod";
import { IocType, TLP } from "@prisma/client";

export const addIocSchema = z.object({
  type: z.nativeEnum(IocType),
  value: z.string().min(1).max(2000),
  description: z.string().max(5000).optional(),
  // Stored as 0–100; UI presents LOW/MEDIUM/HIGH mapped to 25/50/75
  confidence: z.number().int().min(0).max(100).default(50),
  tlp: z.nativeEnum(TLP).default("GREEN"),
});

export type AddIocInput = z.infer<typeof addIocSchema>;

import { z } from "zod";
import { IncidentCat, ImpactLevel, Category, TLP, Status, Team, AttackVector, MissionImpact } from "@prisma/client";

export const createCaseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(10000),
  cat: z.nativeEnum(IncidentCat).default("CAT_8"),
  impactLevel: z.nativeEnum(ImpactLevel).default("LOW"),
  category: z.nativeEnum(Category),
  tlp: z.nativeEnum(TLP).default("GREEN"),
  classificationCustom: z.string().max(200).optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
});

export const statusTransitionSchema = z.object({
  status: z.nativeEnum(Status),
});

export const assignCaseSchema = z.object({
  assignedToId: z.string().uuid().nullable(),
});

export const addNoteSchema = z.object({
  body: z.string().min(1).max(50000),
});

export const escalateSchema = z.object({
  targetTeam: z.nativeEnum(Team),
  // Optional context note written into the ESCALATION CaseEntry body
  note: z.string().max(2000).optional(),
});

export const patchIncidentDetailsSchema = z.object({
  incidentStartedAt:  z.string().datetime().optional().nullable(),
  incidentEndedAt:    z.string().datetime().optional().nullable(),
  incidentDetectedAt: z.string().datetime().optional().nullable(),
  incidentReportedAt: z.string().datetime().optional().nullable(),
  detectionSource:    z.string().max(200).optional().nullable(),
  attackVector:       z.nativeEnum(AttackVector).optional().nullable(),
  affectedNetwork:    z.string().max(200).optional().nullable(),
  missionImpact:      z.nativeEnum(MissionImpact).optional().nullable(),
  reportingRequired:  z.boolean().optional(),
  externalTicketId:   z.string().max(200).optional().nullable(),
});
export type PatchIncidentDetailsInput = z.infer<typeof patchIncidentDetailsSchema>;

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
export type AssignCaseInput = z.infer<typeof assignCaseSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type EscalateInput = z.infer<typeof escalateSchema>;

// Valid forward (and back) transitions — TRIAGED removed
export const VALID_TRANSITIONS: Record<Status, Status[]> = {
  NEW:            [Status.IN_PROGRESS],
  IN_PROGRESS:    [Status.PENDING_REVIEW],
  PENDING_REVIEW: [Status.IN_PROGRESS, Status.CLOSED], // IN_PROGRESS = send back
  CLOSED:         [], // terminal
};

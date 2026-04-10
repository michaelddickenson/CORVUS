import { z } from "zod";
import { AssetImpact } from "@prisma/client";

export const addAssetSchema = z.object({
  hostname:    z.string().max(253).optional(),
  ipAddress:   z.string().max(45).optional(),
  macAddress:  z.string().max(17).optional(),
  os:          z.string().max(100).optional(),
  assetType:   z.string().max(100).optional(),
  impact:      z.nativeEnum(AssetImpact).default("SUSPECTED"),
  owner:       z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
}).refine(
  (d) => d.hostname || d.ipAddress || d.macAddress,
  { message: "At least one of hostname, IP address, or MAC address is required." }
);

export type AddAssetInput = z.infer<typeof addAssetSchema>;

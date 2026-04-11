import { prisma } from "@/lib/prisma";

export interface ConfigOptionRow {
  id:         string;
  value:      string;
  label:      string;
  shortLabel: string;
  color:      string | null;
  sortOrder:  number;
  isActive:   boolean;
}

// ---------------------------------------------------------------------------
// 60-second in-memory cache — avoids DB round-trips on every request
// ---------------------------------------------------------------------------
const cache = new Map<string, { data: ConfigOptionRow[]; expiresAt: number }>();

export async function getConfigOptions(category: string): Promise<ConfigOptionRow[]> {
  const now = Date.now();
  const cached = cache.get(category);
  if (cached && cached.expiresAt > now) return cached.data;

  const rows = await prisma.configOption.findMany({
    where: { category, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, value: true, label: true, shortLabel: true, color: true, sortOrder: true, isActive: true },
  });

  cache.set(category, { data: rows, expiresAt: now + 60_000 });
  return rows;
}

export async function getAllConfigOptions(): Promise<ConfigOptionRow[]> {
  const now = Date.now();
  const ALL_KEY = "__all__";
  const cached = cache.get(ALL_KEY);
  if (cached && cached.expiresAt > now) return cached.data;

  const rows = await prisma.configOption.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { id: true, value: true, label: true, shortLabel: true, color: true, sortOrder: true, isActive: true },
  });

  cache.set(ALL_KEY, { data: rows, expiresAt: now + 60_000 });
  return rows;
}

export function invalidateConfigCache(category?: string) {
  if (category) {
    cache.delete(category);
  } else {
    cache.clear();
  }
  cache.delete("__all__");
}

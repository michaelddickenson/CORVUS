import Link from "next/link";
import { CaseQueue } from "@/components/cases/CaseQueue";

export const metadata = { title: "Cases — CORVUS" };

export default function CasesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Cases</h1>
          <p className="text-neutral-400 text-sm mt-0.5">
            All cases across all teams.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
        >
          New Case
        </Link>
      </div>

      <CaseQueue />
    </div>
  );
}

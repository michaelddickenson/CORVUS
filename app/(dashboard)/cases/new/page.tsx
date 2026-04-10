import { NewCaseForm } from "@/components/cases/NewCaseForm";

export const metadata = { title: "New Case — CORVUS" };

export default function NewCasePage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">New Case</h1>
        <p className="text-neutral-400 text-sm mt-0.5">
          Open a new case. A DCO case ID will be assigned automatically.
        </p>
      </div>
      <NewCaseForm />
    </div>
  );
}

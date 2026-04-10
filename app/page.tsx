import { redirect } from "next/navigation";

// Root "/" redirects to the dashboard; middleware handles auth gating.
export default function RootPage() {
  redirect("/dashboard");
}

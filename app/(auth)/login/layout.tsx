import { Suspense } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Wrap in Suspense because useSearchParams() in the login page requires it
  return <Suspense>{children}</Suspense>;
}

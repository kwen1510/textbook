import { SignInForm } from "@/components/SignInForm";
import { SetupNotice } from "@/components/SetupNotice";
import { getMissingSetup } from "@/lib/setup";

const reasonMessages: Record<string, string> = {
  email_not_allowed: "You signed in successfully, but this course is limited to the configured private account.",
  missing_session: "Your session was not found. Please sign in again.",
  auth_error: "Authentication could not be verified. Please try again.",
};

export default async function SignInPage({ searchParams }: { searchParams?: Promise<{ reason?: string }> }) {
  const missing = getMissingSetup().filter((item) => item !== "GROQ_API_KEY" && item !== "DATABASE_URL");
  if (missing.length) return <SetupNotice missing={missing} />;
  const reason = (await searchParams)?.reason;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f0e7] px-4 py-12">
      <div className="w-full max-w-md">
        <SignInForm notice={reason ? reasonMessages[reason] : undefined} />
      </div>
    </main>
  );
}

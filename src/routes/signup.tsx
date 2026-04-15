import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/components/AuthForm";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Sign Up — ExamGuard" },
      { name: "description", content: "Create your ExamGuard account" },
    ],
  }),
});

function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignupForm />
    </div>
  );
}

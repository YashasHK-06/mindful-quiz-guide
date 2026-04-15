import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/AuthForm";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Log In — ExamGuard" },
      { name: "description", content: "Log in to your ExamGuard account" },
    ],
  }),
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <LoginForm />
    </div>
  );
}

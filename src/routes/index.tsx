import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ExamGuard — Secure Online Exam Platform" },
      { name: "description", content: "Proctored online exams with camera monitoring and tab-switch detection." },
    ],
  }),
});

function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role === "teacher") {
      navigate({ to: "/teacher/dashboard" });
    } else if (!loading && user && role === "student") {
      navigate({ to: "/student/dashboard" });
    }
  }, [loading, user, role, navigate]);

  if (loading || (user && !role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && role) {
    // Will redirect via useEffect
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-4">
      {/* Decorative background */}
      <div className="absolute inset-0 -z-10 bg-gradient-subtle" />
      <div className="absolute -top-32 left-1/2 -z-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-gradient-primary opacity-20 blur-3xl" />

      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-3xl shadow-glow">
          🛡️
        </div>
        <h1 className="text-6xl font-extrabold tracking-tight">
          <span className="text-gradient">ExamGuard</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Secure online exams with live proctoring
        </p>
      </div>
      <div className="flex gap-4 animate-scale-in">
        <Link to="/login">
          <Button variant="outline" size="lg" className="hover-lift">Log In</Button>
        </Link>
        <Link to="/signup">
          <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
            Get Started →
          </Button>
        </Link>
      </div>
    </div>
  );
}

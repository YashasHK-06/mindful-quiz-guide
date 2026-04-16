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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
          Exam<span className="text-primary">Guard</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Secure online exams with live proctoring
        </p>
      </div>
      <div className="flex gap-4">
        <Link to="/login">
          <Button variant="outline" size="lg">Log In</Button>
        </Link>
        <Link to="/signup">
          <Button size="lg">Sign Up</Button>
        </Link>
      </div>
    </div>
  );
}

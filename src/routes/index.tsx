import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && !role) {
    // User is logged in but role not yet fetched — show loading
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (user && role === "teacher") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Link to="/teacher/dashboard">
          <Button size="lg">Go to Teacher Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (user && role === "student") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Link to="/student/dashboard">
          <Button size="lg">Go to Student Dashboard</Button>
        </Link>
      </div>
    );
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

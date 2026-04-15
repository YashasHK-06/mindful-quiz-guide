import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/student/dashboard")({
  component: StudentDashboard,
  head: () => ({
    meta: [{ title: "Student Dashboard — ExamGuard" }],
  }),
});

function StudentDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [enrolledExams, setEnrolledExams] = useState<Tables<"exams">[]>([]);
  const [submissions, setSubmissions] = useState<Tables<"submissions">[]>([]);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "student")) navigate({ to: "/login" });
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (user && role === "student") fetchData();
  }, [user, role]);

  async function fetchData() {
    const { data: enrollments } = await supabase
      .from("exam_enrollments")
      .select("exam_id")
      .eq("student_id", user!.id);

    if (enrollments && enrollments.length > 0) {
      const examIds = enrollments.map((e) => e.exam_id);
      const { data: exams } = await supabase.from("exams").select("*").in("id", examIds);
      setEnrolledExams(exams ?? []);
    }

    const { data: subs } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", user!.id);
    setSubmissions(subs ?? []);
  }

  async function handleJoinExam(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc("join_exam_by_code", { _code: code });
      if (error) throw error;
      const result = data as any;
      if (result?.error) {
        if (result.error === "Already enrolled") {
          toast.info(`You're already enrolled in "${result.exam_title}"!`);
        } else {
          toast.error(result.error);
        }
      } else {
        toast.success(`Enrolled in "${result.exam_title}"!`);
      }
      setCode("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to join exam");
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">Student Dashboard</h1>
          <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            Log Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Join Exam */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Join an Exam</CardTitle>
            <CardDescription>Enter the 6-digit exam code from your teacher</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinExam} className="flex gap-3">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="w-40 font-mono text-lg tracking-widest"
              />
              <Button type="submit" disabled={joining || code.length < 6}>
                {joining ? "Joining..." : "Join"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Enrolled Exams */}
        <h2 className="mb-4 text-2xl font-semibold text-foreground">Your Exams</h2>
        {enrolledExams.length === 0 ? (
          <p className="text-muted-foreground">No exams yet. Join one using a code above!</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {enrolledExams.map((exam) => {
              const sub = submissions.find((s) => s.exam_id === exam.id);
              const hasSubmitted = !!sub?.submitted_at;
              return (
                <Card key={exam.id}>
                  <CardHeader>
                    <CardTitle>{exam.title}</CardTitle>
                    <CardDescription>{exam.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex gap-3 text-sm text-muted-foreground">
                      <span>{exam.time_limit_minutes} min</span>
                    </div>
                    {hasSubmitted ? (
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="font-medium">Submitted</span>
                        {sub.score !== null && <span className="ml-2">— Score: {sub.score}</span>}
                      </div>
                    ) : (
                      <Link to="/student/exam/$examId" params={{ examId: exam.id }}>
                        <Button className="w-full">Start Exam</Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

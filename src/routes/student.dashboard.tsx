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
import { BookOpen, Clock, CheckCircle2, KeyRound, LogOut, Sparkles } from "lucide-react";

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

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  const completed = submissions.filter((s) => s.submitted_at).length;
  const pending = enrolledExams.length - completed;

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <header className="bg-gradient-hero text-primary-foreground shadow-glow">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Welcome back 👋</h1>
              <p className="text-sm text-white/80">Student Dashboard</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => { signOut(); navigate({ to: "/" }); }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        {/* Stat cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card className="hover-lift shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="icon-tile" style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 268), oklch(0.7 0.2 295))" }}>
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Enrolled</p>
                <p className="text-2xl font-bold">{enrolledExams.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completed}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Join Exam */}
        <Card className="mb-10 overflow-hidden border-0 shadow-glow">
          <div className="bg-gradient-primary p-[1px]">
            <div className="rounded-[inherit] bg-card">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Join an Exam</CardTitle>
                  <CardDescription>Enter the 6-digit code from your teacher</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinExam} className="flex flex-wrap gap-3">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-44 font-mono text-lg font-bold tracking-[0.4em] uppercase"
                  />
                  <Button
                    type="submit"
                    disabled={joining || code.length < 6}
                    className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity"
                  >
                    {joining ? "Joining..." : "Join Exam"}
                  </Button>
                </form>
              </CardContent>
            </div>
          </div>
        </Card>

        {/* Enrolled Exams */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Your Exams</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {enrolledExams.length} total
          </span>
        </div>

        {enrolledExams.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="icon-tile">
                <BookOpen className="h-6 w-6" />
              </div>
              <p className="text-lg font-medium">No exams yet</p>
              <p className="text-sm text-muted-foreground">Use the form above to join your first exam</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {enrolledExams.map((exam) => {
              const sub = submissions.find((s) => s.exam_id === exam.id);
              const hasSubmitted = !!sub?.submitted_at;
              return (
                <Card key={exam.id} className="group hover-lift overflow-hidden shadow-card">
                  <div className={`h-1 ${hasSubmitted ? "bg-success" : "bg-gradient-primary"}`} />
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{exam.title}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">{exam.description || "No description"}</CardDescription>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        hasSubmitted ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
                      }`}>
                        {hasSubmitted ? "Done" : "Open"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{exam.time_limit_minutes} min</span>
                    </div>
                    {hasSubmitted ? (
                      <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                        <span className="font-medium">✓ Submitted</span>
                        {sub.score !== null && <span className="ml-2 font-semibold">Score: {sub.score}</span>}
                      </div>
                    ) : (
                      <Link to="/student/exam/$examId" params={{ examId: exam.id }}>
                        <Button className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
                          Start Exam →
                        </Button>
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

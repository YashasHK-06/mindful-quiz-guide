import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExamWizard } from "@/components/ExamWizard";

export const Route = createFileRoute("/teacher/dashboard")({
  component: TeacherDashboard,
  head: () => ({
    meta: [{ title: "Teacher Dashboard — ExamGuard" }],
  }),
});

interface ExamStats {
  totalExams: number;
  publishedExams: number;
  totalSubmissions: number;
  totalEnrollments: number;
}

function TeacherDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Tables<"exams">[]>([]);
  const [stats, setStats] = useState<ExamStats>({ totalExams: 0, publishedExams: 0, totalSubmissions: 0, totalEnrollments: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "teacher")) {
      navigate({ to: "/login" });
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (user && role === "teacher") {
      fetchExams();
    }
  }, [user, role]);

  async function fetchExams() {
    const { data } = await supabase
      .from("exams")
      .select("*")
      .eq("teacher_id", user!.id)
      .order("created_at", { ascending: false });

    const examList = data ?? [];
    setExams(examList);

    // Fetch stats
    const examIds = examList.map((e) => e.id);
    let totalSubmissions = 0;
    let totalEnrollments = 0;

    if (examIds.length > 0) {
      const [subsRes, enrollRes] = await Promise.all([
        supabase.from("submissions").select("id", { count: "exact", head: true }).in("exam_id", examIds),
        supabase.from("exam_enrollments").select("id", { count: "exact", head: true }).in("exam_id", examIds),
      ]);
      totalSubmissions = subsRes.count ?? 0;
      totalEnrollments = enrollRes.count ?? 0;
    }

    setStats({
      totalExams: examList.length,
      publishedExams: examList.filter((e) => e.is_published).length,
      totalSubmissions,
      totalEnrollments,
    });
  }


  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Exam<span className="text-primary">Guard</span>
            </h1>
            <p className="text-sm text-muted-foreground">Teacher Dashboard</p>
          </div>
          <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            Log Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Stats Overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Exams</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{stats.totalExams}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Published</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{stats.publishedExams}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Attendees</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{stats.totalEnrollments}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Submissions</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{stats.totalSubmissions}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer transition-colors hover:border-primary">
                  <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">📝</div>
                    <p className="font-semibold text-foreground">Set a Paper</p>
                    <p className="text-xs text-muted-foreground">Create a new exam</p>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Exam</DialogTitle>
                </DialogHeader>
                {dialogOpen && user && (
                  <ExamWizard
                    userId={user.id}
                    onClose={() => setDialogOpen(false)}
                    onCreated={fetchExams}
                  />
                )}
              </DialogContent>
            </Dialog>

            {exams.length > 0 ? (
              <Link to="/teacher/exam/$examId" params={{ examId: exams[0].id }}>
                <Card className="h-full cursor-pointer transition-colors hover:border-primary">
                  <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">✏️</div>
                    <p className="font-semibold text-foreground">Edit Questions</p>
                    <p className="text-xs text-muted-foreground">Manage exam questions</p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card className="opacity-50">
                <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">✏️</div>
                  <p className="font-semibold text-foreground">Edit Questions</p>
                  <p className="text-xs text-muted-foreground">Create an exam first</p>
                </CardContent>
              </Card>
            )}

            {exams.length > 0 ? (
              <Link to="/teacher/exam/$examId/submissions" params={{ examId: exams[0].id }}>
                <Card className="h-full cursor-pointer transition-colors hover:border-primary">
                  <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">📊</div>
                    <p className="font-semibold text-foreground">Analyse Students</p>
                    <p className="text-xs text-muted-foreground">Review submissions</p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card className="opacity-50">
                <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">📊</div>
                  <p className="font-semibold text-foreground">Analyse Students</p>
                  <p className="text-xs text-muted-foreground">Create an exam first</p>
                </CardContent>
              </Card>
            )}

            <Card className="opacity-80">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">👥</div>
                <p className="font-semibold text-foreground">Attendees</p>
                <p className="text-xs text-muted-foreground">{stats.totalEnrollments} enrolled students</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Exams List */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Your Exams</h2>
          </div>

          {exams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-4xl">📋</p>
                <p className="text-lg font-medium text-foreground">No exams yet</p>
                <p className="text-sm text-muted-foreground">Click "Set a Paper" above to create your first exam</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exams.map((exam) => (
                <Card key={exam.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{exam.title}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">{exam.description}</CardDescription>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${exam.is_published ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                        {exam.is_published ? "Live" : "Draft"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>⏱ {exam.time_limit_minutes}m</span>
                      <span>✅ Pass: {exam.passing_score ?? 0}</span>
                    </div>
                    <div className="mb-4 rounded-md bg-muted px-3 py-2">
                      <p className="text-xs text-muted-foreground">Exam Code</p>
                      <p className="font-mono text-lg font-bold tracking-widest text-foreground">{exam.exam_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link to="/teacher/exam/$examId" params={{ examId: exam.id }} className="flex-1">
                        <Button variant="outline" className="w-full" size="sm">Manage</Button>
                      </Link>
                      <Link to="/teacher/exam/$examId/submissions" params={{ examId: exam.id }} className="flex-1">
                        <Button variant="secondary" className="w-full" size="sm">Submissions</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

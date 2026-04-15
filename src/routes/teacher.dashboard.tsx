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
import { signOut, generateExamCode } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/teacher/dashboard")({
  component: TeacherDashboard,
  head: () => ({
    meta: [{ title: "Teacher Dashboard — ExamGuard" }],
  }),
});

function TeacherDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Tables<"exams">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);
  const [passingScore, setPassingScore] = useState(0);
  const [creating, setCreating] = useState(false);

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
    setExams(data ?? []);
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const code = generateExamCode();
      const { error } = await supabase.from("exams").insert({
        teacher_id: user!.id,
        title,
        description,
        time_limit_minutes: timeLimit,
        passing_score: passingScore,
        exam_code: code,
      });
      if (error) throw error;
      toast.success(`Exam created! Code: ${code}`);
      setDialogOpen(false);
      setTitle("");
      setDescription("");
      setTimeLimit(60);
      setPassingScore(0);
      fetchExams();
    } catch (err: any) {
      toast.error(err.message || "Failed to create exam");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">Teacher Dashboard</h1>
          <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            Log Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">Your Exams</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Exam</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Exam</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateExam} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Time Limit (min)</Label>
                    <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Score</Label>
                    <Input type="number" value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} min={0} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating..." : "Create Exam"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {exams.length === 0 ? (
          <p className="text-muted-foreground">No exams yet. Create your first exam!</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {exams.map((exam) => (
              <Card key={exam.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{exam.title}</CardTitle>
                      <CardDescription>{exam.description}</CardDescription>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${exam.is_published ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                      {exam.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{exam.time_limit_minutes} min</span>
                    <span>Pass: {exam.passing_score ?? 0}</span>
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
      </main>
    </div>
  );
}

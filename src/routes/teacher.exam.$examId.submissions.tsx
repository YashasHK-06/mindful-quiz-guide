import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/teacher/exam/$examId/submissions")({
  component: SubmissionsReview,
  head: () => ({
    meta: [{ title: "Review Submissions — ExamGuard" }],
  }),
});

function SubmissionsReview() {
  const { examId } = Route.useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Tables<"exams"> | null>(null);
  const [submissions, setSubmissions] = useState<(Tables<"submissions"> & { profile?: { full_name: string } })[]>([]);
  const [questions, setQuestions] = useState<Tables<"questions">[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && (!user || role !== "teacher")) navigate({ to: "/login" });
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, examId]);

  async function fetchAll() {
    const [examRes, subsRes, qRes] = await Promise.all([
      supabase.from("exams").select("*").eq("id", examId).single(),
      supabase.from("submissions").select("*").eq("exam_id", examId),
      supabase.from("questions").select("*").eq("exam_id", examId).order("sort_order"),
    ]);
    setExam(examRes.data);
    setQuestions(qRes.data ?? []);

    // Fetch profiles for student names
    const subs = subsRes.data ?? [];
    if (subs.length > 0) {
      const studentIds = [...new Set(subs.map((s) => s.student_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      const enriched = subs.map((s) => ({ ...s, profile: profileMap.get(s.student_id) }));
      setSubmissions(enriched);
    } else {
      setSubmissions([]);
    }
  }

  async function updateScore(subId: string) {
    const score = scoreInput[subId];
    if (score === undefined) return;
    const { error } = await supabase.from("submissions").update({ score }).eq("id", subId);
    if (error) toast.error(error.message);
    else { toast.success("Score updated"); fetchAll(); }
  }

  if (authLoading || !exam) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const activeSub = submissions.find((s) => s.id === selectedSub);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{exam.title} — Submissions</h1>
            <p className="text-sm text-muted-foreground">{submissions.length} submission(s)</p>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/teacher/exam/$examId", params: { examId } })}>
            Back to Exam
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {submissions.length === 0 ? (
          <p className="text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              {submissions.map((sub) => (
                <Card
                  key={sub.id}
                  className={`cursor-pointer transition-colors ${selectedSub === sub.id ? "border-primary" : ""}`}
                  onClick={() => setSelectedSub(sub.id)}
                >
                  <CardContent className="p-4">
                    <p className="font-medium">{sub.profile?.full_name || "Unknown Student"}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>Warnings: {sub.warning_count}</span>
                      <span>Score: {sub.score ?? "—"}</span>
                      <span>{sub.submitted_at ? "Submitted" : "In Progress"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeSub && (
              <div className="space-y-4 lg:col-span-2">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <Label>Assign Score</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        className="w-24"
                        value={scoreInput[activeSub.id] ?? activeSub.score ?? ""}
                        onChange={(e) => setScoreInput({ ...scoreInput, [activeSub.id]: Number(e.target.value) })}
                      />
                      <Button size="sm" onClick={() => updateScore(activeSub.id)}>Save</Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Tab warnings: <span className={activeSub.warning_count > 0 ? "font-bold text-destructive" : ""}>{activeSub.warning_count}</span>
                  </div>
                </div>

                {questions.map((q, i) => {
                  const answers = activeSub.answers as Record<string, any>;
                  const answer = answers[q.id];
                  return (
                    <Card key={q.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Q{i + 1}. {q.question_text} <span className="text-xs text-muted-foreground">({q.points} pts)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {q.question_type === "essay" ? (
                          <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                            {answer || <span className="text-muted-foreground italic">No answer</span>}
                          </div>
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {(q.options as string[])?.map((opt, j) => {
                              const selected = Array.isArray(answer) && answer.includes(j);
                              const correct = (q.correct_answers as number[])?.includes(j);
                              return (
                                <li key={j} className={`${selected ? (correct ? "text-green-600 font-medium" : "text-destructive font-medium") : "text-muted-foreground"}`}>
                                  {selected ? "■" : "□"} {opt} {correct && "(correct)"}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

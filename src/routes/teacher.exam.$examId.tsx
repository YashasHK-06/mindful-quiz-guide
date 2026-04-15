import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuestionType = Database["public"]["Enums"]["question_type"];

export const Route = createFileRoute("/teacher/exam/$examId")({
  component: ExamEditor,
  head: () => ({
    meta: [{ title: "Edit Exam — ExamGuard" }],
  }),
});

function ExamEditor() {
  const { examId } = Route.useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Tables<"exams"> | null>(null);
  const [questions, setQuestions] = useState<Tables<"questions">[]>([]);
  const [saving, setSaving] = useState(false);

  // Question form
  const [qDialogOpen, setQDialogOpen] = useState(false);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<QuestionType>("multiple_select");
  const [qPoints, setQPoints] = useState(1);
  const [qOptions, setQOptions] = useState<string[]>(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState<number[]>([]);
  const [editingQId, setEditingQId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || role !== "teacher")) navigate({ to: "/login" });
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchExam();
      fetchQuestions();
    }
  }, [user, examId]);

  async function fetchExam() {
    const { data } = await supabase.from("exams").select("*").eq("id", examId).single();
    setExam(data);
  }

  async function fetchQuestions() {
    const { data } = await supabase.from("questions").select("*").eq("exam_id", examId).order("sort_order");
    setQuestions(data ?? []);
  }

  async function togglePublish() {
    if (!exam) return;
    const { error } = await supabase.from("exams").update({ is_published: !exam.is_published }).eq("id", exam.id);
    if (error) { toast.error(error.message); return; }
    toast.success(exam.is_published ? "Exam unpublished" : "Exam published!");
    fetchExam();
  }

  function resetQForm() {
    setQText("");
    setQType("multiple_select");
    setQPoints(1);
    setQOptions(["", "", "", ""]);
    setQCorrect([]);
    setEditingQId(null);
  }

  function openEditQuestion(q: Tables<"questions">) {
    setEditingQId(q.id);
    setQText(q.question_text);
    setQType(q.question_type);
    setQPoints(q.points);
    setQOptions((q.options as string[]) || ["", "", "", ""]);
    setQCorrect((q.correct_answers as number[]) || []);
    setQDialogOpen(true);
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        exam_id: examId,
        question_text: qText,
        question_type: qType,
        points: qPoints,
        options: qType === "multiple_select" ? qOptions.filter(Boolean) : [],
        correct_answers: qType === "multiple_select" ? qCorrect : [],
        sort_order: questions.length,
      };

      if (editingQId) {
        const { error } = await supabase.from("questions").update(payload).eq("id", editingQId);
        if (error) throw error;
        toast.success("Question updated");
      } else {
        const { error } = await supabase.from("questions").insert(payload);
        if (error) throw error;
        toast.success("Question added");
      }
      setQDialogOpen(false);
      resetQForm();
      fetchQuestions();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Question deleted"); fetchQuestions(); }
  }

  if (authLoading || !exam) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">Code: <span className="font-mono font-bold tracking-widest">{exam.exam_code}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={exam.is_published} onCheckedChange={togglePublish} />
              <span className="text-sm">{exam.is_published ? "Published" : "Draft"}</span>
            </div>
            <Button variant="outline" onClick={() => navigate({ to: "/teacher/dashboard" })}>Back</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>
          <Dialog open={qDialogOpen} onOpenChange={(o) => { setQDialogOpen(o); if (!o) resetQForm(); }}>
            <DialogTrigger asChild>
              <Button>Add Question</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQId ? "Edit Question" : "Add Question"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveQuestion} className="space-y-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select value={qType} onValueChange={(v) => setQType(v as QuestionType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_select">Multiple Select</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea value={qText} onChange={(e) => setQText(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input type="number" value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))} min={1} />
                </div>

                {qType === "multiple_select" && (
                  <div className="space-y-2">
                    <Label>Options (check correct answers)</Label>
                    {qOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={qCorrect.includes(i)}
                          onChange={(e) => {
                            setQCorrect(e.target.checked ? [...qCorrect, i] : qCorrect.filter((x) => x !== i));
                          }}
                          className="h-4 w-4"
                        />
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...qOptions];
                            newOpts[i] = e.target.value;
                            setQOptions(newOpts);
                          }}
                          placeholder={`Option ${i + 1}`}
                        />
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setQOptions([...qOptions, ""])}>
                      + Add option
                    </Button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving..." : editingQId ? "Update Question" : "Add Question"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {questions.length === 0 ? (
          <p className="text-muted-foreground">No questions yet. Add your first question!</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <Card key={q.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      <span className="text-muted-foreground">Q{i + 1}.</span> {q.question_text}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditQuestion(q)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteQuestion(q.id)}>Delete</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-0.5">{q.question_type === "multiple_select" ? "Multiple Select" : "Essay"}</span>
                    <span>{q.points} pts</span>
                  </div>
                  {q.question_type === "multiple_select" && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {(q.options as string[])?.map((opt, j) => (
                        <li key={j} className={(q.correct_answers as number[])?.includes(j) ? "font-medium text-green-600" : "text-muted-foreground"}>
                          {(q.correct_answers as number[])?.includes(j) ? "✓" : "○"} {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

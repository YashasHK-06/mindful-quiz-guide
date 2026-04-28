import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ProctoringOverlay } from "@/components/ProctoringOverlay";
import { ExamTimer } from "@/components/ExamTimer";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/student/exam/$examId")({
  component: ExamTaker,
  head: () => ({
    meta: [{ title: "Taking Exam — ExamGuard" }],
  }),
});

function ExamTaker() {
  const { examId } = Route.useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Tables<"exams"> | null>(null);
  const [questions, setQuestions] = useState<Tables<"questions">[]>([]);
  const [submission, setSubmission] = useState<Tables<"submissions"> | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== "student")) navigate({ to: "/login" });
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, examId]);

  async function fetchData() {
    const [examRes, qRes] = await Promise.all([
      supabase.from("exams").select("*").eq("id", examId).single(),
      supabase.from("questions").select("*").eq("exam_id", examId).order("sort_order"),
    ]);
    setExam(examRes.data);
    setQuestions(qRes.data ?? []);

    // Check existing submission
    const { data: sub } = await supabase
      .from("submissions")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", user!.id)
      .single();

    if (sub) {
      if (sub.submitted_at) {
        toast.info("You've already submitted this exam.");
        navigate({ to: "/student/dashboard" });
        return;
      }
      setSubmission(sub);
      setAnswers((sub.answers as Record<string, any>) || {});
      setWarningCount(sub.warning_count);
      setExamStarted(true);
    }
  }

  async function startExam() {
    // Pre-flight: verify camera + mic permission with a user gesture,
    // then enter fullscreen before the exam begins.
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Confirm both tracks exist
      if (testStream.getVideoTracks().length === 0 || testStream.getAudioTracks().length === 0) {
        testStream.getTracks().forEach((t) => t.stop());
        toast.error("Camera and microphone are both required to start.");
        return;
      }
      // Stop test tracks — overlay will request its own stream
      testStream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      toast.error("Please allow camera and microphone access to start the exam.");
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Fullscreen is required to start the exam.");
      return;
    }

    const { data, error } = await supabase.from("submissions").insert({
      student_id: user!.id,
      exam_id: examId,
      answers: {},
      warning_count: 0,
    }).select().single();

    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmission(data);
    setExamStarted(true);
  }

  const handleWarning = useCallback(() => {
    setWarningCount((prev) => {
      const next = prev + 1;
      // Persist warning count
      if (submission) {
        supabase.from("submissions").update({ warning_count: next }).eq("id", submission.id);
      }
      return next;
    });
  }, [submission]);

  const submitExam = useCallback(async () => {
    if (!submission || submitting) return;
    setSubmitting(true);
    try {
      // Auto-grade multiple select questions
      let autoScore = 0;
      for (const q of questions) {
        if (q.question_type === "multiple_select") {
          const studentAns = (answers[q.id] as number[]) || [];
          const correctAns = (q.correct_answers as number[]) || [];
          const isCorrect =
            studentAns.length === correctAns.length &&
            studentAns.every((a) => correctAns.includes(a));
          if (isCorrect) autoScore += q.points;
        }
      }

      const { error } = await supabase.from("submissions").update({
        answers,
        submitted_at: new Date().toISOString(),
        warning_count: warningCount,
        score: autoScore,
      }).eq("id", submission.id);

      if (error) throw error;
      toast.success("Exam submitted!");
      navigate({ to: "/student/dashboard" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [submission, answers, warningCount, questions, submitting, navigate]);

  const handleAutoSubmit = useCallback(() => {
    toast.error("Too many warnings! Exam auto-submitted.");
    submitExam();
  }, [submitExam]);

  if (authLoading || !exam) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  if (!examStarted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{exam.title}</h1>
          <p className="mt-2 text-muted-foreground">{exam.description}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Time limit: {exam.time_limit_minutes} minutes · {questions.length} questions
          </p>
        </div>
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Before you start:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Camera <strong>and</strong> microphone must stay on for the entire exam</li>
            <li>The exam runs in <strong>fullscreen</strong> — exiting triggers a warning</li>
            <li>Switching tabs, looking away, or multiple faces trigger warnings</li>
            <li>Copy, paste, right-click, and dev tools are disabled</li>
            <li>After 3 warnings, the exam auto-submits</li>
          </ul>
        </div>
        <Button size="lg" onClick={startExam}>Start Exam</Button>
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div className="min-h-screen bg-background pb-40">
      <ProctoringOverlay
        warningCount={warningCount}
        onWarning={handleWarning}
        onAutoSubmit={handleAutoSubmit}
        maxWarnings={3}
      />

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            Q {currentQ + 1} / {questions.length}
          </span>
          {submission && (
            <ExamTimer
              durationMinutes={exam.time_limit_minutes}
              startedAt={submission.started_at}
              onTimeUp={submitExam}
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {q && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                <span className="text-muted-foreground">Q{currentQ + 1}.</span> {q.question_text}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{q.points} point(s) · {q.question_type === "essay" ? "Essay" : "Multiple Select"}</p>
            </CardHeader>
            <CardContent>
              {q.question_type === "essay" ? (
                <Textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="Type your answer here..."
                  className="min-h-[200px]"
                />
              ) : (
                <div className="space-y-3">
                  {(q.options as string[])?.map((opt, i) => {
                    const selected = (answers[q.id] as number[]) || [];
                    return (
                      <label key={i} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted">
                        <Checkbox
                          checked={selected.includes(i)}
                          onCheckedChange={(checked) => {
                            const newSel = checked
                              ? [...selected, i]
                              : selected.filter((x: number) => x !== i);
                            setAnswers({ ...answers, [q.id]: newSel });
                          }}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={currentQ === 0}
            onClick={() => setCurrentQ((p) => p - 1)}
          >
            Previous
          </Button>

          {currentQ < questions.length - 1 ? (
            <Button onClick={() => setCurrentQ((p) => p + 1)}>Next</Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to submit?")) submitExam();
              }}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Exam"}
            </Button>
          )}
        </div>

        {/* Question nav dots */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                i === currentQ
                  ? "bg-primary text-primary-foreground"
                  : answers[questions[i].id] !== undefined
                    ? "bg-muted text-foreground"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

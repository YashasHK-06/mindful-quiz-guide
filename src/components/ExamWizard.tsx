import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateExamCode } from "@/lib/auth";
import { toast } from "sonner";

type QType = "multiple_select" | "essay";

interface QuestionDraft {
  question_text: string;
  question_type: QType;
  points: number;
  options: string[]; // 4 options for MCQ
  correct_answers: number[]; // indices
}

interface SectionDraft {
  title: string;
  defaultType: QType;
  questions: QuestionDraft[];
}

interface Props {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function ExamWizard({ userId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);
  const [passingScore, setPassingScore] = useState(0);

  // Step 2
  const [sections, setSections] = useState<SectionDraft[]>([
    { title: "Section A", defaultType: "multiple_select", questions: [] },
  ]);

  // Step 3 navigation
  const [activeSection, setActiveSection] = useState(0);

  function newQuestion(type: QType): QuestionDraft {
    return {
      question_text: "",
      question_type: type,
      points: 1,
      options: type === "multiple_select" ? ["", "", "", ""] : [],
      correct_answers: [],
    };
  }

  function addSection() {
    const letter = String.fromCharCode(65 + sections.length);
    setSections([...sections, { title: `Section ${letter}`, defaultType: "multiple_select", questions: [] }]);
  }

  function removeSection(idx: number) {
    if (sections.length === 1) return;
    setSections(sections.filter((_, i) => i !== idx));
  }

  function updateSection(idx: number, patch: Partial<SectionDraft>) {
    setSections(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function setQuestionCount(idx: number, count: number) {
    const s = sections[idx];
    const safe = Math.max(0, Math.min(50, count));
    const next = [...s.questions];
    while (next.length < safe) next.push(newQuestion(s.defaultType));
    next.length = safe;
    updateSection(idx, { questions: next });
  }

  function updateQuestion(sIdx: number, qIdx: number, patch: Partial<QuestionDraft>) {
    const s = sections[sIdx];
    const newQs = s.questions.map((q, i) => {
      if (i !== qIdx) return q;
      const merged = { ...q, ...patch };
      // If type changed, reset options/correct
      if (patch.question_type && patch.question_type !== q.question_type) {
        merged.options = patch.question_type === "multiple_select" ? ["", "", "", ""] : [];
        merged.correct_answers = [];
      }
      return merged;
    });
    updateSection(sIdx, { questions: newQs });
  }

  function toggleCorrect(sIdx: number, qIdx: number, optIdx: number) {
    const q = sections[sIdx].questions[qIdx];
    const next = q.correct_answers.includes(optIdx)
      ? q.correct_answers.filter((i) => i !== optIdx)
      : [...q.correct_answers, optIdx];
    updateQuestion(sIdx, qIdx, { correct_answers: next });
  }

  function updateOption(sIdx: number, qIdx: number, optIdx: number, value: string) {
    const q = sections[sIdx].questions[qIdx];
    const opts = [...q.options];
    opts[optIdx] = value;
    updateQuestion(sIdx, qIdx, { options: opts });
  }

  function validateStep1() {
    if (!title.trim()) { toast.error("Exam title is required"); return false; }
    if (timeLimit < 1) { toast.error("Time limit must be at least 1 minute"); return false; }
    return true;
  }

  function validateStep2() {
    if (sections.some((s) => !s.title.trim())) { toast.error("All sections need a name"); return false; }
    const total = sections.reduce((sum, s) => sum + s.questions.length, 0);
    if (total === 0) { toast.error("Add at least one question across all sections"); return false; }
    return true;
  }

  function validateStep3(): boolean {
    for (let si = 0; si < sections.length; si++) {
      const s = sections[si];
      for (let qi = 0; qi < s.questions.length; qi++) {
        const q = s.questions[qi];
        if (!q.question_text.trim()) {
          toast.error(`${s.title} Q${qi + 1}: question text is empty`);
          return false;
        }
        if (q.question_type === "multiple_select") {
          const filled = q.options.filter((o) => o.trim()).length;
          if (filled < 2) {
            toast.error(`${s.title} Q${qi + 1}: needs at least 2 options`);
            return false;
          }
          if (q.correct_answers.length === 0) {
            toast.error(`${s.title} Q${qi + 1}: mark at least one correct answer`);
            return false;
          }
        }
      }
    }
    return true;
  }

  async function handleSave() {
    if (!validateStep3()) return;
    setSaving(true);
    try {
      const code = generateExamCode();
      const { data: examRow, error: examErr } = await supabase
        .from("exams")
        .insert({
          teacher_id: userId,
          title,
          description,
          time_limit_minutes: timeLimit,
          passing_score: passingScore,
          exam_code: code,
        })
        .select("id")
        .single();
      if (examErr) throw examErr;
      const examId = examRow.id;

      // Insert sections
      const { data: secRows, error: secErr } = await supabase
        .from("exam_sections")
        .insert(sections.map((s, i) => ({ exam_id: examId, title: s.title, sort_order: i })))
        .select("id, sort_order");
      if (secErr) throw secErr;

      const sortedSecs = [...(secRows ?? [])].sort((a, b) => a.sort_order - b.sort_order);

      // Insert questions
      const allQuestions: any[] = [];
      let globalOrder = 0;
      sections.forEach((s, sIdx) => {
        const sectionId = sortedSecs[sIdx]?.id;
        s.questions.forEach((q) => {
          allQuestions.push({
            exam_id: examId,
            section_id: sectionId,
            question_text: q.question_text,
            question_type: q.question_type,
            points: q.points,
            options: q.question_type === "multiple_select" ? q.options.filter((o) => o.trim()) : [],
            correct_answers: q.question_type === "multiple_select" ? q.correct_answers : [],
            sort_order: globalOrder++,
          });
        });
      });

      if (allQuestions.length > 0) {
        const { error: qErr } = await supabase.from("questions").insert(allQuestions);
        if (qErr) throw qErr;
      }

      toast.success(`Exam created! Code: ${code}`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create exam");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {n}
          </div>
        ))}
        <span className="ml-2 text-muted-foreground">
          {step === 1 && "Basic info"}
          {step === 2 && "Sections & question counts"}
          {step === 3 && "Edit questions"}
        </span>
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Exam Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midterm Exam" />
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => validateStep1() && setStep(2)}>Next →</Button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define how many sections and how many questions per section. You'll fill in the actual questions in the next step.
          </p>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
            {sections.map((s, idx) => (
              <Card key={idx}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.title}
                      onChange={(e) => updateSection(idx, { title: e.target.value })}
                      placeholder="Section name"
                      className="flex-1"
                    />
                    {sections.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeSection(idx)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs"># of Questions</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={s.questions.length}
                        onChange={(e) => setQuestionCount(idx, Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default Type</Label>
                      <Select
                        value={s.defaultType}
                        onValueChange={(v) => {
                          const t = v as QType;
                          // Re-create questions of this section with new default type
                          const newQs = s.questions.map(() => newQuestion(t));
                          updateSection(idx, { defaultType: t, questions: newQs });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_select">Multiple Choice (ABCD)</SelectItem>
                          <SelectItem value="essay">Essay / Written</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addSection}>+ Add Section</Button>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={() => { if (validateStep2()) { setActiveSection(0); setStep(3); } }}>Next →</Button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Section tabs */}
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {sections.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className={`rounded-t-md px-3 py-1.5 text-sm transition-colors ${
                  activeSection === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {s.title} ({s.questions.length})
              </button>
            ))}
          </div>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2">
            {sections[activeSection].questions.map((q, qi) => (
              <Card key={qi}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Question {qi + 1}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={q.question_type}
                        onValueChange={(v) => updateQuestion(activeSection, qi, { question_type: v as QType })}
                      >
                        <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_select">Multiple Choice</SelectItem>
                          <SelectItem value="essay">Essay</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={q.points}
                        onChange={(e) => updateQuestion(activeSection, qi, { points: Number(e.target.value) })}
                        className="h-8 w-16"
                        title="Points"
                      />
                    </div>
                  </div>
                  <Textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestion(activeSection, qi, { question_text: e.target.value })}
                    placeholder="Enter the question..."
                    rows={2}
                  />
                  {q.question_type === "multiple_select" && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Tick all correct answers</p>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={q.correct_answers.includes(oi)}
                            onChange={() => toggleCorrect(activeSection, qi, oi)}
                            className="h-4 w-4"
                          />
                          <span className="w-5 text-sm font-semibold text-muted-foreground">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(activeSection, qi, oi, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          />
                        </div>
                      ))}
                      {q.options.length < 6 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateQuestion(activeSection, qi, { options: [...q.options, ""] })}
                        >
                          + Add option
                        </Button>
                      )}
                    </div>
                  )}
                  {q.question_type === "essay" && (
                    <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      Students will type a written answer. You'll grade this manually from the submissions page.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            {sections[activeSection].questions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions in this section. Go back to step 2 to add some.</p>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Creating..." : "Create Exam"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

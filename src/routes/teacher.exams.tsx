import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/teacher/exams")({
  component: TeacherExamsPage,
  head: () => ({ meta: [{ title: "My Exams — ExamGuard" }] }),
});

type ExamStatus = "draft" | "upcoming" | "ongoing" | "live" | "finished";
type ExamRow = Tables<"exams"> & {
  _enrollments: number;
  _submissions: number;
  _status: ExamStatus;
};

function getStatus(e: Tables<"exams">, hasSubmissions: boolean): ExamStatus {
  if (!e.is_published) return "draft";
  const now = Date.now();
  const start = e.starts_at ? new Date(e.starts_at).getTime() : null;
  const end = e.ends_at ? new Date(e.ends_at).getTime() : null;

  if (end && now > end) return "finished";
  if (start && now < start) return "upcoming";
  if (start || end) return "ongoing"; // scheduled and currently in window
  // No dates set: live if published, mark "finished" if it has submissions but is unpublished — handled above
  return hasSubmissions ? "live" : "live";
}

const STATUS_META: Record<ExamStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "bg-muted text-muted-foreground" },
  upcoming: { label: "Upcoming", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  ongoing:  { label: "Ongoing",  className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  live:     { label: "Live",     className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  finished: { label: "Finished", className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300" },
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function TeacherExamsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | ExamStatus>("all");

  useEffect(() => {
    if (!authLoading && (!user || role !== "teacher")) navigate({ to: "/login" });
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === "teacher") fetchAll();
  }, [user, role]);

  async function fetchAll() {
    setLoading(true);
    try {
      const { data: examsData, error } = await supabase
        .from("exams")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = examsData ?? [];
      const ids = list.map((e) => e.id);

      // Counts per exam (single batched queries)
      const enrollMap = new Map<string, number>();
      const subMap = new Map<string, number>();
      if (ids.length > 0) {
        const [enrollRes, subRes] = await Promise.all([
          supabase.from("exam_enrollments").select("exam_id").in("exam_id", ids),
          supabase.from("submissions").select("exam_id").in("exam_id", ids),
        ]);
        (enrollRes.data ?? []).forEach((r) => enrollMap.set(r.exam_id, (enrollMap.get(r.exam_id) ?? 0) + 1));
        (subRes.data ?? []).forEach((r) => subMap.set(r.exam_id, (subMap.get(r.exam_id) ?? 0) + 1));
      }

      setExams(
        list.map((e) => ({
          ...e,
          _enrollments: enrollMap.get(e.id) ?? 0,
          _submissions: subMap.get(e.id) ?? 0,
          _status: getStatus(e, (subMap.get(e.id) ?? 0) > 0),
        }))
      );
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load exams");
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<ExamStatus, number> = { draft: 0, upcoming: 0, ongoing: 0, live: 0, finished: 0 };
    exams.forEach((e) => { c[e._status]++; });
    return c;
  }, [exams]);

  const filtered = useMemo(
    () => (tab === "all" ? exams : exams.filter((e) => e._status === tab)),
    [exams, tab]
  );

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(
      () => toast.success(`Copied: ${code}`),
      () => toast.error("Could not copy")
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Exam<span className="text-primary">Guard</span>
            </h1>
            <p className="text-sm text-muted-foreground">My Exams</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/teacher/dashboard" })}>
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Status Summary */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {(["draft","upcoming","ongoing","live","finished"] as ExamStatus[]).map((s) => (
            <Card key={s} className="cursor-pointer transition-colors hover:border-primary" onClick={() => setTab(s)}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{STATUS_META[s].label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{counts[s]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4 flex flex-wrap">
            <TabsTrigger value="all">All ({exams.length})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({counts.upcoming})</TabsTrigger>
            <TabsTrigger value="ongoing">Ongoing ({counts.ongoing})</TabsTrigger>
            <TabsTrigger value="live">Live ({counts.live})</TabsTrigger>
            <TabsTrigger value="finished">Finished ({counts.finished})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading exams...</p>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-4xl">📋</p>
                  <p className="text-lg font-medium text-foreground">No exams in this category</p>
                  <Link to="/teacher/dashboard">
                    <Button variant="outline" size="sm">Go to dashboard to create one</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((exam) => {
                  const meta = STATUS_META[exam._status];
                  const start = formatDate(exam.starts_at);
                  const end = formatDate(exam.ends_at);
                  return (
                    <Card key={exam.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{exam.title}</CardTitle>
                            <CardDescription className="mt-1 line-clamp-2">
                              {exam.description || "No description"}
                            </CardDescription>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>⏱ {exam.time_limit_minutes} min</span>
                          <span>✅ Pass: {exam.passing_score ?? 0}</span>
                          <span>👥 {exam._enrollments} enrolled</span>
                          <span>📝 {exam._submissions} submissions</span>
                        </div>

                        {(start || end) && (
                          <div className="mb-3 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                            {start && <div>Starts: <span className="text-foreground">{start}</span></div>}
                            {end && <div>Ends: <span className="text-foreground">{end}</span></div>}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => copyCode(exam.exam_code)}
                          className="mb-4 w-full rounded-md bg-muted px-3 py-2 text-left transition-colors hover:bg-muted/70"
                          title="Click to copy"
                        >
                          <p className="text-xs text-muted-foreground">Exam Code (click to copy)</p>
                          <p className="font-mono text-lg font-bold tracking-widest text-foreground">
                            {exam.exam_code}
                          </p>
                        </button>

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
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

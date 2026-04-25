import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/components/AuthForm";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, Users, ShieldCheck, FileText, Camera, Clock } from "lucide-react";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Sign Up — ExamGuard" },
      { name: "description", content: "Create your ExamGuard account" },
    ],
  }),
});

function SignupPage() {
  const [role, setRole] = useState<AppRole>("student");
  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-gradient-subtle" />
      <div className="absolute -top-32 left-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
      <div className="mx-auto grid w-full max-w-5xl items-start gap-8 lg:grid-cols-2">
        <div className="flex justify-center lg:justify-end">
          <SignupForm role={role} onRoleChange={setRole} />
        </div>
        <div className="flex justify-center lg:justify-start">
          <InstructionsPanel role={role} />
        </div>
      </div>
    </div>
  );
}

function InstructionsPanel({ role }: { role: AppRole }) {
  const isTeacher = role === "teacher";
  const items = isTeacher
    ? [
        { icon: FileText, title: "Create exams", text: "Build exams with sections, multiple-choice and essay questions, and a time limit." },
        { icon: ShieldCheck, title: "Share an exam code", text: "Each exam gets a unique code. Share it with your students so they can join." },
        { icon: Users, title: "Track submissions", text: "Review answers, scores, and proctoring warnings from the submissions page." },
      ]
    : [
        { icon: GraduationCap, title: "Join with a code", text: "Get a 6-character exam code from your teacher and join from your dashboard." },
        { icon: Camera, title: "Allow camera access", text: "Exams run with live proctoring. Make sure your camera and a stable browser are ready." },
        { icon: Clock, title: "Stay on the tab", text: "Switching tabs or leaving fullscreen triggers a warning. Finish before time runs out." },
      ];

  return (
    <Card className="w-full max-w-md border-border/60 shadow-elegant">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="icon-tile bg-gradient-primary text-primary-foreground">
            {isTeacher ? <Users className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
          </div>
          <div>
            <CardTitle className="text-xl">
              {isTeacher ? "For Teachers" : "For Students"}
            </CardTitle>
            <CardDescription>
              {isTeacher ? "How to run an exam on ExamGuard" : "How to take an exam on ExamGuard"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-border/50 bg-card/50 p-3 hover-lift">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-primary" />
                  <p className="font-medium">{item.title}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Pick your role on the left — these steps will update accordingly.
        </p>
      </CardContent>
    </Card>
  );
}

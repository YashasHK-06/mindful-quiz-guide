import { useEffect, useState } from "react";

interface ExamTimerProps {
  durationMinutes: number;
  startedAt: string;
  onTimeUp: () => void;
}

export function ExamTimer({ durationMinutes, startedAt, onTimeUp }: ExamTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, durationMinutes * 60 - elapsed);
  });

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeUp();
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft, onTimeUp]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft < 300;

  return (
    <div className={`rounded-md px-4 py-2 text-center font-mono text-lg font-bold ${isLow ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}

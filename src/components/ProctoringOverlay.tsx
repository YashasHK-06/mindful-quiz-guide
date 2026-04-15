import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ProctoringOverlayProps {
  warningCount: number;
  onWarning: () => void;
  onAutoSubmit: () => void;
  maxWarnings?: number;
}

export function ProctoringOverlay({ warningCount, onWarning, onAutoSubmit, maxWarnings = 3 }: ProctoringOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setMediaReady(true);
      })
      .catch((err) => {
        setMediaError("Camera/mic access denied. Please allow access to proceed.");
        console.error("Media error:", err);
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onWarning();
        toast.warning(`Warning! You switched tabs. (${warningCount + 1}/${maxWarnings})`, {
          duration: 5000,
        });
        if (warningCount + 1 >= maxWarnings) {
          onAutoSubmit();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [warningCount, onWarning, onAutoSubmit, maxWarnings]);

  if (mediaError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
        <div className="rounded-lg bg-destructive/10 p-8 text-center">
          <p className="text-lg font-semibold text-destructive">{mediaError}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please enable camera and microphone in your browser settings and refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-32 w-44 object-cover"
        />
        <div className="flex items-center justify-between px-2 py-1 text-xs">
          <span className={mediaReady ? "text-green-500" : "text-muted-foreground"}>
            {mediaReady ? "● Live" : "Connecting..."}
          </span>
          <span className={warningCount > 0 ? "font-bold text-destructive" : "text-muted-foreground"}>
            Warnings: {warningCount}/{maxWarnings}
          </span>
        </div>
      </div>
    </>
  );
}

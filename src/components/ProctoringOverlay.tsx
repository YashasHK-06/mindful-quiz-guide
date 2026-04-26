import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FaceDetector, FilesetResolver, type Detection } from "@mediapipe/tasks-vision";

interface ProctoringOverlayProps {
  warningCount: number;
  onWarning: (reason: string) => void;
  onAutoSubmit: () => void;
  maxWarnings?: number;
}

export function ProctoringOverlay({ warningCount, onWarning, onAutoSubmit, maxWarnings = 3 }: ProctoringOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastWarnAtRef = useRef<Record<string, number>>({});
  const stateStartRef = useRef<Record<string, number>>({});
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const [statusOk, setStatusOk] = useState(true);

  // Cooldown so we don't spam warnings every frame
  const WARN_COOLDOWN_MS = 8000;
  // How long a violation must persist before we count it
  const PERSIST_MS = 2500;

  function maybeWarn(reason: string, label: string) {
    const now = Date.now();
    const last = lastWarnAtRef.current[reason] ?? 0;
    if (now - last < WARN_COOLDOWN_MS) return;
    lastWarnAtRef.current[reason] = now;
    onWarning(reason);
    toast.warning(`Warning: ${label} (${warningCount + 1}/${maxWarnings})`, { duration: 5000 });
    if (warningCount + 1 >= maxWarnings) onAutoSubmit();
  }

  function trackPersistent(key: string, isViolating: boolean, reason: string, label: string) {
    if (isViolating) {
      if (!stateStartRef.current[key]) stateStartRef.current[key] = Date.now();
      else if (Date.now() - stateStartRef.current[key] >= PERSIST_MS) {
        maybeWarn(reason, label);
        stateStartRef.current[key] = Date.now(); // reset window after warning
      }
    } else {
      delete stateStartRef.current[key];
    }
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setMediaReady(true);

        // Load MediaPipe Face Detector
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm",
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        runDetectionLoop();
      } catch (err) {
        console.error("Proctoring setup error:", err);
        setMediaError("Camera/mic access denied. Please allow access to proceed.");
      }
    }

    function runDetectionLoop() {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector) return;

      const tick = () => {
        if (!videoRef.current || !detectorRef.current) return;
        const v = videoRef.current;
        if (v.readyState >= 2 && v.videoWidth > 0) {
          try {
            const result = detectorRef.current.detectForVideo(v, performance.now());
            analyzeDetections(result.detections, v.videoWidth, v.videoHeight);
          } catch (e) {
            // ignore transient errors
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function analyzeDetections(detections: Detection[], vw: number, vh: number) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineWidth = 3;
          ctx.strokeStyle = detections.length === 1 ? "#22c55e" : "#ef4444";
          for (const d of detections) {
            const b = d.boundingBox;
            if (b) ctx.strokeRect(b.originX, b.originY, b.width, b.height);
          }
        }
      }

      // No face
      const noFace = detections.length === 0;
      trackPersistent("no_face", noFace, "no_face", "No face detected — stay in front of the camera");

      // Multiple faces
      const multi = detections.length > 1;
      trackPersistent("multi_face", multi, "multiple_faces", "Multiple faces detected");

      // Looking away — use face center & nose keypoint
      let lookingAway = false;
      if (detections.length === 1) {
        const d = detections[0];
        const b = d.boundingBox;
        const kps = d.keypoints ?? [];
        if (b && kps.length >= 3) {
          // Keypoint coords are normalized [0..1]
          const nose = kps[2];
          const faceCxNorm = (b.originX + b.width / 2) / vw;
          // Horizontal offset of nose vs face center
          const dx = Math.abs(nose.x - faceCxNorm);
          // Face too small (far away) or off-center horizontally
          const faceWidthNorm = b.width / vw;
          if (dx > 0.08 || faceWidthNorm < 0.12) lookingAway = true;
        }
      }
      trackPersistent("look_away", lookingAway, "looking_away", "Please look at the screen");

      // Update on-screen status
      if (noFace) {
        setStatus("● No face");
        setStatusOk(false);
      } else if (multi) {
        setStatus(`● ${detections.length} faces`);
        setStatusOk(false);
      } else if (lookingAway) {
        setStatus("● Look at screen");
        setStatusOk(false);
      } else {
        setStatus("● Face OK");
        setStatusOk(true);
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close();
      detectorRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab/window/focus + fullscreen + copy/paste blocking
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) maybeWarn("tab_switch", "You switched tabs or minimized");
    };
    const onBlur = () => maybeWarn("window_blur", "You left the exam window");
    const onFsChange = () => {
      if (!document.fullscreenElement) maybeWarn("fullscreen_exit", "You exited fullscreen");
    };
    const block = (e: Event) => {
      e.preventDefault();
      maybeWarn("copy_paste", "Copy/paste is disabled during the exam");
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      // Block common shortcuts: copy, paste, cut, print, save, view source, devtools
      const k = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "p", "s", "u", "a"].includes(k)
      ) {
        e.preventDefault();
        maybeWarn("shortcut", "Keyboard shortcuts are disabled");
      }
      if (k === "f12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
        maybeWarn("devtools", "Developer tools are disabled");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("copy", block);
    document.addEventListener("paste", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("copy", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warningCount, maxWarnings]);

  // Request fullscreen once media is ready
  useEffect(() => {
    if (!mediaReady) return;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        toast.info("Tip: enable fullscreen for the best exam experience.");
      });
    }
  }, [mediaReady]);

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
    <div className="fixed bottom-4 right-4 z-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="relative h-32 w-44">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
        <span className={statusOk ? "text-green-500" : "text-destructive font-semibold"}>
          {mediaReady ? status : "Connecting..."}
        </span>
        <span className={warningCount > 0 ? "font-bold text-destructive" : "text-muted-foreground"}>
          {warningCount}/{maxWarnings}
        </span>
      </div>
    </div>
  );
}
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

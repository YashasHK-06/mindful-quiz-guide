

# Online Exam Proctoring Platform — Implementation Plan

## Summary
Build a full exam platform with Supabase auth, teacher/student roles, exam creation with 6-digit access codes, proctoring (camera/mic deterrent + tab-switch detection), and submission review.

## Database Schema (Supabase Migrations)

1. **`profiles`** — id (uuid, FK auth.users), full_name, created_at
2. **`user_roles`** — id, user_id (FK auth.users), role (enum: teacher/student). RLS with `has_role` security definer function.
3. **`exams`** — id, teacher_id, title, description, time_limit_minutes, passing_score, **exam_code** (unique 6-char string, auto-generated), is_published, created_at
4. **`questions`** — id, exam_id (FK exams), question_text, question_type (enum: multiple_select/essay), options (jsonb, for multiple_select), correct_answers (jsonb), points
5. **`exam_enrollments`** — id, student_id, exam_id, enrolled_at (student joins exam via 6-digit code)
6. **`submissions`** — id, student_id, exam_id, answers (jsonb), warning_count, started_at, submitted_at, score

RLS policies: teachers see their own exams/questions; students see exams they're enrolled in.

## Key Feature: 6-Digit Exam Code
- When a teacher creates an exam, a random 6-digit alphanumeric code is generated and stored in `exams.exam_code` (unique constraint).
- Students enter this code on their dashboard to enroll in the exam.
- Server function validates the code, finds the exam, and creates an enrollment record.

## Routes & Pages

| Route | Purpose |
|---|---|
| `/` | Landing page with login/signup links |
| `/login` | Email/password login |
| `/signup` | Signup with role selection (teacher/student) |
| `/teacher/dashboard` | List exams, create new exam button |
| `/teacher/exam/$examId` | Edit exam, manage questions, view exam code |
| `/teacher/exam/$examId/submissions` | Review student submissions |
| `/student/dashboard` | Join exam via code, list enrolled exams |
| `/student/exam/$examId` | Take exam (proctored) |

## Components

- **AuthForm** — login/signup forms
- **ExamCodeInput** — 6-digit OTP-style input for students to join exams
- **ExamEditor** — teacher form for exam details + question management
- **QuestionForm** — add/edit questions (multiple-select or essay)
- **ExamTaker** — proctored exam interface with timer, questions, camera feed
- **ProctoringOverlay** — camera/mic preview + tab-switch warning system
- **SubmissionReviewer** — teacher view of student answers

## Proctoring Logic (Client-Side)
- On exam start: request `getUserMedia({ video: true, audio: true })`; block exam if denied
- Show live camera feed in a small corner overlay
- Listen to `document.visibilitychange` — on hidden, increment warning count, show toast, persist to submission record
- After 3 warnings, auto-submit the exam

## Server Functions
- Auth helpers (get current user, get role)
- CRUD for exams and questions
- **Join exam by code** — validate 6-digit code, create enrollment
- Submit exam answers
- Fetch submissions for teacher review

## Implementation Order
1. Enable Supabase, create database schema (migrations)
2. Auth pages (login, signup with role selection)
3. Teacher dashboard + exam creation (with code generation)
4. Question management (multiple-select + essay)
5. Student dashboard + join exam by code
6. Exam-taking interface with proctoring
7. Tab-switch detection + warnings
8. Submission review for teachers


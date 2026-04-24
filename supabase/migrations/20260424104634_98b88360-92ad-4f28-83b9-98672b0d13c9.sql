-- Helper: is a student enrolled in an exam? SECURITY DEFINER bypasses RLS to break recursion.
CREATE OR REPLACE FUNCTION public.is_enrolled(_user_id uuid, _exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exam_enrollments
    WHERE student_id = _user_id AND exam_id = _exam_id
  )
$$;

-- Helper: does this user own (teach) this exam?
CREATE OR REPLACE FUNCTION public.owns_exam(_user_id uuid, _exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exams
    WHERE id = _exam_id AND teacher_id = _user_id
  )
$$;

-- Helper: is exam published?
CREATE OR REPLACE FUNCTION public.exam_is_published(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_published FROM public.exams WHERE id = _exam_id), false)
$$;

-- =========================
-- exams policies
-- =========================
DROP POLICY IF EXISTS "Students can view enrolled exams" ON public.exams;
CREATE POLICY "Students can view enrolled exams"
ON public.exams
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_published = true
  AND public.is_enrolled(auth.uid(), id)
);

-- =========================
-- exam_enrollments policies
-- =========================
DROP POLICY IF EXISTS "Teachers can view enrollments" ON public.exam_enrollments;
CREATE POLICY "Teachers can view enrollments"
ON public.exam_enrollments
FOR SELECT
USING (public.owns_exam(auth.uid(), exam_id));

-- =========================
-- exam_sections policies
-- =========================
DROP POLICY IF EXISTS "Students view enrolled exam sections" ON public.exam_sections;
CREATE POLICY "Students view enrolled exam sections"
ON public.exam_sections
FOR SELECT
USING (
  public.is_enrolled(auth.uid(), exam_id)
  AND public.exam_is_published(exam_id)
);

DROP POLICY IF EXISTS "Teachers manage own exam sections" ON public.exam_sections;
CREATE POLICY "Teachers manage own exam sections"
ON public.exam_sections
FOR ALL
USING (public.owns_exam(auth.uid(), exam_id))
WITH CHECK (public.owns_exam(auth.uid(), exam_id));

-- =========================
-- questions policies
-- =========================
DROP POLICY IF EXISTS "Students view enrolled exam questions" ON public.questions;
CREATE POLICY "Students view enrolled exam questions"
ON public.questions
FOR SELECT
USING (
  public.is_enrolled(auth.uid(), exam_id)
  AND public.exam_is_published(exam_id)
);

DROP POLICY IF EXISTS "Teachers manage own exam questions" ON public.questions;
CREATE POLICY "Teachers manage own exam questions"
ON public.questions
FOR ALL
USING (public.owns_exam(auth.uid(), exam_id))
WITH CHECK (public.owns_exam(auth.uid(), exam_id));

-- =========================
-- submissions policies
-- =========================
DROP POLICY IF EXISTS "Teachers view exam submissions" ON public.submissions;
CREATE POLICY "Teachers view exam submissions"
ON public.submissions
FOR SELECT
USING (public.owns_exam(auth.uid(), exam_id));

DROP POLICY IF EXISTS "Teachers update exam submissions" ON public.submissions;
CREATE POLICY "Teachers update exam submissions"
ON public.submissions
FOR UPDATE
USING (public.owns_exam(auth.uid(), exam_id));
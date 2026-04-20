CREATE TABLE public.exam_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Section',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own exam sections"
ON public.exam_sections
FOR ALL
USING (EXISTS (SELECT 1 FROM public.exams WHERE exams.id = exam_sections.exam_id AND exams.teacher_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.exams WHERE exams.id = exam_sections.exam_id AND exams.teacher_id = auth.uid()));

CREATE POLICY "Students view enrolled exam sections"
ON public.exam_sections
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.exam_enrollments e
  JOIN public.exams ex ON ex.id = e.exam_id
  WHERE e.student_id = auth.uid() AND e.exam_id = exam_sections.exam_id AND ex.is_published = true
));

ALTER TABLE public.questions ADD COLUMN section_id UUID REFERENCES public.exam_sections(id) ON DELETE SET NULL;
CREATE INDEX idx_questions_section_id ON public.questions(section_id);
CREATE INDEX idx_exam_sections_exam_id ON public.exam_sections(exam_id);

CREATE OR REPLACE FUNCTION public.join_exam_by_code(_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exam RECORD;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, title, is_published INTO _exam FROM public.exams WHERE exam_code = upper(trim(_code));
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid exam code');
  END IF;

  IF NOT _exam.is_published THEN
    RETURN json_build_object('error', 'This exam is not published yet');
  END IF;

  -- Check if already enrolled
  IF EXISTS (SELECT 1 FROM public.exam_enrollments WHERE student_id = _user_id AND exam_id = _exam.id) THEN
    RETURN json_build_object('error', 'Already enrolled', 'exam_title', _exam.title);
  END IF;

  INSERT INTO public.exam_enrollments (student_id, exam_id) VALUES (_user_id, _exam.id);

  RETURN json_build_object('success', true, 'exam_title', _exam.title, 'exam_id', _exam.id);
END;
$$;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinical_form text,
  ADD COLUMN IF NOT EXISTS diagnosis_date date,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS comorbidities text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allergies text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_medications text NOT NULL DEFAULT '';
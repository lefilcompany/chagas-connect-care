
-- =========================================
-- JOURNEYS
-- =========================================
CREATE TABLE public.journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL DEFAULT '',
  name text NOT NULL,
  goal text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','ativa','pausada','arquivada')),
  trigger jsonb NOT NULL DEFAULT '{"kind":"manual"}'::jsonb,
  audience_id uuid REFERENCES public.audience_segments(id) ON DELETE SET NULL,
  graph jsonb NOT NULL DEFAULT '{"columns":[]}'::jsonb,
  version integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journeys TO authenticated;
GRANT ALL ON public.journeys TO service_role;

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journeys_select" ON public.journeys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journeys_insert" ON public.journeys FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journeys_update" ON public.journeys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journeys_delete" ON public.journeys FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));

CREATE TRIGGER journeys_set_updated_at BEFORE UPDATE ON public.journeys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX journeys_institution_status_idx ON public.journeys(institution, status);

-- =========================================
-- JOURNEY_RUNS
-- =========================================
CREATE TABLE public.journey_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  journey_version integer NOT NULL DEFAULT 0,
  institution text NOT NULL DEFAULT '',
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','waiting','completed','failed','stopped','handoff')),
  current_node_id text,
  resume_at timestamptz,
  entered_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  error text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_runs TO authenticated;
GRANT ALL ON public.journey_runs TO service_role;

ALTER TABLE public.journey_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journey_runs_select" ON public.journey_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journey_runs_insert" ON public.journey_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journey_runs_update" ON public.journey_runs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journey_runs_delete" ON public.journey_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER journey_runs_set_updated_at BEFORE UPDATE ON public.journey_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX journey_runs_status_idx ON public.journey_runs(status, resume_at);
CREATE INDEX journey_runs_journey_idx ON public.journey_runs(journey_id, status);
CREATE INDEX journey_runs_patient_idx ON public.journey_runs(patient_id);
CREATE UNIQUE INDEX journey_runs_active_uniq ON public.journey_runs(journey_id, patient_id)
  WHERE status IN ('queued','running','waiting');

-- =========================================
-- JOURNEY_RUN_STEPS
-- =========================================
CREATE TABLE public.journey_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.journey_runs(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','skipped','failed','waiting')),
  attempt integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

GRANT SELECT ON public.journey_run_steps TO authenticated;
GRANT ALL ON public.journey_run_steps TO service_role;

ALTER TABLE public.journey_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journey_run_steps_select" ON public.journey_run_steps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.journey_runs r
    WHERE r.id = run_id
      AND (public.has_role(auth.uid(),'admin') OR r.institution = public.get_user_institution(auth.uid()))
  ));

CREATE INDEX journey_run_steps_run_idx ON public.journey_run_steps(run_id, started_at);

-- =========================================
-- JOURNEY_TASKS
-- =========================================
CREATE TABLE public.journey_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL DEFAULT '',
  run_id uuid REFERENCES public.journey_runs(id) ON DELETE SET NULL,
  journey_id uuid REFERENCES public.journeys(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assignee_id uuid,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','concluida','cancelada')),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_tasks TO authenticated;
GRANT ALL ON public.journey_tasks TO service_role;

ALTER TABLE public.journey_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journey_tasks_select" ON public.journey_tasks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journey_tasks_insert" ON public.journey_tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journey_tasks_update" ON public.journey_tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR institution = public.get_user_institution(auth.uid()));
CREATE POLICY "journey_tasks_delete" ON public.journey_tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER journey_tasks_set_updated_at BEFORE UPDATE ON public.journey_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX journey_tasks_institution_idx ON public.journey_tasks(institution, status);
CREATE INDEX journey_tasks_assignee_idx ON public.journey_tasks(assignee_id, status);

-- ========================================================
-- 🚛 ŚMIECIARKA - Migracja: Rozbudowa Panelu Administratora
-- Data: 2026-11-24
-- Zadania: ADM-01 do ADM-10
-- ========================================================

-- 1. Dziennik działań administracyjnych i audytu (ADM-04)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'moderator', 'system')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('item', 'board_post', 'user', 'banner', 'setting', 'report', 'bulk')),
  target_id TEXT NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log (actor_role, actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tylko admin i moderator widzą dziennik audytu" ON public.admin_audit_log;
CREATE POLICY "Tylko admin i moderator widzą dziennik audytu"
  ON public.admin_audit_log FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'moderator')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Zapis audytu przez uprawnione role" ON public.admin_audit_log;
CREATE POLICY "Zapis audytu przez uprawnione role"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'moderator')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- 2. Tabela ustrukturyzowanych blokad użytkowników (ADM-05)
CREATE TABLE IF NOT EXISTS public.admin_blocks (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('user_id', 'author_name', 'fingerprint')),
  target_value TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'items', 'board')),
  expires_at TIMESTAMPTZ,
  blocked_by_name TEXT NOT NULL,
  blocked_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by_name TEXT
);

CREATE INDEX IF NOT EXISTS admin_blocks_target_idx ON public.admin_blocks (target_type, target_value);
CREATE INDEX IF NOT EXISTS admin_blocks_active_idx ON public.admin_blocks (revoked_at, expires_at);

ALTER TABLE public.admin_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tylko admin i moderator zarządzają blokadami" ON public.admin_blocks;
CREATE POLICY "Tylko admin i moderator zarządzają blokadami"
  ON public.admin_blocks FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'moderator')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- 3. Zgłoszenia wpisów na Tablicy (ADM-02)
CREATE TABLE IF NOT EXISTS public.board_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  reporter_key TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 2 AND 500),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS board_reports_post_idx ON public.board_reports (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS board_reports_status_idx ON public.board_reports (status, created_at DESC);

ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publiczne zgłaszanie wpisów tablicy" ON public.board_reports;
CREATE POLICY "Publiczne zgłaszanie wpisów tablicy"
  ON public.board_reports FOR INSERT
  WITH CHECK (char_length(trim(reason)) BETWEEN 2 AND 500);

DROP POLICY IF EXISTS "Admin i moderator widzą zgłoszenia tablicy" ON public.board_reports;
CREATE POLICY "Admin i moderator widzą zgłoszenia tablicy"
  ON public.board_reports FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'moderator')
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- 4. Funkcja RPC pobierająca sprawy moderacyjne (ogłoszenia + tablica) (ADM-02)
CREATE OR REPLACE FUNCTION public.get_moderation_cases()
RETURNS TABLE (
  case_id TEXT,
  target_type TEXT,
  target_id TEXT,
  reports_count BIGINT,
  latest_reason TEXT,
  latest_report_date TIMESTAMPTZ,
  reasons_list TEXT[],
  case_status TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    'item_case_' || r.item_id AS case_id,
    'item' AS target_type,
    r.item_id AS target_id,
    COUNT(r.id) AS reports_count,
    (ARRAY_AGG(r.reason ORDER BY r.created_at DESC))[1] AS latest_reason,
    MAX(r.created_at) AS latest_report_date,
    ARRAY_AGG(DISTINCT r.reason) AS reasons_list,
    CASE 
      WHEN bool_and(r.status = 'dismissed') THEN 'dismissed'
      WHEN bool_and(r.status = 'action_taken') THEN 'action_taken'
      WHEN bool_or(r.status = 'pending') THEN 'pending'
      ELSE 'reviewed'
    END AS case_status
  FROM public.item_reports r
  GROUP BY r.item_id
  UNION ALL
  SELECT
    'board_case_' || b.post_id AS case_id,
    'board_post' AS target_type,
    b.post_id AS target_id,
    COUNT(b.id) AS reports_count,
    (ARRAY_AGG(b.reason ORDER BY b.created_at DESC))[1] AS latest_reason,
    MAX(b.created_at) AS latest_report_date,
    ARRAY_AGG(DISTINCT b.reason) AS reasons_list,
    CASE 
      WHEN bool_and(b.status = 'dismissed') THEN 'dismissed'
      WHEN bool_and(b.status = 'action_taken') THEN 'action_taken'
      WHEN bool_or(b.status = 'pending') THEN 'pending'
      ELSE 'reviewed'
    END AS case_status
  FROM public.board_reports b
  GROUP BY b.post_id
  ORDER BY latest_report_date DESC;
$$;

-- 5. Funkcja RPC do pobierania globalnych metryk analitycznych (ADM-07, ADM-08, ADM-10)
CREATE OR REPLACE FUNCTION public.get_admin_global_metrics(
  start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  end_date TIMESTAMPTZ DEFAULT NOW(),
  filter_city TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_items BIGINT;
  v_active_items BIGINT;
  v_wystawka_active BIGINT;
  v_oddam_active BIGINT;
  v_oddam_given_count BIGINT;
  v_oddam_cohort_total BIGINT;
  v_oddam_cohort_given_14d BIGINT;
  v_oddam_median_time_hours NUMERIC;
  v_wystawka_unconfirmed BIGINT;
  v_wystawka_total BIGINT;
  v_open_cases BIGINT;
  v_oldest_open_case_age_hours NUMERIC;
  v_resolved_cases BIGINT;
  v_substantive_resolved_cases BIGINT;
  v_global_rescued_count BIGINT;
  v_global_co2_kg NUMERIC;
BEGIN
  -- Aktywne oferty w serwisie
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'wystawka'),
    COUNT(*) FILTER (WHERE type = 'oddam')
  INTO v_active_items, v_wystawka_active, v_oddam_active
  FROM public.items
  WHERE status = 'active'
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  -- Całkowita liczba w wybranym oknie
  SELECT COUNT(*) INTO v_total_items
  FROM public.items
  WHERE created_at BETWEEN start_date AND end_date
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  -- Metryki Oddam:
  -- 1) Liczba oddanych według autora w oknie
  SELECT COUNT(*) INTO v_oddam_given_count
  FROM public.items
  WHERE type = 'oddam'
    AND status IN ('taken', 'archived')
    AND created_at BETWEEN start_date AND end_date
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  -- 2) Kohorta 14-dniowa: oferty oddam utworzone co najmniej 14 dni temu (pełne okno obserwacji)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('taken', 'archived'))
  INTO v_oddam_cohort_total, v_oddam_cohort_given_14d
  FROM public.items
  WHERE type = 'oddam'
    AND created_at <= (NOW() - INTERVAL '14 days')
    AND created_at >= (start_date - INTERVAL '14 days')
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  -- 3) Mediana czasu do oznaczenia jako oddane
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0)
  INTO v_oddam_median_time_hours
  FROM public.items
  WHERE type = 'oddam'
    AND status IN ('taken', 'archived')
    AND created_at BETWEEN start_date AND end_date
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  -- Metryki Wystawek:
  -- Wystawki bez żadnego późniejszego potwierdzenia (still_there_votes <= 1)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE still_there_votes <= 1)
  INTO v_wystawka_total, v_wystawka_unconfirmed
  FROM public.items
  WHERE type = 'wystawka'
    AND created_at BETWEEN start_date AND end_date
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  -- Moderacja: Otwarte sprawy i wiek najstarszej
  SELECT 
    COUNT(*),
    COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0), 0)
  INTO v_open_cases, v_oldest_open_case_age_hours
  FROM public.item_reports
  WHERE status = 'pending';

  -- Rozstrzygnięte sprawy i odsetek zasadnych
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'action_taken')
  INTO v_resolved_cases, v_substantive_resolved_cases
  FROM public.item_reports
  WHERE status IN ('action_taken', 'dismissed');

  -- Metodologia CO2 i globalna liczba uratowanych rzeczy (ADM-10):
  -- Wagi kategorii wg KOBiZE / WRAP: meble: 25 kg, agd/elektronika: 35 kg, ubrania/dla_dzieci/ksiazki: 5 kg, inne: 10 kg
  SELECT 
    COUNT(*),
    COALESCE(SUM(
      CASE 
        WHEN category IN ('meble') THEN 25.0
        WHEN category IN ('elektronika', 'agd') THEN 35.0
        WHEN category IN ('ubrania', 'dla_dzieci', 'ksiazki') THEN 5.0
        WHEN category IN ('rosliny') THEN 2.0
        ELSE 10.0
      END
    ), 0)
  INTO v_global_rescued_count, v_global_co2_kg
  FROM public.items
  WHERE status IN ('taken', 'archived')
    AND (filter_city IS NULL OR address ILIKE '%' || filter_city || '%');

  v_result := jsonb_build_object(
    'activeItems', v_active_items,
    'wystawkaActive', v_wystawka_active,
    'oddamActive', v_oddam_active,
    'totalItemsPeriod', v_total_items,
    'oddamGivenCount', v_oddam_given_count,
    'oddamCohortTotal14d', v_oddam_cohort_total,
    'oddamCohortGiven14d', v_oddam_cohort_given_14d,
    'oddamCohortRatePct', CASE WHEN v_oddam_cohort_total > 0 THEN ROUND((v_oddam_cohort_given_14d::numeric / v_oddam_cohort_total) * 100, 1) ELSE NULL END,
    'oddamMedianHours', ROUND(COALESCE(v_oddam_median_time_hours, 0), 1),
    'wystawkaTotal', v_wystawka_total,
    'wystawkaUnconfirmed', v_wystawka_unconfirmed,
    'wystawkaUnconfirmedRatePct', CASE WHEN v_wystawka_total > 0 THEN ROUND((v_wystawka_unconfirmed::numeric / v_wystawka_total) * 100, 1) ELSE NULL END,
    'openCasesCount', v_open_cases,
    'oldestOpenCaseAgeHours', ROUND(v_oldest_open_case_age_hours, 1),
    'resolvedCasesCount', v_resolved_cases,
    'substantiveResolvedCasesCount', v_substantive_resolved_cases,
    'substantiveRatePct', CASE WHEN v_resolved_cases > 0 THEN ROUND((v_substantive_resolved_cases::numeric / v_resolved_cases) * 100, 1) ELSE NULL END,
    'globalRescuedCount', v_global_rescued_count,
    'globalCo2Kg', ROUND(v_global_co2_kg, 1),
    'co2Methodology', 'Szacunek oparty na kategoriach uratowanych rzeczy (meble: 25kg, agd/elektronika: 35kg, ubrania/książki: 5kg, inne: 10kg)'
  );

  RETURN v_result;
END;
$$;

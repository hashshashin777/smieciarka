-- ========================================================
-- 🚛 ŚMIECIARKA - Migracja: Prawdziwy system zgłaszania naruszeń
-- Data: 2026-11-24
-- ========================================================

-- 1. Tabela zgłoszeń naruszeń ogłoszeń
CREATE TABLE IF NOT EXISTS public.item_reports (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  reporter_key TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 2 AND 500),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS item_reports_item_idx ON public.item_reports (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS item_reports_status_idx ON public.item_reports (status, created_at DESC);

ALTER TABLE public.item_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publiczne zgłaszanie naruszeń" ON public.item_reports;
CREATE POLICY "Publiczne zgłaszanie naruszeń"
  ON public.item_reports FOR INSERT
  WITH CHECK (
    char_length(trim(reason)) BETWEEN 2 AND 500
  );

DROP POLICY IF EXISTS "Tylko admin odczytuje zgłoszenia" ON public.item_reports;
CREATE POLICY "Tylko admin odczytuje zgłoszenia"
  ON public.item_reports FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tylko admin aktualizuje zgłoszenia" ON public.item_reports;
CREATE POLICY "Tylko admin aktualizuje zgłoszenia"
  ON public.item_reports FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Funkcja pomocnicza RPC do pobierania podsumowania zgłoszeń dla moderacji
CREATE OR REPLACE FUNCTION public.get_reported_items_summary()
RETURNS TABLE (
  item_id TEXT,
  reports_count BIGINT,
  latest_reason TEXT,
  latest_report_date TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    r.item_id,
    COUNT(r.id) AS reports_count,
    (ARRAY_AGG(r.reason ORDER BY r.created_at DESC))[1] AS latest_reason,
    MAX(r.created_at) AS latest_report_date
  FROM public.item_reports r
  WHERE r.status = 'pending'
  GROUP BY r.item_id
  ORDER BY reports_count DESC, latest_report_date DESC;
$$;

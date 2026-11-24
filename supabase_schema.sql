-- ========================================================
-- 🚛 ŚMIECIARKA - Schemat Bazy Danych Supabase (Hardened & Idempotent)
-- ========================================================

-- 1. Tabela ogłoszeń
CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('wystawka', 'oddam')),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  is_exact BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'taken', 'expired')),
  still_there_votes INTEGER DEFAULT 0,
  taken_votes INTEGER DEFAULT 0,
  author_name TEXT,
  contact_info TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '6 hours'),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bezpieczna migracja kolumn na istniejącej bazie
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '6 hours');
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS items_status_created_idx ON public.items (status, created_at DESC);
CREATE INDEX IF NOT EXISTS items_expires_idx ON public.items (expires_at);

-- 2. Tablica ogłoszeń sąsiedzkich
CREATE TABLE IF NOT EXISTS public.board_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'szukam' CHECK (tag IN ('szukam', 'oddam', 'pomoc', 'info', 'inne')),
  author_name TEXT NOT NULL,
  location_area TEXT,
  contact_info TEXT,
  likes_count INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.board_posts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS board_posts_created_idx ON public.board_posts (created_at DESC);

-- 3. Głosy na status ogłoszenia (deduplikacja per voter_key)
CREATE TABLE IF NOT EXISTS public.item_votes (
  item_id TEXT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('still_there', 'taken')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (item_id, voter_key)
);

-- 4. Polubienia tablicy
CREATE TABLE IF NOT EXISTS public.board_likes (
  post_id TEXT NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, voter_key)
);

-- 5. Wiadomości czatu dla ogłoszeń
CREATE TABLE IF NOT EXISTS public.item_messages (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_provider TEXT NOT NULL DEFAULT 'email',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS item_messages_item_idx ON public.item_messages (item_id, created_at ASC);

-- 6. Atomowe funkcje RPC (eliminują race-conditions przy głosowaniu i polubieniach)
CREATE OR REPLACE FUNCTION public.vote_item_status(
  p_item_id TEXT,
  p_vote_type TEXT,
  p_voter_key TEXT
)
RETURNS TABLE (
  still_there_votes INTEGER,
  taken_votes INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_still INTEGER;
  v_taken INTEGER;
  v_status TEXT;
BEGIN
  IF p_vote_type NOT IN ('still_there', 'taken') THEN
    RAISE EXCEPTION 'Invalid vote_type: %', p_vote_type;
  END IF;

  INSERT INTO public.item_votes (item_id, voter_key, vote_type)
  VALUES (p_item_id, p_voter_key, p_vote_type)
  ON CONFLICT (item_id, voter_key) DO UPDATE
    SET vote_type = EXCLUDED.vote_type,
        created_at = NOW();

  SELECT
    COALESCE(SUM(CASE WHEN vote_type = 'still_there' THEN 1 ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN vote_type = 'taken' THEN 1 ELSE 0 END), 0)::INTEGER
  INTO v_still, v_taken
  FROM public.item_votes
  WHERE item_id = p_item_id;

  v_status := CASE WHEN v_taken >= 2 THEN 'taken' ELSE 'active' END;

  UPDATE public.items
  SET still_there_votes = v_still,
      taken_votes = v_taken,
      status = v_status
  WHERE id = p_item_id;

  RETURN QUERY SELECT v_still, v_taken, v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_board_like(
  p_post_id TEXT,
  p_voter_key TEXT
)
RETURNS TABLE (
  liked BOOLEAN,
  likes_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.board_likes
    WHERE post_id = p_post_id AND voter_key = p_voter_key
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.board_likes
    WHERE post_id = p_post_id AND voter_key = p_voter_key;
  ELSE
    INSERT INTO public.board_likes (post_id, voter_key)
    VALUES (p_post_id, p_voter_key);
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.board_likes
  WHERE post_id = p_post_id;

  UPDATE public.board_posts
  SET likes_count = v_count
  WHERE id = p_post_id;

  RETURN QUERY SELECT (NOT v_exists), v_count;
END;
$$;

-- 7. Row Level Security (RLS)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publiczne odczytywanie ogłoszeń" ON public.items;
DROP POLICY IF EXISTS "Publiczne dodawanie ogłoszeń" ON public.items;
DROP POLICY IF EXISTS "Publiczna aktualizacja głosów i statusu" ON public.items;
DROP POLICY IF EXISTS "Owner or Admin UPDATE items" ON public.items;
DROP POLICY IF EXISTS "Owner or Admin DELETE items" ON public.items;

CREATE POLICY "Publiczne odczytywanie ogłoszeń"
  ON public.items FOR SELECT
  USING (
    status IN ('active', 'taken')
    OR auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Publiczne dodawanie ogłoszeń"
  ON public.items FOR INSERT
  WITH CHECK (
    char_length(trim(title)) BETWEEN 2 AND 160
    AND (auth.uid() IS NULL OR user_id IS NULL OR auth.uid() = user_id)
  );

CREATE POLICY "Owner or Admin UPDATE items"
  ON public.items FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Owner or Admin DELETE items"
  ON public.items FOR DELETE
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Publiczne odczytywanie tablicy" ON public.board_posts;
DROP POLICY IF EXISTS "Publiczne dodawanie wpisów na tablicy" ON public.board_posts;
DROP POLICY IF EXISTS "Publiczne polubienia na tablicy" ON public.board_posts;
DROP POLICY IF EXISTS "Owner or Admin UPDATE board_posts" ON public.board_posts;
DROP POLICY IF EXISTS "Owner or Admin DELETE board_posts" ON public.board_posts;

CREATE POLICY "Publiczne odczytywanie tablicy"
  ON public.board_posts FOR SELECT
  USING (true);

CREATE POLICY "Publiczne dodawanie wpisów na tablicy"
  ON public.board_posts FOR INSERT
  WITH CHECK (
    char_length(trim(title)) BETWEEN 2 AND 160
    AND (auth.uid() IS NULL OR user_id IS NULL OR auth.uid() = user_id)
  );

CREATE POLICY "Owner or Admin UPDATE board_posts"
  ON public.board_posts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Owner or Admin DELETE board_posts"
  ON public.board_posts FOR DELETE
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Public SELECT item_votes" ON public.item_votes;
CREATE POLICY "Public SELECT item_votes" ON public.item_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public SELECT board_likes" ON public.board_likes;
CREATE POLICY "Public SELECT board_likes" ON public.board_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public SELECT item_messages" ON public.item_messages;
CREATE POLICY "Public SELECT item_messages" ON public.item_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public INSERT item_messages" ON public.item_messages;
CREATE POLICY "Public INSERT item_messages"
  ON public.item_messages FOR INSERT
  WITH CHECK (char_length(trim(text)) BETWEEN 1 AND 1000);

-- 8. Realtime & Storage
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.board_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.item_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('items-photos', 'items-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public READ items-photos" ON storage.objects;
CREATE POLICY "Public READ items-photos"
  ON storage.objects FOR SELECT USING (bucket_id = 'items-photos');

DROP POLICY IF EXISTS "Public UPLOAD items-photos" ON storage.objects;
CREATE POLICY "Public UPLOAD items-photos"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'items-photos');

-- 9. Tokeny gości oraz Zgłoszenia nadużyć (Item Reports)
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS edit_token_hash TEXT;

CREATE INDEX IF NOT EXISTS items_edit_token_hash_idx
  ON public.items (edit_token_hash)
  WHERE edit_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.delete_guest_item(
  p_item_id TEXT,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash TEXT;
  v_computed_hash TEXT;
BEGIN
  IF p_item_id IS NULL OR p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN FALSE;
  END IF;

  SELECT edit_token_hash INTO v_stored_hash
  FROM public.items
  WHERE id = p_item_id;

  IF v_stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  v_computed_hash := encode(sha256(trim(p_token)::bytea), 'hex');

  IF v_stored_hash = v_computed_hash OR v_stored_hash = trim(p_token) THEN
    DELETE FROM public.items WHERE id = p_item_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_guest_item(
  p_item_id TEXT,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash TEXT;
  v_computed_hash TEXT;
BEGIN
  IF p_item_id IS NULL OR p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN FALSE;
  END IF;

  SELECT edit_token_hash INTO v_stored_hash
  FROM public.items
  WHERE id = p_item_id;

  IF v_stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  v_computed_hash := encode(sha256(trim(p_token)::bytea), 'hex');

  IF v_stored_hash = v_computed_hash OR v_stored_hash = trim(p_token) THEN
    UPDATE public.items
    SET status = 'taken'
    WHERE id = p_item_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_guest_item_token(
  p_item_id TEXT,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash TEXT;
  v_computed_hash TEXT;
BEGIN
  IF p_item_id IS NULL OR p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN FALSE;
  END IF;

  SELECT edit_token_hash INTO v_stored_hash
  FROM public.items
  WHERE id = p_item_id;

  IF v_stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  v_computed_hash := encode(sha256(trim(p_token)::bytea), 'hex');

  RETURN (v_stored_hash = v_computed_hash OR v_stored_hash = trim(p_token));
END;
$$;

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

-- ----------------------------------------------------
-- DZIENNIK AUDYTU I BLOKADY ADMINISTRATORA (ADM-04, ADM-05)
-- ----------------------------------------------------
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

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.admin_blocks ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;



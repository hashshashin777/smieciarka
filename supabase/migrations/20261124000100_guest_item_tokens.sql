-- ========================================================
-- 🚛 ŚMIECIARKA - Migracja: Tokeny edycji/usuwania dla gości
-- Data: 2026-11-24
-- ========================================================

-- 1. Dodanie kolumny na hash tokenu autoryzacyjnego
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS edit_token_hash TEXT;

CREATE INDEX IF NOT EXISTS items_edit_token_hash_idx
  ON public.items (edit_token_hash)
  WHERE edit_token_hash IS NOT NULL;

-- 2. Funkcja bezpiecznego usuwania ogłoszenia przez gościa (posiadacza tokenu)
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

-- 3. Funkcja archiwizacji (oznaczenia jako odebrane) przez gościa
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

-- 4. Funkcja weryfikacji tokenu gościa
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

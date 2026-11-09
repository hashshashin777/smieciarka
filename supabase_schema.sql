-- ========================================================
-- 🚛 ŚMIECIARKA - Schemat Bazy Danych Supabase (PostgreSQL)
-- Wklej ten kod do: Supabase Dashboard -> SQL Editor -> Run
-- ========================================================

-- 1. Tworzenie tabeli ogłoszeń
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Włączenie Row Level Security (RLS)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- 3. Polityki bezpieczeństwa: Każdy może czytać, dodawać i aktualizować głosy
CREATE POLICY "Publiczne odczytywanie ogłoszeń" 
  ON public.items FOR SELECT 
  USING (true);

CREATE POLICY "Publiczne dodawanie ogłoszeń" 
  ON public.items FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Publiczna aktualizacja głosów i statusu" 
  ON public.items FOR UPDATE 
  USING (true);

-- 4. Włączenie nasłuchiwania w czasie rzeczywistym (Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;

-- 5. Przykładowe dane startowe
INSERT INTO public.items (
  id, type, title, description, category, photos, latitude, longitude, address, is_exact, still_there_votes
) VALUES
(
  'post-waw-1',
  'wystawka',
  'Fotel uszak vintage (stan dobry)',
  'Stoi przy wiacie śmietnikowej na rogu Marszałkowskiej. Drewniane nóżki, tapicerka do małego przetarcia.',
  'meble',
  ARRAY['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80'],
  52.2268,
  21.0135,
  'ul. Marszałkowska / Wilcza, Warszawa',
  TRUE,
  3
),
(
  'post-waw-2',
  'oddam',
  'Monitor komputerowy 24 cale',
  'W pełni sprawny z kablem HDMI. Oddam za darmo z rąk do rąk.',
  'elektronika',
  ARRAY['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80'],
  52.2345,
  21.0089,
  'Śródmieście, okolice Pl. Grzybowskiego',
  FALSE,
  0
)
ON CONFLICT (id) DO NOTHING;


-- ========================================================
-- 📌 TABLICA OGŁOSZEŃ (COMMUNITY BOARD)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.board_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'szukam',
  author_name TEXT NOT NULL,
  location_area TEXT,
  contact_info TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publiczne odczytywanie tablicy" 
  ON public.board_posts FOR SELECT 
  USING (true);

CREATE POLICY "Publiczne dodawanie wpisów na tablicy" 
  ON public.board_posts FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Publiczne polubienia na tablicy" 
  ON public.board_posts FOR UPDATE 
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.board_posts;

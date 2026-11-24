# Rejestr wdrożenia napraw audytu „Wystawka zero-waste”

Stan bazowy audytu: commit `5acb5d3` (23–24 listopada 2026 r.), gałąź `master`.
Środowisko: Expo SDK 58, React Native 0.88.1, React 19.3.0, Web (react-native-web 0.21.4).

---

## Tabela postępu ustaleń i hipotez

| ID | Kategoria | Problem | Rozwiązanie | Testy | Status | Blokada |
|---|---|---|---|---|---|---|
| **AUDIT-P0-01** | Błąd krytyczny | Wgrywanie zdjęć na WWW zgłasza błąd formatu `blob:` | Obsługa schematów `blob:` i `data:`, konwersja do `ArrayBuffer` z walidacją MIME i limitu 5MB | Jednostkowe walidacji MIME + test eksportu WWW (16 testów OK) | `NAPRAWIONE` | Brak |
| **AUDIT-P1-01** | Bezpieczeństwo / Zaufanie | Atrapa zgłaszania naruszeń (Alert bez zapisu do bazy, brak tabeli `item_reports`) | Migracja tabeli `item_reports` (RLS), funkcja `reportItemInCloud`, obsługa w `AdminModerationTab` i `ItemDetailModal` | Testy jednostkowe + weryfikacja typów TS | `NAPRAWIONE (KOD/MIGRACJA)` | Zastosowanie migracji SQL na produkcji wymaga wdrożenia do bazy |
| **AUDIT-P1-02** | Architektura / Bezpieczeństwo | Gość po publikacji traci możliwość edycji i usunięcia ogłoszenia | Tokeny edycji gościa (`edit_token_hash` w DB, token w `localStorage`), RPC `delete_guest_item` / `archive_guest_item` | Testy jednostkowe storage cache + weryfikacja typów TS | `NAPRAWIONE (KOD/MIGRACJA)` | Zastosowanie migracji SQL na produkcji |
| **AUDIT-P1-03** | UX / Routing | Brak obsługi 404/nieistniejącego/wygasłego ogłoszenia przy wejściu z deep linka | Pobranie ogłoszenia z bazy w locie, dedykowany widok stanu niedostępności z powrotem do listy | Testy jednostkowe deep linków (query param + path) | `NAPRAWIONE` | Brak |
| **AUDIT-P1-04** | UX / Informacja | Asymetria formularza: brak logistyki odbioru (piętro, winda, transport) w „Oddam” i czasu w „Wystawka” | Pola logistyki odbioru dla „Oddam” + szacowany czas zauważenia i disclaimer braku rezerwacji w „Wystawka” | Weryfikacja formularza i wyświetlania szczegółów | `NAPRAWIONE` | Brak |
| **AUDIT-P2-01** | Dostępność / WWW | Blokada wyszukiwania miejscowości na WWW poza sztywną listą | Integracja wyszukiwania OpenStreetMap Nominatim z debounce i nagłówkiem User-Agent na WWW | Testy jednostkowe geokodowania i pamięci podręcznej | `NAPRAWIONE` | Brak |
| **AUDIT-P2-02** | Dostępność (WCAG) | Brak widocznego fokusu klawiatury (`outlineWidth: 0`), brak pułapki fokusu i obsługi Escape w modalach | Globalny styl `:focus-visible` (kontrast 7.4:1), obsługa klawisza `Escape` i semantyczne role modali | Weryfikacja stylów i zachowania klawiatury | `NAPRAWIONE` | Brak |
| **AUDIT-P2-03** | Cykl życia danych | Brak automatycznego wygasania dla ogłoszeń „Oddam za darmo” (jedynie wystawki mają 48h) | Wprowadzenie TTL (domyślnie 14 dni) dla „Oddam” z możliwością przedłużenia przez autora | Testy kalkulacji wygasania | `NAPRAWIONE` | Brak |
| **AUDIT-P2-04** | SEO / Social | Statyczne metatagi Open Graph uniemożliwiające podgląd konkretnego ogłoszenia | Dynamiczne zarządzanie `document.title`, `og:title`, `og:description`, `og:image` w DOM na Web | Weryfikacja DOM w runtime WWW | `NAPRAWIONE` | Pełny serwerowy SSR OG dla crawlerów wymaga Vercel Edge Middleware |
| **AUDIT-P3-01** | UX / Onboarding | Nowy użytkownik nie rozumie różnicy między wystawką a oddaniem za darmo | Kompaktowy pasek/moduł edukacyjny wyjaśniający zasady obu typów ogłoszeń w `DesktopWebLayout` i `WystawkaDashboard` | Weryfikacja wizualna i testy layoutu | `NAPRAWIONE` | Brak |
| **AUDIT-P3-02** | SEO | Brak mapy witryny (`sitemap.xml`) i pliku `robots.txt` dla domeny | Wygenerowanie `public/sitemap.xml` oraz `public/robots.txt` | Weryfikacja plików w eksporcie WWW | `NAPRAWIONE` | Brak |
| **HIPOTEZA-01** | Wydajność / Prawne | Kafelki OpenStreetMap podlegają Tile Usage Policy przy dużej skali | Zbadana: obecne użycie w granicach dopuszczalnych z prawidłowym copyright; przy >10k req/dzień zalecany dostawca CARTO/Stadia | Analiza w raporcie końcowym | `ZWERYFIKOWANA` | Brak |
| **HIPOTEZA-02** | Prywatność | Geofencing / nieprecyzyjne współrzędne dla odbioru domowego vs wystawki | Zbadana: wdrożone rozróżnienie `isExact` (wystawka: dokładny punkt; oddam: orientacyjny obszar prywatności) | Weryfikacja wizualna i w typach | `ZWERYFIKOWANA / WDROŻONA` | Brak |
| **HIPOTEZA-03** | Bezpieczeństwo | Wykrywanie numerów telefonów i adresów email w opisach | Funkcja `detectPiiInText` ostrzegająca autora przed publicznym ujawnianiem danych kontaktowych przed publikacją | Testy jednostkowe regexu (3 testy OK) | `ZWERYFIKOWANA / WDROŻONA` | Brak |

# 🚛 Śmieciarka - Aplikacja Zero-Waste & Wystawki

Aplikacja mobilna na iOS (iPhone) oraz Androida, pozwalająca użytkownikom:
1. **Zgłaszać i lokalizować "wystawki uliczne"** (gabaryty, meble, książki i skarby pozostawione na chodnikach / przy wiatach śmietnikowych).
2. **Oddawać za darmo niepotrzebne przedmioty** (z rąk do rąk, z odbiorem osobistym i ochroną prywatności adresu).

---

## 🛠️ Zastosowane technologie
- **Framework:** React Native + Expo (TypeScript)
- **Komponenty mapowe:** `react-native-maps` (Apple Maps / Google Maps)
- **Geolokalizacja:** `expo-location` (GPS, reverse geocoding, obliczanie odległości haversine)
- **Aparat i Galeria:** `expo-image-picker`
- **Ikony i styl:** `@expo/vector-icons` (Material Community Icons)
- **Gotowość do backendu:** Przygotowany model pod Supabase (PostgreSQL + PostGIS)

---

## 🚀 Jak uruchomić aplikację na swoim iPhonie w 2 minuty:

1. Pobierz darmową aplikację **Expo Go** z App Store na swój iPhone.
2. Upewnij się, że komputer i iPhone są podłączone do **tej samej sieci Wi-Fi**.
3. W terminalu w folderze `d:\Praca\smieciarka` wpisz:
   ```bash
   npx expo start
   ```
4. Na ekranie w terminalu pojawi się duży kod **QR**.
5. Otwórz zwykły aparat w iPhonie i skieruj go na kod QR -> kliknij żółtą chmurkę *"Otwórz w Expo Go"*.
6. Aplikacja „Śmieciarka” załaduje się bezpośrednio na Twoim telefonie!

---

## 📱 Zrealizowane funkcje (Wersja MVP 1.0):
- **Widok mapy & Widok listy:** Płynne przełączanie między mapą z pinezkami a listą sortowaną po odległości (*np. 150 m stąd*).
- **Filtrowanie:** Wszystko / Tylko Wystawki uliczne (pomarańczowe) / Tylko Oddam za darmo (niebieskie).
- **Szybkie dodawanie w 15 sekund:** Zrób zdjęcie aparatem lub wybierz z galerii, pobierz współrzędne z GPS, wybierz kategorię i opublikuj.
- **Weryfikacja społecznościowa wystawek:** Przyciski *"Jeszcze stoi"* oraz *"Już zabrane"* dla dynamicznego czyszczenia nieaktualnych punktów.
- **Nawigacja jednym kliknięciem:** Przycisk *"Nawiguj do celu"*, który otwiera Apple Maps z wyznaczoną trasą.

import { MaterialCommunityIcons } from '@expo/vector-icons';

export type TutorialTargetId =
  | 'camera'
  | 'search'
  | 'rewir'
  | 'categories'
  | 'map'
  | 'eco'
  | 'air_quality'
  | 'board';

export interface TutorialStepConfig {
  id: string;
  stepNumber: number;
  totalSteps: number;
  targetId: TutorialTargetId;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  arrowPosition: 'top' | 'bottom';
  arrowAlign?: 'center' | 'left' | 'right';
  targetScrollY?: number;
}

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  {
    id: 'step_camera',
    stepNumber: 1,
    totalSteps: 8,
    targetId: 'camera',
    title: 'Dodawaj znaleziska wprost z miejsca w którym stoisz',
    description:
      'Kliknij przycisk aparatu, aby zrobić zdjęcie wystawki lub rzeczy do oddania za darmo i natychmiast oznaczyć jej lokalizację GPS dla sąsiadów.',
    icon: 'camera',
    iconColor: '#10B981',
    arrowPosition: 'bottom',
    arrowAlign: 'center',
    targetScrollY: 0,
  },
  {
    id: 'step_search',
    stepNumber: 2,
    totalSteps: 8,
    targetId: 'search',
    title: 'Wyszukiwarka skarbów w okolicy',
    description:
      'Wpisz szukany przedmiot (np. fotel, rower, pralka) lub użyj ikony mikrofonu, aby błyskawicznie sprawdzić wystawki w Twojej okolicy.',
    icon: 'magnify',
    iconColor: '#38BDF8',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 0,
  },
  {
    id: 'step_rewir',
    stepNumber: 3,
    totalSteps: 8,
    targetId: 'rewir',
    title: 'Mój rewir i alerty sąsiedzkie',
    description:
      'Przesuń suwak, aby ustawić promień poszukiwań (od 1 km do 50 km) lub wybierz całe miasto, województwo czy całą Polskę i włącz powiadomienia o nowych wystawkach.',
    icon: 'map-marker-radius',
    iconColor: '#10B981',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 100,
  },
  {
    id: 'step_categories',
    stepNumber: 4,
    totalSteps: 8,
    targetId: 'categories',
    title: 'Kafelki szybkiego dostępu',
    description:
      'Przeglądaj ogłoszenia podzielone na Wystawki uliczne, rzeczy Oddam za darmo, pytania na Tablicy oraz swoje Zapisane perełki w jednym miejscu.',
    icon: 'view-grid-outline',
    iconColor: '#F59E0B',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 260,
  },
  {
    id: 'step_map',
    stepNumber: 5,
    totalSteps: 8,
    targetId: 'map',
    title: 'Interaktywna mapa wystawek na żywo',
    description:
      'Kliknij kafel Mapa, aby przeglądać wszystkie aktywne wystawki i darmowe przedmioty na żywo z dokładną odległością od Twojej pozycji.',
    icon: 'navigation-variant',
    iconColor: '#10B981',
    arrowPosition: 'top',
    arrowAlign: 'right',
    targetScrollY: 420,
  },
  {
    id: 'step_eco',
    stepNumber: 6,
    totalSteps: 8,
    targetId: 'eco',
    title: 'Twój wpływ Zero-Waste i seria dni',
    description:
      'Śledź ile przedmiotów uratowałeś przed wysypiskiem, ile kg CO₂ zaoszczędziłeś planecie oraz utrzymuj codzienną serię aktywności.',
    icon: 'leaf',
    iconColor: '#10B981',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 520,
  },
  {
    id: 'step_air_quality',
    stepNumber: 7,
    totalSteps: 8,
    targetId: 'air_quality',
    title: 'Czyste powietrze – GPS na żywo',
    description:
      'Sprawdzaj aktualny indeks jakości powietrza (AQI) oraz stężenie pyłów PM2.5 i PM10 w miejscu, w którym aktualnie polujesz na skarby.',
    icon: 'weather-windy',
    iconColor: '#059669',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 760,
  },
  {
    id: 'step_board',
    stepNumber: 8,
    totalSteps: 8,
    targetId: 'board',
    title: 'Sąsiedzka tablica ogłoszeń',
    description:
      'Tutaj możesz zapytać sąsiadów o pomoc, zgłosić poszukiwany przedmiot lub oddawać niepotrzebne rzeczy bezpośrednio z rąk do rąk.',
    icon: 'clipboard-text',
    iconColor: '#38BDF8',
    arrowPosition: 'bottom',
    arrowAlign: 'right',
    targetScrollY: 0,
  },
];

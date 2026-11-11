import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface TutorialStepConfig {
  id: string;
  stepNumber: number;
  totalSteps: number;
  targetId: 'camera' | 'search' | 'rewir' | 'map' | 'board';
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
    totalSteps: 5,
    targetId: 'camera',
    title: 'Dodawaj znaleziska wprost z miejsca w którym stoisz',
    description: 'Kliknij przycisk aparatu, aby zrobić zdjęcie wystawki lub rzeczy do oddania za darmo i natychmiast oznaczyć jej lokalizację GPS dla sąsiadów.',
    icon: 'map-marker-radius',
    iconColor: '#10B981',
    arrowPosition: 'bottom',
    arrowAlign: 'center',
    targetScrollY: 0,
  },
  {
    id: 'step_search',
    stepNumber: 2,
    totalSteps: 5,
    targetId: 'search',
    title: 'Wyszukiwarka skarbów w okolicy',
    description: 'Wpisz szukany przedmiot (np. fotel, rower, pralka) lub użyj ikony mikrofonu, aby błyskawicznie sprawdzić wystawki w Twojej okolicy.',
    icon: 'magnify',
    iconColor: '#38BDF8',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 0,
  },
  {
    id: 'step_rewir',
    stepNumber: 3,
    totalSteps: 5,
    targetId: 'rewir',
    title: 'Mój rewir i alerty sąsiedzkie',
    description: 'Przesuń suwak, aby ustawić promień poszukiwań (od 1 km do 50 km) lub wybierz całe miasto, województwo czy całą Polskę i włącz powiadomienia o nowych wystawkach.',
    icon: 'map-marker-radius',
    iconColor: '#10B981',
    arrowPosition: 'top',
    arrowAlign: 'center',
    targetScrollY: 130,
  },
  {
    id: 'step_map',
    stepNumber: 4,
    totalSteps: 5,
    targetId: 'map',
    title: 'Interaktywna mapa wystawek na żywo',
    description: 'Kliknij kafel Mapa, aby przeglądać wszystkie aktywne wystawki i darmowe przedmioty na żywo z dokładną odległością od Twojej pozycji.',
    icon: 'navigation-variant',
    iconColor: '#10B981',
    arrowPosition: 'top',
    arrowAlign: 'right',
    targetScrollY: 260,
  },
  {
    id: 'step_board',
    stepNumber: 5,
    totalSteps: 5,
    targetId: 'board',
    title: 'Sąsiedzka tablica ogłoszeń',
    description: 'Tutaj możesz zapytać sąsiadów o pomoc, zgłosić poszukiwany przedmiot lub oddawać niepotrzebne rzeczy bezpośrednio z rąk do rąk.',
    icon: 'clipboard-text',
    iconColor: '#38BDF8',
    arrowPosition: 'bottom',
    arrowAlign: 'right',
    targetScrollY: 0,
  },
];

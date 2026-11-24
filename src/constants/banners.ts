import { ImageSourcePropType } from 'react-native';

export type BannerSlotId = 'home' | 'web' | 'map' | 'list' | 'board' | 'saved' | 'top_header';

export type CustomBannerImages = Partial<Record<BannerSlotId, string | string[]>>;

export interface BannerSlotMeta {
  id: BannerSlotId;
  label: string;
  locationHint: string;
  defaultLabel: string;
  defaultSource: ImageSourcePropType;
}

export const DEFAULT_WEB_BANNERS: ImageSourcePropType[] = [
  require('../assets/web_banner_1.webp'),
  require('../assets/web_banner_2.webp'),
  require('../assets/web_banner_3.webp'),
  require('../assets/web_banner_4.webp'),
  require('../assets/web_banner_5.webp'),
  require('../assets/web_banner_6.webp'),
];

export const DEFAULT_HOME_BANNERS: ImageSourcePropType[] = [
  require('../assets/mobile_banner_1.webp'),
  require('../assets/mobile_banner_2.webp'),
  require('../assets/mobile_banner_3.webp'),
  require('../assets/mobile_banner_4.webp'),
  require('../assets/mobile_banner_5.webp'),
  require('../assets/mobile_banner_6.webp'),
];

export const BANNER_SLOTS: BannerSlotMeta[] = [
  {
    id: 'home',
    label: 'Baner Główny – Pulpit (Telefon / Aplikacja)',
    locationHint: 'Główny baner na telefonach i w aplikacji mobilnej (jeśli brak banera WWW, wyświetli się też na komputerze)',
    defaultLabel: 'Rotujące banery aplikacji mobilnej (6 motywów, 1024×237, co 3s)',
    defaultSource: require('../assets/mobile_banner_1.webp'),
  },
  {
    id: 'web',
    label: 'Baner Główny – Strona WWW (Komputery / Panorama)',
    locationHint: 'Panoramiczny baner na komputerach (jeśli brak banera telefonu, wyświetli się też na telefonie)',
    defaultLabel: 'Rotujące banery strony WWW (6 motywów, 1024×236)',
    defaultSource: require('../assets/web_banner_1.webp'),
  },
  {
    id: 'map',
    label: 'Baner na Mapie',
    locationHint: 'Góra ekranu w zakładce Mapa',
    defaultLabel: 'Domyślny baner Mapy',
    defaultSource: require('../assets/map_ad_banner.jpg'),
  },
  {
    id: 'list',
    label: 'Baner na Liście',
    locationHint: 'Góra ekranu w zakładce Lista',
    defaultLabel: 'sprawdzto24.pl (GIF)',
    defaultSource: require('../assets/list_ad_banner.gif'),
  },
  {
    id: 'board',
    label: 'Baner na Tablicy',
    locationHint: 'Góra ekranu w zakładce Tablica',
    defaultLabel: 'scraperek.online (GIF)',
    defaultSource: require('../assets/board_ad_banner.gif'),
  },
  {
    id: 'saved',
    label: 'Baner w Zapisanych',
    locationHint: 'Góra ekranu w zakładce Zapisane',
    defaultLabel: 'Wypożyczalnia Smaku (GIF)',
    defaultSource: require('../assets/saved_ad_banner.gif'),
  },
  {
    id: 'top_header',
    label: 'Baner Górny – Nad Menu i Logo (Strona WWW)',
    locationHint: 'Wyświetlany na samej górze strony WWW, bezpośrednio nad logo oraz panelem nawigacyjnym',
    defaultLabel: 'Tu jest miejsce na Twoją reklamę (JPG)',
    defaultSource: require('../assets/top_header_banner.jpg'),
  },
];

const BANNER_SLOTS_BY_ID: Record<BannerSlotId, BannerSlotMeta> = BANNER_SLOTS.reduce(
  (acc, slot) => {
    acc[slot.id] = slot;
    return acc;
  },
  {} as Record<BannerSlotId, BannerSlotMeta>
);

export function getCustomBannerList(
  slotId: BannerSlotId,
  customBanners?: CustomBannerImages
): string[] {
  if (!customBanners) return [];
  const raw = customBanners[slotId];
  if (Array.isArray(raw)) {
    return raw.map((u) => u.trim()).filter((u) => u.length > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
  }
  return [];
}

export function resolveBannerImages(
  slotId: BannerSlotId,
  customBanners?: CustomBannerImages
): ImageSourcePropType[] {
  const uris = getCustomBannerList(slotId, customBanners);
  if (uris.length > 0) {
    return uris.map((uri) => ({ uri }));
  }

  // Inteligentne współdzielenie banera głównego:
  // Jeśli użytkownik dodał własne banery do slotu 'home' (Pulpit aplikacji/telefon),
  // a slot 'web' (Strona WWW na komputerze) nie ma własnych banerów – używamy banerów z 'home' na WWW!
  if (slotId === 'web') {
    const homeUris = getCustomBannerList('home', customBanners);
    if (homeUris.length > 0) {
      return homeUris.map((uri) => ({ uri }));
    }
    return DEFAULT_WEB_BANNERS;
  }

  // Pulpit aplikacji mobilnej (jeśli brak własnych banerów, rotacja 6 domyślnych motywów)
  if (slotId === 'home') {
    return DEFAULT_HOME_BANNERS;
  }

  return [BANNER_SLOTS_BY_ID[slotId].defaultSource];
}

export function resolveBannerSource(
  slotId: BannerSlotId,
  customBanners?: CustomBannerImages
): ImageSourcePropType {
  const images = resolveBannerImages(slotId, customBanners);
  return images[0] || BANNER_SLOTS_BY_ID[slotId].defaultSource;
}

import { ImageSourcePropType } from 'react-native';

export type BannerSlotId = 'home' | 'web' | 'map' | 'list' | 'board' | 'saved';

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

export const BANNER_SLOTS: BannerSlotMeta[] = [
  {
    id: 'home',
    label: 'Baner Główny – Pulpit (Telefon / Aplikacja)',
    locationHint: 'Główny baner na telefonach i w aplikacji mobilnej (jeśli brak banera WWW, wyświetli się też na komputerze)',
    defaultLabel: 'Domyślny baner aplikacji mobilnej',
    defaultSource: require('../assets/mobile_ad_banner.webp'),
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

  // I odwrotnie: jeśli slot 'web' ma własne banery, a 'home' nie ma – używamy banerów z 'web' na pulpicie aplikacji!
  if (slotId === 'home') {
    const webUris = getCustomBannerList('web', customBanners);
    if (webUris.length > 0) {
      return webUris.map((uri) => ({ uri }));
    }
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

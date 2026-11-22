import { ImageSourcePropType } from 'react-native';

export type BannerSlotId = 'home' | 'web' | 'map' | 'list' | 'board' | 'saved';

export type CustomBannerImages = Partial<Record<BannerSlotId, string>>;

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
    label: 'Baner na Pulpicie (Aplikacja)',
    locationHint: 'Pulpit w aplikacji mobilnej (nad wyszukiwarką)',
    defaultLabel: 'Domyślny baner aplikacji mobilnej',
    defaultSource: require('../assets/mobile_ad_banner.webp'),
  },
  {
    id: 'web',
    label: 'Baner na Stronie Głównej (WWW)',
    locationHint: 'Strona główna WWW na komputerach (rotacja banerów co 4s)',
    defaultLabel: 'Rotujące banery strony WWW (6 motywów, 1024×236)',
    defaultSource: require('../assets/web_banner_1.webp'),
  },
  {
    id: 'map',
    label: 'Baner na Mapie',
    locationHint: 'Góra ekranu w zakładce Mapa',
    defaultLabel: 'Domyślny baner Mapy',
    defaultSource: require('../assets/map_ad_banner.webp'),
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

export function resolveBannerSource(
  slotId: BannerSlotId,
  customBanners?: CustomBannerImages
): ImageSourcePropType {
  const customUri = customBanners?.[slotId]?.trim();
  if (customUri) {
    return { uri: customUri };
  }
  return BANNER_SLOTS_BY_ID[slotId].defaultSource;
}

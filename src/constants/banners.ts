import { ImageSourcePropType } from 'react-native';

export type BannerSlotId = 'home' | 'map' | 'list' | 'board' | 'saved';

export type CustomBannerImages = Partial<Record<BannerSlotId, string>>;

export interface BannerSlotMeta {
  id: BannerSlotId;
  label: string;
  locationHint: string;
  defaultLabel: string;
  defaultSource: ImageSourcePropType;
}

export const BANNER_SLOTS: BannerSlotMeta[] = [
  {
    id: 'home',
    label: 'Baner na Pulpicie',
    locationHint: 'Główny ekran Pulpit (nad wyszukiwarką)',
    defaultLabel: 'Domyślny baner Śmieciarki',
    defaultSource: require('../assets/ad_banner.webp'),
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

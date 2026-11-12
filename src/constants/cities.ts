export interface CityOption {
  id: string;
  name: string;
  voivodeship: string;
  latitude: number;
  longitude: number;
  isPopular?: boolean;
}

/**
 * Normalizuje polski tekst do porównywania bez względu na wielkość liter i znaki diakrytyczne.
 */
export function normalizePolishText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getCityDisplayLabel(
  selectedCity: CityOption | null,
  gpsCityName?: string | null
): string {
  if (selectedCity) {
    return selectedCity.name;
  }
  if (gpsCityName) {
    return `${gpsCityName} (GPS)`;
  }
  return 'Moja lokalizacja (GPS)';
}

export const POLISH_CITIES: CityOption[] = [
  { id: 'warszawa', name: 'Warszawa', voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, isPopular: true },
  { id: 'krakow', name: 'Kraków', voivodeship: 'małopolskie', latitude: 50.0647, longitude: 19.9450, isPopular: true },
  { id: 'wroclaw', name: 'Wrocław', voivodeship: 'dolnośląskie', latitude: 51.1079, longitude: 17.0385, isPopular: true },
  { id: 'lodz', name: 'Łódź', voivodeship: 'łódzkie', latitude: 51.7592, longitude: 19.4560, isPopular: true },
  { id: 'poznan', name: 'Poznań', voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, isPopular: true },
  { id: 'gdansk', name: 'Gdańsk', voivodeship: 'pomorskie', latitude: 54.3520, longitude: 18.6466, isPopular: true },
  { id: 'szczecin', name: 'Szczecin', voivodeship: 'zachodniopomorskie', latitude: 53.4285, longitude: 14.5528, isPopular: true },
  { id: 'bydgoszcz', name: 'Bydgoszcz', voivodeship: 'kujawsko-pomorskie', latitude: 53.1235, longitude: 18.0084, isPopular: true },
  { id: 'lublin', name: 'Lublin', voivodeship: 'lubelskie', latitude: 51.2465, longitude: 22.5684, isPopular: true },
  { id: 'bialystok', name: 'Białystok', voivodeship: 'podlaskie', latitude: 53.1325, longitude: 23.1688, isPopular: true },
  { id: 'katowice', name: 'Katowice', voivodeship: 'śląskie', latitude: 50.2649, longitude: 19.0238, isPopular: true },
  { id: 'gdynia', name: 'Gdynia', voivodeship: 'pomorskie', latitude: 54.5189, longitude: 18.5305, isPopular: true },
  { id: 'czestochowa', name: 'Częstochowa', voivodeship: 'śląskie', latitude: 50.8118, longitude: 19.1203 },
  { id: 'radom', name: 'Radom', voivodeship: 'mazowieckie', latitude: 51.4027, longitude: 21.1471 },
  { id: 'torun', name: 'Toruń', voivodeship: 'kujawsko-pomorskie', latitude: 53.0138, longitude: 18.5984, isPopular: true },
  { id: 'sosnowiec', name: 'Sosnowiec', voivodeship: 'śląskie', latitude: 50.2863, longitude: 19.1041 },
  { id: 'rzeszow', name: 'Rzeszów', voivodeship: 'podkarpackie', latitude: 50.0412, longitude: 21.9991, isPopular: true },
  { id: 'kielce', name: 'Kielce', voivodeship: 'świętokrzyskie', latitude: 50.8661, longitude: 20.6286, isPopular: true },
  { id: 'gliwice', name: 'Gliwice', voivodeship: 'śląskie', latitude: 50.2945, longitude: 18.6714 },
  { id: 'olsztyn', name: 'Olsztyn', voivodeship: 'warmińsko-mazurskie', latitude: 53.7784, longitude: 20.4801, isPopular: true },
  { id: 'zabrze', name: 'Zabrze', voivodeship: 'śląskie', latitude: 50.3249, longitude: 18.7857 },
  { id: 'bielsko-biala', name: 'Bielsko-Biała', voivodeship: 'śląskie', latitude: 49.8224, longitude: 19.0444 },
  { id: 'bytom', name: 'Bytom', voivodeship: 'śląskie', latitude: 50.3484, longitude: 18.9157 },
  { id: 'zielona-gora', name: 'Zielona Góra', voivodeship: 'lubuskie', latitude: 51.9356, longitude: 15.5062, isPopular: true },
  { id: 'rybnik', name: 'Rybnik', voivodeship: 'śląskie', latitude: 50.1022, longitude: 18.5463 },
  { id: 'ruda-slaska', name: 'Ruda Śląska', voivodeship: 'śląskie', latitude: 50.2558, longitude: 18.8556 },
  { id: 'opole', name: 'Opole', voivodeship: 'opolskie', latitude: 50.6751, longitude: 17.9213, isPopular: true },
  { id: 'tychy', name: 'Tychy', voivodeship: 'śląskie', latitude: 50.1372, longitude: 18.9664 },
  { id: 'gorzow-wielkopolski', name: 'Gorzów Wielkopolski', voivodeship: 'lubuskie', latitude: 52.7325, longitude: 15.2369, isPopular: true },
  { id: 'elblag', name: 'Elbląg', voivodeship: 'warmińsko-mazurskie', latitude: 54.1522, longitude: 19.4088 },
  { id: 'plock', name: 'Płock', voivodeship: 'mazowieckie', latitude: 52.5463, longitude: 19.7065 },
  { id: 'dabrowa-gornicza', name: 'Dąbrowa Górnicza', voivodeship: 'śląskie', latitude: 50.3217, longitude: 19.1949 },
  { id: 'walbrzych', name: 'Wałbrzych', voivodeship: 'dolnośląskie', latitude: 50.7714, longitude: 16.2843 },
  { id: 'wloclawek', name: 'Włocławek', voivodeship: 'kujawsko-pomorskie', latitude: 52.6483, longitude: 19.0677 },
  { id: 'tarnow', name: 'Tarnów', voivodeship: 'małopolskie', latitude: 50.0121, longitude: 20.9858 },
  { id: 'chorzow', name: 'Chorzów', voivodeship: 'śląskie', latitude: 50.2975, longitude: 18.9546 },
  { id: 'koszalin', name: 'Koszalin', voivodeship: 'zachodniopomorskie', latitude: 54.1944, longitude: 16.1715 },
  { id: 'kalisz', name: 'Kalisz', voivodeship: 'wielkopolskie', latitude: 51.7611, longitude: 18.0910 },
  { id: 'legnica', name: 'Legnica', voivodeship: 'dolnośląskie', latitude: 51.2070, longitude: 16.1553 },
  { id: 'grudziadz', name: 'Grudziądz', voivodeship: 'kujawsko-pomorskie', latitude: 53.4837, longitude: 18.7536 },
  { id: 'jaworzno', name: 'Jaworzno', voivodeship: 'śląskie', latitude: 50.2053, longitude: 19.2749 },
  { id: 'slupsk', name: 'Słupsk', voivodeship: 'pomorskie', latitude: 54.4641, longitude: 17.0285 },
  { id: 'jastrzebie-zdroj', name: 'Jastrzębie-Zdrój', voivodeship: 'śląskie', latitude: 49.9478, longitude: 18.5997 },
  { id: 'nowy-sacz', name: 'Nowy Sącz', voivodeship: 'małopolskie', latitude: 49.6218, longitude: 20.6971 },
  { id: 'jelenia-gora', name: 'Jelenia Góra', voivodeship: 'dolnośląskie', latitude: 50.9044, longitude: 15.7194 },
  { id: 'siedlce', name: 'Siedlce', voivodeship: 'mazowieckie', latitude: 52.1676, longitude: 22.2902 },
  { id: 'myslowice', name: 'Mysłowice', voivodeship: 'śląskie', latitude: 50.2080, longitude: 19.1661 },
  { id: 'konin', name: 'Konin', voivodeship: 'wielkopolskie', latitude: 52.2230, longitude: 18.2512 },
  { id: 'pila', name: 'Piła', voivodeship: 'wielkopolskie', latitude: 53.1511, longitude: 16.7380 },
  { id: 'piotrkow-trybunalski', name: 'Piotrków Trybunalski', voivodeship: 'łódzkie', latitude: 51.4052, longitude: 19.7030 },
  { id: 'inowroclaw', name: 'Inowrocław', voivodeship: 'kujawsko-pomorskie', latitude: 52.7931, longitude: 18.2602 },
  { id: 'lubin', name: 'Lubin', voivodeship: 'dolnośląskie', latitude: 51.4009, longitude: 16.2015 },
  { id: 'ostrow-wielkopolski', name: 'Ostrów Wielkopolski', voivodeship: 'wielkopolskie', latitude: 51.6550, longitude: 17.8069 },
  { id: 'suwalki', name: 'Suwałki', voivodeship: 'podlaskie', latitude: 54.1115, longitude: 22.9308 },
  { id: 'stargard', name: 'Stargard', voivodeship: 'zachodniopomorskie', latitude: 53.3364, longitude: 15.0504 },
  { id: 'gniezno', name: 'Gniezno', voivodeship: 'wielkopolskie', latitude: 52.5349, longitude: 17.5826 },
  { id: 'ostrowiec-swietokrzyski', name: 'Ostrowiec Świętokrzyski', voivodeship: 'świętokrzyskie', latitude: 50.9293, longitude: 21.3854 },
  { id: 'glogow', name: 'Głogów', voivodeship: 'dolnośląskie', latitude: 51.6636, longitude: 16.0845 },
  { id: 'pabianice', name: 'Pabianice', voivodeship: 'łódzkie', latitude: 51.6644, longitude: 19.3547 },
  { id: 'zory', name: 'Żory', voivodeship: 'śląskie', latitude: 50.0457, longitude: 18.6939 },
  { id: 'zamosc', name: 'Zamość', voivodeship: 'lubelskie', latitude: 50.7231, longitude: 23.2520 },
  { id: 'leszno', name: 'Leszno', voivodeship: 'wielkopolskie', latitude: 51.8419, longitude: 16.5749 },
  { id: 'lomza', name: 'Łomża', voivodeship: 'podlaskie', latitude: 53.1781, longitude: 22.0590 },
  { id: 'chelm', name: 'Chełm', voivodeship: 'lubelskie', latitude: 51.1431, longitude: 23.4712 },
  { id: 'tomaszow-mazowiecki', name: 'Tomaszów Mazowiecki', voivodeship: 'łódzkie', latitude: 51.5314, longitude: 20.0085 },
  { id: 'przemysl', name: 'Przemyśl', voivodeship: 'podkarpackie', latitude: 49.7839, longitude: 22.7678 },
  { id: 'elk', name: 'Ełk', voivodeship: 'warmińsko-mazurskie', latitude: 53.8281, longitude: 22.3647 },
  { id: 'stalowa-wola', name: 'Stalowa Wola', voivodeship: 'podkarpackie', latitude: 50.5826, longitude: 22.0536 },
  { id: 'mielec', name: 'Mielec', voivodeship: 'podkarpackie', latitude: 50.2871, longitude: 21.4239 },
  { id: 'tczew', name: 'Tczew', voivodeship: 'pomorskie', latitude: 54.0924, longitude: 18.7779 },
  { id: 'biala-podlaska', name: 'Biała Podlaska', voivodeship: 'lubelskie', latitude: 52.0324, longitude: 23.1165 },
  { id: 'belchatow', name: 'Bełchatów', voivodeship: 'łódzkie', latitude: 51.3688, longitude: 19.3567 },
  { id: 'swidnica', name: 'Świdnica', voivodeship: 'dolnośląskie', latitude: 50.8438, longitude: 16.4886 },
  { id: 'legionowo', name: 'Legionowo', voivodeship: 'mazowieckie', latitude: 52.4021, longitude: 20.9277 },
  { id: 'ostroleka', name: 'Ostrołęka', voivodeship: 'mazowieckie', latitude: 53.0842, longitude: 21.5754 },
  { id: 'pulawy', name: 'Puławy', voivodeship: 'lubelskie', latitude: 51.4165, longitude: 21.9694 },
  { id: 'kolobrzeg', name: 'Kołobrzeg', voivodeship: 'zachodniopomorskie', latitude: 54.1759, longitude: 15.5833 },
  { id: 'krosno', name: 'Krosno', voivodeship: 'podkarpackie', latitude: 49.6887, longitude: 21.7706 },
  { id: 'sopot', name: 'Sopot', voivodeship: 'pomorskie', latitude: 54.4416, longitude: 18.5601 },
  { id: 'zakopane', name: 'Zakopane', voivodeship: 'małopolskie', latitude: 49.2992, longitude: 19.9496 },
  { id: 'swinoujscie', name: 'Świnoujście', voivodeship: 'zachodniopomorskie', latitude: 53.9105, longitude: 14.2471 },
];

import React from 'react';
import Svg, {
  G,
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

interface GarbageTruckIconProps {
  size?: number;
}

export const GarbageTruckIcon: React.FC<GarbageTruckIconProps> = ({ size = 64 }) => {
  // Oryginalny viewBox: 0 0 120 80
  const width = size;
  const height = (size * 80) / 120;

  return (
    <Svg width={width} height={height} viewBox="0 0 120 80" fill="none">
      <Defs>
        {/* Gradient dla kontenera śmieciarki */}
        <LinearGradient id="compactorGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#10B981" />
          <Stop offset="100%" stopColor="#047857" />
        </LinearGradient>

        {/* Gradient dla kabiny kierowcy */}
        <LinearGradient id="cabinGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#E2E8F0" />
        </LinearGradient>

        {/* Gradient szyby */}
        <LinearGradient id="windowGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#67E8F9" />
          <Stop offset="100%" stopColor="#0284C7" />
        </LinearGradient>
      </Defs>

      <G>
        {/* 1. Pomarańczowy kogut ostrzegawczy na dachu kabiny */}
        <Path d="M96 14 H102 V18 H96 Z" fill="#F59E0B" />
        <Circle cx="99" cy="13" r="3" fill="#FBBF24" />

        {/* 2. Główny kontener / zabudowa śmieciarki (tył) */}
        {/* Zaokrąglona bryła ze skośnym tyłem zgniatacza */}
        <Path
          d="M10 20 H78 V58 H16 C12 58 8 54 8 50 L10 20 Z"
          fill="url(#compactorGrad)"
        />

        {/* Przetłoczenia / paski na zabudowie */}
        <Rect x="16" y="24" width="4" height="30" rx="2" fill="#047857" opacity="0.4" />
        <Rect x="26" y="24" width="4" height="30" rx="2" fill="#047857" opacity="0.4" />
        <Rect x="36" y="24" width="4" height="30" rx="2" fill="#047857" opacity="0.4" />

        {/* Tylny stopień / wrzutnik na odpady */}
        <Path d="M4 38 H10 V54 H4 C2 54 2 38 4 38 Z" fill="#334155" />
        <Rect x="2" y="52" width="6" height="3" rx="1" fill="#94A3B8" />

        {/* 3. Symbol recyklingu na boku śmieciarki (trzy białe strzałki) */}
        <G transform="translate(44, 28) scale(0.65)">
          {/* Strzałka 1 (góra) */}
          <Path
            d="M18 4 L24 14 H12 Z"
            fill="#FFFFFF"
          />
          <Path
            d="M18 10 C24 10 28 14 28 20"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Strzałka 2 (prawo dół) */}
          <Path
            d="M30 24 L32 36 L21 31 Z"
            fill="#FFFFFF"
          />
          <Path
            d="M26 26 C22 30 16 30 10 26"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Strzałka 3 (lewo dół) */}
          <Path
            d="M6 24 L14 19 L11 31 Z"
            fill="#FFFFFF"
          />
          <Path
            d="M10 20 C10 14 14 10 18 10"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </G>

        {/* 4. Kabina kierowcy (przód) */}
        <Path
          d="M78 18 H98 C104 18 108 22 110 27 L114 43 C115 45 115 58 110 58 H78 V18 Z"
          fill="url(#cabinGrad)"
        />

        {/* Przednia szyba */}
        <Path
          d="M82 22 H96 C99 22 102 24 103 27 L107 38 H82 V22 Z"
          fill="url(#windowGrad)"
        />

        {/* Boczna szybka pasażera */}
        <Rect x="82" y="24" width="12" height="12" rx="2" fill="#38BDF8" opacity="0.6" />

        {/* Przedni grill i zderzak */}
        <Path d="M108 45 H115 V56 H108 Z" fill="#475569" />
        <Rect x="110" y="47" width="5" height="2" rx="1" fill="#94A3B8" />
        <Rect x="110" y="51" width="5" height="2" rx="1" fill="#94A3B8" />

        {/* Przednie reflektory */}
        <Rect x="112" y="41" width="3" height="4" rx="1" fill="#FDE047" />

        {/* Klamka */}
        <Rect x="86" y="42" width="5" height="2" rx="1" fill="#64748B" />

        {/* Podwozie / rama */}
        <Rect x="14" y="56" width="96" height="5" rx="2" fill="#1E293B" />

        {/* 5. Koła śmieciarki (duże z felgami) */}
        {/* Koło tylne lewe */}
        <Circle cx="26" cy="62" r="11" fill="#0F172A" />
        <Circle cx="26" cy="62" r="6" fill="#94A3B8" />
        <Circle cx="26" cy="62" r="2.5" fill="#0F172A" />

        {/* Koło tylne prawe (podwójna oś śmieciarki) */}
        <Circle cx="50" cy="62" r="11" fill="#0F172A" />
        <Circle cx="50" cy="62" r="6" fill="#94A3B8" />
        <Circle cx="50" cy="62" r="2.5" fill="#0F172A" />

        {/* Koło przednie */}
        <Circle cx="96" cy="62" r="11" fill="#0F172A" />
        <Circle cx="96" cy="62" r="6" fill="#94A3B8" />
        <Circle cx="96" cy="62" r="2.5" fill="#0F172A" />
      </G>
    </Svg>
  );
};

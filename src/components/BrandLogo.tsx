import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { THEME, APP_FONT } from '../constants/categories';

interface BrandLogoProps {
  size?: 'normal' | 'large';
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'normal',
  showSubtitle = true,
}) => {
  const isLarge = size === 'large';
  const squareSize = isLarge ? 54 : 48;
  const iconWidth = isLarge ? 36 : 31;
  const iconHeight = (iconWidth * 26) / 38;

  // Żółty kwadrat
  const yellowBg = '#FBBF24'; // Ciepły, nasycony żółty
  // Zielony kontur ciężarówki
  const greenStroke = '#047857'; // Głęboka, czytelna zieleń

  return (
    <View style={styles.container}>
      {/* Żółty zaokrąglony kwadrat z zielonym konturem ciężarówki */}
      <View
        style={[
          styles.squareTile,
          {
            width: squareSize,
            height: squareSize,
            borderRadius: isLarge ? 16 : 14,
            backgroundColor: yellowBg,
            shadowColor: yellowBg,
          },
        ]}
      >
        <Svg
          width={iconWidth}
          height={iconHeight}
          viewBox="0 0 38 26"
          fill="none"
        >
          {/* Kogut ostrzegawczy na dachu */}
          <Line
            x1="26"
            y1="5"
            x2="29"
            y2="5"
            stroke={greenStroke}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Zabudowa śmieciarki (tył / paka) */}
          <Path
            d="M3 7 H23 V20 H5 C3.9 20 3 19.1 3 18 V7 Z"
            stroke={greenStroke}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Przetłoczenie na pace / zarys komory */}
          <Line
            x1="9"
            y1="8.5"
            x2="9"
            y2="18.5"
            stroke={greenStroke}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <Line
            x1="15"
            y1="8.5"
            x2="15"
            y2="18.5"
            stroke={greenStroke}
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* Kabina kierowcy (przód) */}
          <Path
            d="M23 9 H28 C29.2 9 30.2 9.7 30.8 10.8 L34.5 15.5 C34.8 16 35 16.7 35 17.4 V20 H23"
            stroke={greenStroke}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Przednia szyba w kabinie */}
          <Path
            d="M25 11 H28.5 L31.5 15 H25 V11 Z"
            stroke={greenStroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          {/* Koła - wypełnienie w kolorze żółtego tła z zieloną obwódką */}
          {/* Koło 1 (tylne) */}
          <Circle
            cx="9"
            cy="20"
            r="3.2"
            stroke={greenStroke}
            strokeWidth="2"
            fill={yellowBg}
          />
          <Circle cx="9" cy="20" r="1.1" fill={greenStroke} />

          {/* Koło 2 (środkowe - podwójna oś śmieciarki) */}
          <Circle
            cx="17"
            cy="20"
            r="3.2"
            stroke={greenStroke}
            strokeWidth="2"
            fill={yellowBg}
          />
          <Circle cx="17" cy="20" r="1.1" fill={greenStroke} />

          {/* Koło 3 (przednie) */}
          <Circle
            cx="29"
            cy="20"
            r="3.2"
            stroke={greenStroke}
            strokeWidth="2"
            fill={yellowBg}
          />
          <Circle cx="29" cy="20" r="1.1" fill={greenStroke} />
        </Svg>
      </View>

      {/* Nazwa z pigułką "beta 1.0" i podtytułem */}
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.brandTitle, isLarge && styles.brandTitleLarge]}>
            Śmieciarka
          </Text>
          <View style={styles.betaPill}>
            <Text style={styles.betaPillText}>beta</Text>
          </View>
        </View>
        {showSubtitle && (
          <Text style={styles.brandSubtitle}>
            Ratuj rzeczy przed śmietnikiem
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  squareTile: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  textContainer: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontFamily: APP_FONT,
    fontSize: 21,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.4,
  },
  brandTitleLarge: {
    fontFamily: APP_FONT,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  betaPill: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignSelf: 'center',
  },
  betaPillText: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
  brandSubtitle: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
});

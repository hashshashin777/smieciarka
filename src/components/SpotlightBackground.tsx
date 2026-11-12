import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Jasne tło aplikacji z płynnym, centralnym oświetleniem (efekt radialnej poświaty).
 */
export const SpotlightBackground: React.FC = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient
            id="centralLightGlow"
            cx="50%"
            cy="46%"
            rx="68%"
            ry="54%"
            fx="50%"
            fy="46%"
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="28%" stopColor="#F8FAFC" stopOpacity="1" />
            <Stop offset="58%" stopColor="#EFF4F9" stopOpacity="1" />
            <Stop offset="84%" stopColor="#E2E8F0" stopOpacity="1" />
            <Stop offset="100%" stopColor="#CBD5E1" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#centralLightGlow)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#CBD5E1',
  },
});

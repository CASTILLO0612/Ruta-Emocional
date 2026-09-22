import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import RNMapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  UrlTile,
  type MapViewProps as RNMapViewProps,
} from 'react-native-maps';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  OPEN_STREET_MAP_ATTRIBUTION,
  OPEN_STREET_MAP_TILE_URL,
} from '../../config/mapProvider';

export { Marker, Polyline, PROVIDER_DEFAULT };

interface ExtendedMapViewProps extends RNMapViewProps {
  readonly routeStart?: { readonly latitude: number; readonly longitude: number };
  readonly routeEnd?: { readonly latitude: number; readonly longitude: number };
}

const MapView: React.FC<ExtendedMapViewProps> = ({
  routeStart: _routeStart,
  routeEnd: _routeEnd,
  style,
  children,
  ...mapProps
}) => (
  <View style={[styles.container, style]}>
    <RNMapView
      {...mapProps}
      provider={PROVIDER_DEFAULT}
      mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      style={StyleSheet.absoluteFill}
    >
      <UrlTile
        urlTemplate={OPEN_STREET_MAP_TILE_URL}
        maximumZ={19}
        flipY={false}
      />
      {children}
    </RNMapView>
    <View pointerEvents="none" style={styles.attribution}>
      <Text style={styles.attributionText}>{OPEN_STREET_MAP_ATTRIBUTION}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  attribution: {
    position: 'absolute',
    right: Spacing.xs,
    bottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.mapAttributionSurface,
  },
  attributionText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
  },
});

export default MapView;

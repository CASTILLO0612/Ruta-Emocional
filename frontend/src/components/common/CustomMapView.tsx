import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  MapView as GoogleMapView,
  type MapViewController,
} from '@googlemaps/react-native-navigation-sdk';

import { GOOGLE_DIRECTORY_MAP_PRESENTATION } from '../../config/googleMapPresentation';
import { getDirectoryMapConfig } from '../../config/runtimeConfig';
import { Colors } from '../../theme/colors';
import type { MapCoordinate, MapRegion } from '../../utils/openStreetMapEmbed';

interface MapViewProps {
  readonly children?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly initialRegion?: MapRegion;
  readonly showsUserLocation?: boolean;
  readonly scrollEnabled?: boolean;
  readonly zoomEnabled?: boolean;
  readonly rotateEnabled?: boolean;
  readonly tiltEnabled?: boolean;
  readonly routeStart?: MapCoordinate;
  readonly routeEnd?: MapCoordinate;
  readonly onMapReady?: () => void;
}

const resolveZoom = (region?: MapRegion) => {
  const delta = Math.max(
    region?.latitudeDelta ?? 0.04,
    region?.longitudeDelta ?? 0.04
  );
  return Math.max(3, Math.min(20, Math.log2(360 / delta)));
};

const CustomMapView = React.memo(({
  children,
  style,
  initialRegion,
  showsUserLocation = false,
  scrollEnabled = true,
  zoomEnabled = true,
  rotateEnabled = true,
  tiltEnabled = true,
  onMapReady,
}: MapViewProps) => {
  const controllerRef = React.useRef<MapViewController | null>(null);
  const mapReadyRef = React.useRef(false);
  const fallback = initialRegion ? null : getDirectoryMapConfig();
  const latitude = initialRegion?.latitude ?? fallback!.defaultLatitude;
  const longitude = initialRegion?.longitude ?? fallback!.defaultLongitude;
  const zoom = resolveZoom(initialRegion);
  const initialCameraPosition = React.useMemo(() => ({
    target: { lat: latitude, lng: longitude },
    zoom,
    bearing: 0,
    tilt: 0,
  }), [latitude, longitude, zoom]);

  const synchronizeCamera = React.useCallback(() => {
    if (!mapReadyRef.current || !controllerRef.current) return;
    controllerRef.current.moveCamera({
      target: { lat: latitude, lng: longitude },
      zoom,
      bearing: 0,
      tilt: 0,
    });
  }, [latitude, longitude, zoom]);

  React.useEffect(() => {
    synchronizeCamera();
  }, [synchronizeCamera]);

  return (
    <View testID="custom-map-view" style={[styles.container, style]}>
      <GoogleMapView
        {...GOOGLE_DIRECTORY_MAP_PRESENTATION}
        style={StyleSheet.absoluteFill}
        initialCameraPosition={initialCameraPosition}
        compassEnabled={false}
        myLocationEnabled={showsUserLocation}
        myLocationButtonEnabled={false}
        scrollGesturesEnabled={scrollEnabled}
        scrollGesturesDuringRotateOrZoomEnabled={scrollEnabled}
        rotateGesturesEnabled={rotateEnabled}
        tiltGesturesEnabled={tiltEnabled}
        zoomGesturesEnabled={zoomEnabled}
        zoomControlsEnabled={false}
        onMapViewControllerCreated={(controller) => {
          controllerRef.current = controller;
          synchronizeCamera();
        }}
        onMapReady={() => {
          mapReadyRef.current = true;
          synchronizeCamera();
          onMapReady?.();
        }}
      />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surfaceMuted,
  },
});

export default CustomMapView;

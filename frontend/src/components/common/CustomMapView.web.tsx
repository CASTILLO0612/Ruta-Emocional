import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Shadow } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { OPEN_STREET_MAP_ATTRIBUTION } from '../../config/mapProvider';

export const PROVIDER_DEFAULT = 'default';

interface MarkerProps {
  coordinate?: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  mapCenter?: { latitude: number; longitude: number };
  mapDelta?: { latitudeDelta: number; longitudeDelta: number };
}

interface MapCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

interface MapDelta {
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

interface MapAwareProps {
  readonly mapCenter?: MapCoordinate;
  readonly mapDelta?: MapDelta;
}

export const Marker: React.FC<MarkerProps> = ({
  coordinate,
  mapCenter,
  mapDelta,
  title,
  onPress,
  children,
}) => {
  let positionStyle = {};

  if (coordinate && mapCenter && mapDelta) {
    const latDiff = coordinate.latitude - mapCenter.latitude;
    const lngDiff = coordinate.longitude - mapCenter.longitude;

    const xPct = 50 + (lngDiff / mapDelta.longitudeDelta) * 100;
    const yPct = 50 - (latDiff / mapDelta.latitudeDelta) * 100;

    positionStyle = {
      left: `${xPct}%`,
      top: `${yPct}%`,
      transform: [{ translateX: -24 }, { translateY: -48 }],
    };
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[markerStyles.wrapper, positionStyle]}
      accessibilityLabel={`Map marker: ${title}`}
    >
      {children ? (
        children
      ) : (
        <View style={markerStyles.pin}>
          <View style={markerStyles.pinHead} />
          <View style={markerStyles.pinTip} />
        </View>
      )}
      {title ? (
        <View style={markerStyles.labelContainer}>
          <Text style={markerStyles.label} numberOfLines={1}>
            {title.split(' ')[0]}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const markerStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  pin: {
    alignItems: 'center',
  },
  pinHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  pinTip: {
    width: 4,
    height: 8,
    backgroundColor: Colors.accent,
  },
  labelContainer: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    marginTop: 2,
    maxWidth: 90,
    ...Shadow.sm,
  },
  label: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.textInverse,
    textAlign: 'center',
  },
});

interface PolylineProps {
  coordinates?: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  mapCenter?: { latitude: number; longitude: number };
  mapDelta?: { latitudeDelta: number; longitudeDelta: number };
}

export const Polyline: React.FC<PolylineProps> = () => {
  return null;
};

interface MapViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  initialRegion?: MapCoordinate & MapDelta;
  provider?: string;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  mapType?: string;
  routeStart?: { latitude: number; longitude: number };
  routeEnd?: { latitude: number; longitude: number };
}

const CustomMapView: React.FC<MapViewProps> = (props) => {
  const lat = props.initialRegion?.latitude ?? 12.1328;
  const lng = props.initialRegion?.longitude ?? -86.2904;
  const latitudeDelta = props.initialRegion?.latitudeDelta ?? 0.04;
  const longitudeDelta = props.initialRegion?.longitudeDelta ?? 0.04;
  const routeCoordinates = props.routeStart && props.routeEnd
    ? [props.routeStart, props.routeEnd]
    : null;
  const minimumLatitude = routeCoordinates
    ? Math.min(...routeCoordinates.map(({ latitude }) => latitude))
    : lat - latitudeDelta / 2;
  const maximumLatitude = routeCoordinates
    ? Math.max(...routeCoordinates.map(({ latitude }) => latitude))
    : lat + latitudeDelta / 2;
  const minimumLongitude = routeCoordinates
    ? Math.min(...routeCoordinates.map(({ longitude }) => longitude))
    : lng - longitudeDelta / 2;
  const maximumLongitude = routeCoordinates
    ? Math.max(...routeCoordinates.map(({ longitude }) => longitude))
    : lng + longitudeDelta / 2;
  const padding = routeCoordinates ? 0.01 : 0;
  const boundingBox = [
    minimumLongitude - padding,
    minimumLatitude - padding,
    maximumLongitude + padding,
    maximumLatitude + padding,
  ].join(',');
  const marker = encodeURIComponent(`${lat},${lng}`);
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(boundingBox)}&layer=mapnik&marker=${marker}`;

  const childrenWithCoords = React.Children.map(props.children, (child) => {
    if (React.isValidElement<MapAwareProps>(child)) {
      return React.cloneElement(child, {
        mapCenter: { latitude: lat, longitude: lng },
        mapDelta: {
          latitudeDelta: props.initialRegion?.latitudeDelta ?? 0.04,
          longitudeDelta: props.initialRegion?.longitudeDelta ?? 0.04,
        },
      });
    }
    return child;
  });

  return (
    <View style={[styles.container, props.style]}>
      <View style={StyleSheet.absoluteFill}>
        {React.createElement('iframe', {
          src: mapUrl,
          style: {
            width: '100%',
            height: '100%',
            border: 'none',
            opacity: 1,
          },
          title: 'Mapa de OpenStreetMap'
        })}
      </View>

      <View style={styles.overlay} />

      {childrenWithCoords}

      <View pointerEvents="none" style={styles.attribution}>
        <Text style={styles.attributionText}>{OPEN_STREET_MAP_ATTRIBUTION}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.primarySubtle,
    pointerEvents: 'none',
  },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 5,
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

export default CustomMapView;

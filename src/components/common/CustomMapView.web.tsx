import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';
import { Shadow } from '../../theme/spacing';

export const PROVIDER_GOOGLE = 'google';
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
    backgroundColor: 'rgba(10,36,99,0.92)',
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
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textInverse,
    textAlign: 'center',
  },
});

interface MapViewProps {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: any;
  provider?: any;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  mapType?: string;
}

const CustomMapView: React.FC<MapViewProps> = (props) => {
  const lat = props.initialRegion?.latitude ?? 12.1328;
  const lng = props.initialRegion?.longitude ?? -86.2904;
  const latDelta = props.initialRegion?.latitudeDelta ?? 0.04;
  const lngDelta = props.initialRegion?.longitudeDelta ?? 0.04;

  const mapUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=14&t=m&output=embed`;

  const childrenWithCoords = React.Children.map(props.children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        mapCenter: { latitude: lat, longitude: lng },
        mapDelta: { latitudeDelta: latDelta, longitudeDelta: lngDelta },
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
          title: 'Google Map Real'
        })}
      </View>

      <View style={styles.overlay} />

      {childrenWithCoords}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E9F0',
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,36,99,0.06)',
    pointerEvents: 'none',
  },
});

export default CustomMapView;

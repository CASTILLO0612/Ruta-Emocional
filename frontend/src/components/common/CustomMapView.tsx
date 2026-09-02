import React from 'react';
import RNMapView, { PROVIDER_GOOGLE, PROVIDER_DEFAULT, Marker, Polyline, MapViewProps as RNMapViewProps } from 'react-native-maps';
export { PROVIDER_GOOGLE, PROVIDER_DEFAULT, Marker, Polyline };

// Extend native MapView props with optional web-only route props (ignored on native)
interface ExtendedMapViewProps extends RNMapViewProps {
  routeStart?: { latitude: number; longitude: number };
  routeEnd?: { latitude: number; longitude: number };
}

const MapView: React.FC<ExtendedMapViewProps> = ({ routeStart: _rs, routeEnd: _re, ...rest }) => {
  return <RNMapView {...rest} />;
};

export default MapView;

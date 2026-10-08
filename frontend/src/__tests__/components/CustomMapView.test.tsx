import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import CustomMapView from '../../components/common/CustomMapView';

describe('CustomMapView', () => {
  it('mantiene habilitados todos los gestos del mapa por defecto', async () => {
    const onMapReady = jest.fn();
    const view = await render(
      <CustomMapView
        initialRegion={{
          latitude: 11.93,
          longitude: -85.96,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onMapReady={onMapReady}
      />
    );
    const children = view.getByTestId('custom-map-view').children as Array<
      string | { readonly props: Record<string, unknown> }
    >;
    const map = children.find(
      (node) => typeof node !== 'string' && node.props.scrollGesturesEnabled !== undefined
    );

    expect(typeof map !== 'string' && map?.props.scrollGesturesEnabled).toBe(true);
    expect(
      typeof map !== 'string' && map?.props.scrollGesturesDuringRotateOrZoomEnabled
    ).toBe(true);
    expect(typeof map !== 'string' && map?.props.rotateGesturesEnabled).toBe(true);
    expect(typeof map !== 'string' && map?.props.tiltGesturesEnabled).toBe(true);
    expect(typeof map !== 'string' && map?.props.zoomGesturesEnabled).toBe(true);
    expect(typeof map !== 'string' && typeof map?.props.onMapReady).toBe('function');
    if (typeof map !== 'string' && typeof map?.props.onMapReady === 'function') {
      map.props.onMapReady();
    }
    expect(onMapReady).toHaveBeenCalledTimes(1);
  });

  it('mueve la cámara sin reconstruir el mapa cuando llega una ubicación más precisa', async () => {
    const controller = { moveCamera: jest.fn() };
    const view = await render(
      <CustomMapView
        initialRegion={{
          latitude: 12.1328,
          longitude: -86.2904,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      />
    );
    const mapNode = () => {
      const children = view.getByTestId('custom-map-view').children as Array<
        string | { readonly props: Record<string, unknown> }
      >;
      return children.find(
        (node) => typeof node !== 'string' && node.props.onMapViewControllerCreated !== undefined
      );
    };
    const initialMap = mapNode();
    if (typeof initialMap !== 'string') {
      (initialMap?.props.onMapViewControllerCreated as (value: unknown) => void)(controller);
      (initialMap?.props.onMapReady as () => void)();
    }
    controller.moveCamera.mockClear();

    await act(async () => {
      view.rerender(
        <CustomMapView
          initialRegion={{
            latitude: 11.93,
            longitude: -85.96,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
        />
      );
    });

    await waitFor(() => {
      expect(controller.moveCamera).toHaveBeenCalledWith(expect.objectContaining({
        target: { lat: 11.93, lng: -85.96 },
      }));
    });
  });
});

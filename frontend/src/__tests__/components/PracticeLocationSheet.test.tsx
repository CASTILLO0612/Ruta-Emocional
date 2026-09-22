import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PracticeLocationSheet } from '../../components/profile/PracticeLocationSheet';

async function renderSheet(overrides: Partial<React.ComponentProps<typeof PracticeLocationSheet>> = {}) {
  const props: React.ComponentProps<typeof PracticeLocationSheet> = {
    visible: true,
    name: '',
    address: '',
    directions: '',
    coordinates: null,
    isLocating: false,
    isSaving: false,
    onNameChange: jest.fn(),
    onAddressChange: jest.fn(),
    onDirectionsChange: jest.fn(),
    onLocate: jest.fn(),
    onSave: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  return { result: await render(<PracticeLocationSheet {...props} />), props };
}

test('practice location requires descriptive fields and coordinates before saving', async () => {
  const { result, props } = await renderSheet();

  fireEvent.press(result.getByLabelText('Usar mi ubicación actual como ubicación del consultorio'));
  expect(props.onLocate).toHaveBeenCalledTimes(1);
  expect(result.getByRole('button', { name: 'Guardar ubicación' }).props.accessibilityState)
    .toEqual(expect.objectContaining({ disabled: true }));
});

test('practice location keeps coordinates private in the visual confirmation', async () => {
  const { result, props } = await renderSheet({
    name: 'Consultorio Central',
    address: 'Dirección de prueba',
    coordinates: { latitude: 12.136389, longitude: -86.251389 },
  });

  expect(result.getByText('Punto guardado con precisión.')).toBeTruthy();
  expect(result.queryByText('12.13639, -86.25139')).toBeNull();
  fireEvent.press(result.getByRole('button', { name: 'Guardar ubicación' }));
  expect(props.onSave).toHaveBeenCalledTimes(1);
});

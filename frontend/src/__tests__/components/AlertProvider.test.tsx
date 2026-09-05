import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AlertProvider } from '../../components/common/AlertProvider';
import { showAlert } from '../../utils/alert';

describe('AlertProvider', () => {
  it('presenta y resuelve avisos de marca sin usar diálogos del navegador', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <AlertProvider>
        <Text>Contenido de la aplicación</Text>
      </AlertProvider>
    );

    await act(async () => {
      showAlert(
        'No pudimos confirmar la propuesta',
        'Tu solicitud sigue disponible para intentarlo nuevamente.',
        [{ text: 'Reintentar', onPress: onConfirm }],
        'error'
      );
    });

    expect(view.getByText('No pudimos confirmar la propuesta')).toBeTruthy();
    expect(view.getByText('Tu solicitud sigue disponible para intentarlo nuevamente.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(view.queryByText('No pudimos confirmar la propuesta')).toBeNull();
  });
});

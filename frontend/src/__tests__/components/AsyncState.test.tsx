import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AsyncState } from '../../components/shared/AsyncState';

describe('AsyncState', () => {
  it('prioriza carga sobre error, vacío y contenido', async () => {
    const view = await render(
      <AsyncState isLoading error="Error" isEmpty loadingMessage="Cargando citas">
        <Text>Contenido</Text>
      </AsyncState>
    );
    expect(view.getByRole('progressbar', { name: 'Cargando citas' })).toBeTruthy();
    expect(view.queryByText('Error')).toBeNull();
    expect(view.queryByText('Contenido')).toBeNull();
  });

  it('ofrece reintento explícito en un error bloqueante', async () => {
    const onRetry = jest.fn();
    const view = await render(<AsyncState error="No hay conexión" onRetry={onRetry} />);
    expect(view.getByRole('alert')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('describe el estado vacío sin depender del icono', async () => {
    const view = await render(
      <AsyncState isEmpty emptyTitle="Sin mensajes" emptyMessage="Aparecerán después de aceptar una oferta." />
    );
    expect(view.getByLabelText('Sin mensajes. Aparecerán después de aceptar una oferta.')).toBeTruthy();
  });
});

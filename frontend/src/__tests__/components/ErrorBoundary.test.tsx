import React from 'react';
import { render } from '@testing-library/react-native';

import { ErrorBoundary } from '../../components/common/ErrorBoundary';

function BrokenScreen(): React.ReactNode {
  throw new Error('Request failed at http://localhost:5000 with ERR_CONNECTION_REFUSED');
}

describe('ErrorBoundary', () => {
  it('presenta una recuperación clara sin exponer detalles técnicos', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const view = await render(
        <ErrorBoundary>
          <BrokenScreen />
        </ErrorBoundary>
      );

      expect(view.getByText('Algo salió mal')).toBeTruthy();
      expect(view.getByText('No pudimos mostrar esta pantalla. Inténtalo nuevamente.')).toBeTruthy();
      expect(view.getByText('Reintentar')).toBeTruthy();
      expect(view.queryByText(/localhost|ERR_CONNECTION_REFUSED/)).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';

import { AppButton } from '../../components/common/AppButton';

describe('AppButton', () => {
  it('comunica la operación durante la carga y bloquea el doble envío', async () => {
    const view = await render(
      <AppButton
        label="Iniciar sesión"
        loadingLabel="Iniciando sesión"
        onPress={jest.fn()}
        isLoading
      />
    );

    expect(view.getByText('Iniciando sesión')).toBeTruthy();
    expect(view.getByRole('button').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });
});

import React, { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { CustomAlert } from './CustomAlert';
import {
  AppAlertButton,
  AppAlertRequest,
  registerAlertPresenter,
} from '../../utils/alert';

function sameAlert(left: AppAlertRequest, right: AppAlertRequest): boolean {
  return left.title === right.title && left.message === right.message;
}

export const AlertProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [requests, setRequests] = useState<readonly AppAlertRequest[]>([]);

  useEffect(() => registerAlertPresenter((request) => {
    setRequests((current) => (
      current.some((candidate) => sameAlert(candidate, request))
        ? current
        : [...current, request]
    ));
  }), []);

  const active = requests[0];
  const buttons = active?.buttons ?? [];
  const cancelButton = useMemo(
    () => buttons.find(({ style }) => style === 'cancel'),
    [buttons]
  );
  const confirmButton = useMemo(
    () => [...buttons].reverse().find(({ style }) => style !== 'cancel'),
    [buttons]
  );

  const resolve = useCallback((button?: AppAlertButton) => {
    setRequests((current) => current.slice(1));
    button?.onPress?.();
  }, []);

  return (
    <>
      {children}
      <CustomAlert
        visible={Boolean(active)}
        title={active?.title ?? ''}
        message={active?.message ?? ''}
        tone={active?.tone ?? 'info'}
        confirmText={confirmButton?.text ?? 'Entendido'}
        cancelText={cancelButton?.text ?? 'Cancelar'}
        confirmDestructive={confirmButton?.style === 'destructive'}
        onConfirm={() => resolve(confirmButton)}
        onCancel={cancelButton ? () => resolve(cancelButton) : undefined}
        showCancel={Boolean(cancelButton)}
      />
    </>
  );
};

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AppAlertButton {
  readonly text?: string;
  readonly style?: AppAlertButtonStyle;
  readonly onPress?: () => void;
}

export type AppAlertTone = 'info' | 'success' | 'warning' | 'error';

export interface AppAlertRequest {
  readonly id: number;
  readonly title: string;
  readonly message: string;
  readonly buttons: readonly AppAlertButton[];
  readonly tone: AppAlertTone;
}

type AlertPresenter = (request: AppAlertRequest) => void;

let presenter: AlertPresenter | null = null;
let pendingRequests: AppAlertRequest[] = [];
let nextRequestId = 1;

function inferTone(title: string): AppAlertTone {
  const normalized = title.trim().toLocaleLowerCase('es');
  if (/aprob|guardad|enviad|actualizad|completad|confirmad/.test(normalized)) return 'success';
  if (/no pudimos|error|fall|no permitido|no disponible/.test(normalized)) return 'error';
  if (/requerid|demasiado|atención|advertencia|firmar|cancelar/.test(normalized)) return 'warning';
  return 'info';
}

export function showAlert(
  title: string,
  message: string,
  buttons: readonly AppAlertButton[] = [],
  tone: AppAlertTone = inferTone(title)
): void {
  const request: AppAlertRequest = {
    id: nextRequestId,
    title,
    message,
    buttons,
    tone,
  };
  nextRequestId += 1;

  if (presenter) {
    presenter(request);
    return;
  }
  pendingRequests.push(request);
}

export function registerAlertPresenter(nextPresenter: AlertPresenter): () => void {
  presenter = nextPresenter;
  const waiting = pendingRequests;
  pendingRequests = [];
  waiting.forEach(nextPresenter);

  return () => {
    if (presenter === nextPresenter) presenter = null;
  };
}

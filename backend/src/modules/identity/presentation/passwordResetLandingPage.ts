import { Router } from 'express';

const PASSWORD_RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function renderLayout(content: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Restablecer contraseña · Ruta Emocional</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f7f8fc; color: #17213a; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(100%, 440px); }
    .brand { margin: 0 0 40px; color: #29428c; font-size: 18px; font-weight: 800; letter-spacing: .08em; text-align: center; }
    h1 { margin: 0 0 12px; font-size: clamp(28px, 7vw, 36px); line-height: 1.12; letter-spacing: -.03em; }
    p { margin: 0; color: #526078; font-size: 17px; line-height: 1.6; }
    .action { display: block; margin-top: 28px; border-radius: 14px; padding: 16px 20px; background: #29428c; color: #fff; font-size: 17px; font-weight: 700; text-align: center; text-decoration: none; }
    .hint { margin-top: 18px; font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <main>
    <p class="brand">RUTA EMOCIONAL</p>
    ${content}
  </main>
</body>
</html>`;
}

export function renderPasswordResetLandingPage(token: unknown): {
  readonly status: 200 | 400;
  readonly html: string;
} {
  if (typeof token !== 'string' || !PASSWORD_RESET_TOKEN_PATTERN.test(token)) {
    return {
      status: 400,
      html: renderLayout(
        '<h1>Enlace no válido</h1>'
        + '<p>Solicita un correo nuevo desde “Olvidé mi contraseña” en Ruta Emocional.</p>'
      ),
    };
  }

  const appUrl = `rutaemocional://restablecer-contrasena?token=${encodeURIComponent(token)}`;
  return {
    status: 200,
    html: renderLayout(
      '<h1>Crea una nueva contraseña</h1>'
      + '<p>Continúa de forma segura en la aplicación Ruta Emocional.</p>'
      + `<a class="action" href="${appUrl}">Abrir Ruta Emocional</a>`
      + '<p class="hint">Este enlace es personal, de un solo uso y vence pronto.</p>'
    ),
  };
}

export function createPasswordResetLandingRouter(): Router {
  const router = Router();
  router.get('/restablecer-contrasena', (request, response) => {
    const page = renderPasswordResetLandingPage(request.query.token);
    response
      .status(page.status)
      .type('html')
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
      .send(page.html);
  });
  return router;
}

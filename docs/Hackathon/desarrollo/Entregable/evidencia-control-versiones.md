# Evidencia de control de versiones

## 1. Repositorio y estrategia

- Repositorio remoto: `https://github.com/CASTILLO0612/Ruta-Emocional.git`.
- Rama de integración PostgreSQL: `postgresql-migration`.
- Estrategia usada: commits pequeños por capacidad, con prefijos convencionales `feat`, `fix`, `test`, `docs` y `chore`.
- No se almacenan archivos `.env`, secretos, compilados, datos privados ni evidencias profesionales.

## 2. Historial legible

El historial actual permite seguir la evolución sin depender de un único commit masivo:

| Commit | Mensaje | Resultado principal |
|---|---|---|
| `047ef39` | `feat(backend): establish PostgreSQL identity foundation` | identidad y persistencia PostgreSQL |
| `8947a29` | `test(auth): cover session lifecycle against PostgreSQL` | ciclo de sesión probado |
| `7b75cc2` | `chore(frontend): upgrade to Expo SDK 57` | actualización controlada del cliente |
| `d194816` | `feat(frontend): connect identity flow to PostgreSQL API` | acceso/registro conectados |
| `9210924` | `feat(directory): complete professional verification phase` | directorio y verificación |
| `6401bb5` | `feat(requests): complete PostgreSQL request and offer flow` | solicitudes y ofertas |
| `30d5c1e` | `feat(messaging): complete secure realtime flow` | mensajería persistida y outbox |
| `5e101d1` | `fix(onboarding): unblock psychologist profile setup` | corrección del flujo inicial |
| `686a858` | `feat(verification): add controlled local approval flow` | aprobación local auditable |
| `19b65c5` | `feat(appointments): implement secure agenda flow` | agenda transaccional |
| `96182e1` | `feat(clinical): implement secure clinical records` | historia clínica versionada |
| `14da572` | `feat: consolidate PostgreSQL core before phase 8` | relaciones conceptuales y lógicas consolidadas |
| `64dfac3` | `feat: implement secure deterministic triage` | orientación MENTA determinista y privada |
| `900db82` | `feat: add contextual MENTA agent` | agente contextual con herramientas autorizadas |
| `2a20233` | `feat(frontend): consolidate visual identity and motion` | identidad visual y movimiento centralizados |
| `2ee9a12` | `feat: consolidate visual experience and request workflows` | flujos visuales y de solicitudes refinados |
| `203c262` | `test: align MENTA fallback expectation` | expectativa de contingencia alineada |

## 3. Operaciones mínimas reproducibles

```bash
# Obtener cambios remotos sin crear un merge accidental
git pull --ff-only origin postgresql-migration

# Revisar y confirmar una unidad coherente
git status --short
git diff --check
git add <archivos-del-cambio>
git commit -m "docs(hackathon): complete amateur development deliverables"

# Publicar la rama rastreada
git push origin postgresql-migration
```

`git pull --ff-only` evita un commit de mezcla inesperado. `git diff --check` detecta errores de espacios antes de confirmar. El `push` normal conserva el historial; no se requiere ni se recomienda `--force` para esta entrega.

## 4. Evidencia que puede capturarse para la presentación

```bash
git remote -v
git branch --show-current
git log --oneline --decorate -12
git status --short --branch
```

La captura final debe mostrar la rama sincronizada con `origin/postgresql-migration` y el commit documental de esta entrega. Al inicio de la consolidación, `HEAD` y `origin/postgresql-migration` coincidían en `203c262`; los cambios del paquete deben confirmarse y publicarse juntos al cerrar la entrega. No muestre contenido de `.env`, tokens ni direcciones privadas en la evidencia.

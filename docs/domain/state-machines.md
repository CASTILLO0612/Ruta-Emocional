# Máquinas de estado

Las transiciones se ejecutan mediante casos de uso del backend. Ningún endpoint genérico puede aceptar un estado arbitrario. Cada comando valida estado actual, actor, propiedad, invariantes y versión concurrente.

## 1. Cuenta

```text
ACTIVE ───────► SUSPENDED ───────► ACTIVE
  │                 │
  └──────────────► DISABLED ◄─────┘
```

| De | A | Actor | Condiciones |
|---|---|---|---|
| `ACTIVE` | `SUSPENDED` | Administrador o control automatizado | Motivo, duración o criterio documentado |
| `SUSPENDED` | `ACTIVE` | Administrador | Revisión concluida |
| `ACTIVE` | `DISABLED` | Usuario o administrador | Política de cierre y retención aplicada |
| `SUSPENDED` | `DISABLED` | Administrador | Motivo y auditoría |

`DISABLED` es terminal para autenticación. Una reactivación futura requeriría un caso de uso y política explícitos; no se habilita por actualización directa.

## 2. Verificación profesional

```text
PENDING ─────► VERIFIED
   │              │
   └────► REJECTED│
             │    │
             └────┴────► PENDING  (nueva evidencia/revisión)
```

| De | A | Actor | Condiciones |
|---|---|---|---|
| `PENDING` | `VERIFIED` | Administrador autorizado | Identidad, licencia y evidencia verificadas |
| `PENDING` | `REJECTED` | Administrador autorizado | Motivo comunicable y motivo interno |
| `REJECTED` | `PENDING` | Psicólogo/administrador | Se presenta nueva evidencia |
| `VERIFIED` | `PENDING` | Administrador o proceso de vigencia | Revalidación, vencimiento o alerta |
| `VERIFIED` | `REJECTED` | Administrador | Revocación confirmada; revisión de citas activas |

Solo `VERIFIED` habilita marketplace, ofertas, agenda y actividad clínica.

## 3. Solicitud de atención

```text
PENDING ──► BIDDING ──► ACCEPTED ──► IN_SESSION ──► COMPLETED
   │           │            │             │
   ├───────────┴──────────────────────────────► CANCELLED
   └───────────┬──────────────────────────────► EXPIRED
               └────► PENDING  (sin ofertas pendientes)
```

`EXPIRED` existe como estado terminal propio; nunca se simula mediante
`CANCELLED`.

| De | A | Comando | Actor/causa |
|---|---|---|---|
| — | `PENDING` | `CreateServiceRequest` | Paciente autenticado |
| `PENDING` | `BIDDING` | `SubmitOffer` | Primera oferta elegible |
| `BIDDING` | `ACCEPTED` | `AcceptOffer` | Paciente propietario y oferta pendiente |
| `BIDDING` | `PENDING` | `WithdrawOffer` | Se retiró la última oferta pendiente |
| `ACCEPTED` | `IN_SESSION` | `StartSession` | Participante autorizado, dentro de ventana |
| `IN_SESSION` | `COMPLETED` | `CompleteSession` | Psicólogo; confirmación operativa |
| `PENDING`, `BIDDING` | `CANCELLED` | `CancelServiceRequest` | Paciente propietario |
| `PENDING`, `BIDDING` | `EXPIRED` | `ExpireServiceRequest` | Job idempotente al vencer TTL |

Transiciones prohibidas destacadas:

- `COMPLETED` o `CANCELLED` a cualquier estado operativo;
- `ACCEPTED` a `BIDDING`;
- cambio de paciente, modalidad o presupuesto después de la primera oferta;
- cambio de oferta aceptada.

## 4. Oferta

```text
PENDING ──► ACCEPTED
   │
   ├──────► REJECTED
   └──────► WITHDRAWN
```

Al expirar o cancelarse la solicitud, sus ofertas pendientes pasan a
`REJECTED`; no existe un estado de oferta ambiguo o simulado.

| De | A | Comando | Actor/causa |
|---|---|---|---|
| — | `PENDING` | `SubmitOffer` | Psicólogo verificado y elegible |
| `PENDING` | `ACCEPTED` | `AcceptOffer` | Paciente propietario de la solicitud |
| `PENDING` | `REJECTED` | `AcceptOffer` | Efecto para ofertas competidoras |
| `PENDING` | `WITHDRAWN` | `WithdrawOffer` | Psicólogo propietario |
Estados terminales: `ACCEPTED`, `REJECTED`, `WITHDRAWN`.

## 5. Relación de atención

```text
ACTIVE ◄────────► PAUSED
  │                 │
  └────────┬────────┘
           ▼
          ENDED
```

| De | A | Actor | Efecto |
|---|---|---|---|
| — | `ACTIVE` | Sistema | Se crea al aceptar exactamente una oferta |
| `ACTIVE` | `PAUSED` | Paciente, psicólogo o administrador | Bloquea nuevas actividades según motivo |
| `PAUSED` | `ACTIVE` | Actor autorizado | Restablece acceso operativo |
| `ACTIVE`, `PAUSED` | `ENDED` | Paciente, psicólogo o administrador | Cierra nuevas actividades, conserva historial |

`ENDED` es terminal. Una nueva atención crea otra relación para conservar periodos y fuentes.
El MVP no permite alta directa; una futura incorporación administrativa deberá
modelar su propia fuente antes de habilitarse.

## 6. Cita

```text
SCHEDULED ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
    │             │              │
    ├─────────────┴──────────────┴──────► CANCELLED
    └─────────────┬─────────────────────► NO_SHOW
                  └────► SCHEDULED (reprogramación auditada)
```

| De | A | Comando | Condiciones |
|---|---|---|---|
| — | `SCHEDULED` | `ScheduleAppointment` | Espacio válido y no solapado |
| `SCHEDULED` | `CONFIRMED` | `ConfirmAppointment` | Participante o regla de auto-confirmación |
| `CONFIRMED` | `IN_PROGRESS` | `StartAppointment` | Ventana temporal y actor autorizado |
| `IN_PROGRESS` | `COMPLETED` | `CompleteAppointment` | Sesión finalizada |
| `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS` | `CANCELLED` | `CancelAppointment` | Motivo y política aplicable |
| `SCHEDULED`, `CONFIRMED` | `NO_SHOW` | `MarkNoShow` | Fin de ventana y actor autorizado |
| `SCHEDULED`, `CONFIRMED` | `SCHEDULED` | `RescheduleAppointment` | Nueva disponibilidad y traza de horario/estado anterior |

Una corrección administrativa de un estado terminal requiere comando separado, permiso elevado y auditoría; nunca un `PATCH status` genérico.

## 7. Nota clínica

```text
DRAFT ──► SIGNED ──► AMENDED
  ▲                     │
  └──── nueva versión ──┘
```

| De | A | Comando | Condiciones |
|---|---|---|---|
| — | `DRAFT` | `CreateClinicalNote` | Encuentro y autor válidos |
| `DRAFT` | `DRAFT` | `UpdateClinicalDraft` | Autor, control optimista de versión |
| `DRAFT` | `SIGNED` | `SignClinicalNote` | Contenido válido, hash/version y fecha de firma |
| `SIGNED` | `AMENDED` | `AmendClinicalNote` | Motivo; conserva versión firmada y crea una nueva |
| `AMENDED` | `AMENDED` | `AmendClinicalNote` | Nueva versión encadenada y motivo |

Una versión firmada no puede actualizarse ni eliminarse. El estado `AMENDED` describe que existe una versión posterior; no invalida la trazabilidad anterior.

## 8. Diagnóstico

```text
PROVISIONAL ──► CONFIRMED ──► RESOLVED
      │              │
      └──────────────┴──────► RULED_OUT
```

Solo un profesional autorizado realiza transiciones. Cada cambio registra evidencia clínica, fecha y autor. MENTA no participa como actor.

## 9. Plan de tratamiento

```text
DRAFT ──► ACTIVE ──► COMPLETED
  │          │
  └──────────┴─────► CANCELLED
```

Los objetivos siguen:

```text
PENDING ──► IN_PROGRESS ──► ACHIEVED
   │              │
   └──────────────┴───────► CANCELLED
```

Completar o cancelar un plan no elimina objetivos, diagnósticos ni encuentros.

## 10. Consentimiento

```text
REJECTED     GRANTED ──► WITHDRAWN
    │            ▲            │
    └────────────┴────────────┘  (nueva decisión, nunca sobrescritura)
```

Rechazar, otorgar o retirar crea un registro nuevo vinculado a la versión exacta
y al contexto aplicable. Retirar exige una concesión vigente. Una nueva
concesión después de rechazar o retirar no revierte registros anteriores.

## 11. Pago

```text
PENDING ──► HELD ──► COMPLETED ──► REFUNDED
   │          │             │
   └──────────┴─────────────┴────► FAILED
              └─────────────────► REFUNDED
```

| De | A | Evidencia |
|---|---|---|
| — | `PENDING` | Intento local idempotente |
| `PENDING` | `HELD` | Confirmación firmada del proveedor |
| `HELD` | `COMPLETED` | Captura confirmada |
| `HELD`, `COMPLETED` | `REFUNDED` | Reembolso confirmado, total o parcial según futuro modelo |
| estado no terminal | `FAILED` | Error definitivo confirmado |

Las transiciones no se aceptan directamente desde la aplicación móvil.

## 12. Evaluación de triaje

Una evaluación es inmutable y no cambia de nivel. Una nueva valoración crea otro registro. Si un profesional la revisa, se añaden revisor y fecha; no se sustituye la salida original.

```text
LOW | MODERATE | HIGH | CRITICAL
              │
              └── revisión profesional (metadatos, no cambio destructivo)
```

`HIGH` y `CRITICAL` producen cero modalidades comerciales. Cuando la evaluación
vigente vinculada a una solicitud es `CRITICAL`, la transición de aceptación de
oferta se rechaza; no se crea relación, conversación ni aceptación parcial.

## 13. Concurrencia e idempotencia

- Los comandos mutables aceptan `Idempotency-Key` cuando una repetición pueda duplicar efectos.
- Las transiciones críticas bloquean la fila de agregado o usan control optimista.
- Las restricciones de PostgreSQL son la última línea de defensa.
- Una respuesta `409 Conflict` indica que el estado cambió o la transición ya no es válida.
- Un evento WebSocket nunca constituye la confirmación primaria; el cliente reconcilia contra la API.

# API · Entrega 2

Base local: `http://localhost:5080/api`. El frontend utiliza el proxy `http://localhost:5180/api`. Todas las rutas requieren la cookie `nexo_session`; las escrituras exigen `Origin: http://localhost:5180` en local. En producción se usa el origen exacto de `FRONTEND_URL`.

| Método | Endpoint | Permiso | Resultado |
| --- | --- | --- | --- |
| GET | `/configuracion` | Cualquier usuario autenticado | `{ eventos }`; Admin ve todos, personal solo activos |
| GET | `/configuracion/:id` | Cualquier usuario autenticado | `{ evento }`; personal solo eventos activos |
| POST | `/configuracion` | Admin | Crea evento y devuelve `201 { evento }` |
| PUT | `/configuracion/:id` | Admin | Actualiza todos los campos editables con control de versión |
| GET | `/tarifas?evento=:id` | Admin, Taquilla | `{ tarifas }`; solo activas del evento |
| GET | `/dashboard/stats?evento=:id` | Admin, Taquilla | Evento, resumen, aforo, liquidación, tarifas, últimas ventas y fecha de consulta |

No existen POST/PUT/PATCH/DELETE para tarifas. No existen endpoints de cuenta bancaria, rentas o costos del recinto. Las rutas de ventas ya están implementadas y se documentan en [Entrega 3](api-entrega-3.md). El control de puerta sigue pendiente.

## Crear o modificar un evento

POST acepta este formato (los textos son ejemplos de documentación, no datos de producción):

```json
{
  "nombre": "Nombre del evento",
  "fecha": "2026-12-20",
  "horario": "18:30",
  "zonaHoraria": "America/El_Salvador",
  "venue": "Nombre del recinto",
  "direccion": "Dirección del evento",
  "aforoMaximo": 500,
  "activo": false,
  "marca": { "nombre": "Nombre de organización", "logoUrl": "" }
}
```

PUT usa los mismos campos más `"version": <valor actual de evento.__v>`. Los campos no reconocidos, incluyendo `cuentaBancaria`, se rechazan. La fecha se trata como día de calendario y se almacena a medianoche UTC; `horario` y `zonaHoraria` son los datos locales independientes del evento. La interfaz no convierte el día a la zona del navegador. Se valida una zona horaria IANA real y un horario de 24 horas.

El servidor genera el slug. El logo debe ser una URL HTTPS o una cadena vacía. El aforo admite enteros entre 1 y 1.000.000. Al actualizar, el servidor compara el aforo con la suma de `cantidad` y el número de ingresos de ventas no anuladas. Las versiones evitan que dos administradores sobrescriban sus cambios; un conflicto exige volver a leer el evento. No se puede cambiar el `_id` ni insertar campos arbitrarios.

Se permiten varios eventos activos: el selector elige cuál consultar. Desactivar un evento lo oculta al personal, sin borrar sus ventas. No se ofrecen borrados de eventos en esta entrega.

## Tarifas externas

La colección `tarifas` se mantiene para consultar precios de entrada. Su contrato existente es `evento` (ObjectId), `nombre`, `categoria` (`Promo`/`General`), `etapa` (`Preventa`/`Puerta`), `precioCentavos` (entero no negativo), `moneda` (`USD`) y `activa` (booleano). La combinación evento/nombre/etapa es única.

La administración externa debe respetar esos tipos y el vínculo ObjectId. Las rentas y otros costos ajenos al precio de entrada no forman parte de esa colección ni de esta aplicación. El seed solo inicializa la colección e índices y conserva los registros existentes.

## Contrato de estadísticas

`GET /dashboard/stats?evento=:id` devuelve:

- `evento`: configuración actual sin datos bancarios.
- `resumen.ventas`: documentos de venta vigentes; `ventasPagadas`: documentos con estado `CANCELADO` o `PAGADO`.
- `resumen.entradasReservadas`: suma de cantidades de todas las ventas no anuladas, incluidas las pendientes.
- `resumen.entradasPagadas`: suma de cantidades pagadas.
- `resumen.recaudadoCentavos`, `efectivoCentavos`, `transferenciaCentavos`: sumas de importes pagados; no incluyen pendientes ni anuladas.
- `resumen.pendienteCentavos`: suma de importes pendientes.
- `resumen.ingresados`: total de elementos en `ingresos` de ventas vigentes.
- `resumen.pendientesIngreso`: entradas pagadas menos ingresos de ventas pagadas, con mínimo cero.
- `aforo.capacidad`, `disponibles`, `porcentajeReservado`, `porcentajeIngresado`.
- `liquidacion`: métodos de cobro con importe y porcentaje; no divide entre cero.
- `tarifas`: tarifas activas de ese evento.
- `recientes`: hasta seis ventas no anuladas, ordenadas por fecha de registro descendente. Solo se exponen campos necesarios para el resumen, sin teléfonos ni comprobantes.
- `actualizadoEn`: fecha/hora UTC de respuesta.

Los importes y cantidades se calculan en MongoDB. Los precios actuales de tarifas no recalculan ventas históricas: se usan los importes registrados en cada venta. Los porcentajes se redondean a dos decimales. El panel de efectivo refleja cobros registrados; todavía no es un arqueo físico con saldo inicial, retiros o diferencias de caja.

## Probar desde PowerShell

```powershell
$apiBase = 'http://localhost:5080/api'
$apiHeaders = @{ Origin = 'http://localhost:5180' }
$loginBody = @{ correo = '<tu-correo>'; password = '<tu-contraseña>'; recordar = $false } | ConvertTo-Json
Invoke-RestMethod "$apiBase/auth/login" -Method Post -Headers $apiHeaders -ContentType 'application/json' -Body $loginBody -SessionVariable nexoSession
$eventList = Invoke-RestMethod "$apiBase/configuracion" -WebSession $nexoSession
$eventId = $eventList.eventos[0]._id
Invoke-RestMethod "$apiBase/configuracion/$eventId" -WebSession $nexoSession
Invoke-RestMethod "$apiBase/tarifas?evento=$eventId" -WebSession $nexoSession
Invoke-RestMethod "$apiBase/dashboard/stats?evento=$eventId" -WebSession $nexoSession
```

Selecciona un evento real de la lista antes de escribir. Usa el JSON de creación y la versión actual para probar POST/PUT mediante `-Headers $apiHeaders -WebSession $nexoSession -ContentType 'application/json'`.

## Errores esperados y límites actuales

- `400`: ID, tipos o campos inválidos; fecha imposible; campos bancarios no admitidos.
- `401`: sesión ausente, vencida o revocada.
- `403`: rol u origen no autorizado.
- `404`: evento inexistente o inactivo para el personal; ruta de escritura de tarifas inexistente.
- `409`: conflicto de versión o aforo inferior al ya reservado/ingresado.
- `429`: límite de solicitudes.

El despliegue actual representa una sola organización; no añade aislamiento multiempresa. La API de lectura de estadísticas no usa transacciones entre colecciones, por lo que una edición externa simultánea de evento/tarifas puede reflejarse en consultas consecutivas. Los importes, cantidades y ventas recientes sí se obtienen mediante una misma agregación con `$facet` sobre las ventas.

La interfaz consulta estadísticas cada 15 segundos y vuelve a consultar al recuperar visibilidad. La edición guarda directamente en MongoDB y actualiza el selector; al volver al dashboard se realiza una consulta nueva. Si se necesita actualización instantánea entre equipos, se podrá añadir SSE/WebSockets en una siguiente entrega.

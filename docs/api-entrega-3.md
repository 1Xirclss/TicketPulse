# API · Entrega 3 — Ventas y asistentes

Base local: http://localhost:5080/api. Interfaz: http://localhost:5180/ventas. Usa la cookie de sesión y `Origin: http://localhost:5180` para escrituras. No se añaden cuentas bancarias ni edición de tarifas.

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| POST | /ventas | Admin, Taquilla | Reserva aforo, consulta precio y emite boleto |
| GET | /ventas?evento=:id | Admin, Taquilla | Ventas filtradas y paginadas |
| GET | /ventas/:id | Admin, Taquilla | Detalle, evento y contenido del QR |
| PUT | /ventas/:id | Admin, Taquilla | Datos del asistente, referencia y confirmación de pago |
| PATCH | /ventas/:id/anular | Admin | Anulación persistente y liberación de reserva |
| GET | /ventas/exportar?evento=:id | Admin, Taquilla | CSV con todos los resultados filtrados |
| GET | /ventas/exportar.pdf?evento=:id | Admin, Taquilla | PDF paginado con los resultados filtrados |
| GET | /ventas/opciones | Admin, Taquilla | Métodos, categorías, estados y límite de cantidad |

## Registrar una venta

Ejemplo de formato; los IDs deben obtenerse de la API, no de este ejemplo:

```json
{
  "eventoId": "<ObjectId del evento>",
  "tarifaId": "<ObjectId de la tarifa externa activa>",
  "nombreAsistente": "Nombre completo",
  "telefono": "7777-1234",
  "colegio": "Colegio / Senior",
  "cantidad": 2,
  "metodoPago": "Efectivo",
  "estadoPago": "CANCELADO",
  "comprobanteRef": ""
}
```

No se acepta precio, importe ni categoría desde el cliente. El servidor consulta la tarifa activa del evento, obtiene su categoría y precio, y calcula `montoCentavos` con enteros. Cantidad: entero entre 1 y 1000. Teléfono, colegio y referencia pueden estar vacíos. Una transferencia pagada exige referencia. Un evento inactivo no admite ventas nuevas.

Incluye `Idempotency-Key: <UUID>` y conserva la misma clave y el mismo cuerpo para reintentar una solicitud cuya respuesta no recibiste. La primera emisión devuelve 201; un reintento idéntico devuelve 200 y el mismo boleto. La misma clave con otros datos devuelve 409. Sin cabecera, el servidor genera una clave nueva y no puede deduplicar reintentos independientes. La interfaz conserva su clave durante el intento abierto.

La respuesta es `{ venta }`. Incluye `id`, `ticketCode`, `numero`, `eventoId`, `tarifaId`, `nombreAsistente`, `telefono`, `colegio`, `categoria`, `tarifaNombre`, `cantidad`, `precioCentavos`, `montoCentavos`, `metodoPago`, `estadoPago`, `comprobanteRef`, `anulada`, `ingresados`, `puerta`, `version` y fechas.

`ticketCode` es un código alfanumérico NX + 24 caracteres hexadecimales. `numero` es correlativo por evento, no se reutiliza al anular. Para mantener compatibilidad con el dashboard anterior, las nuevas ventas almacenan tanto `montoCentavos` como `totalCentavos`, con el mismo valor. Los registros anteriores conservan su ticket e importes; no se reescriben sus precios históricos.

## Consulta y filtros

`GET /ventas?evento=:id&q=texto&estado=CANCELADO&metodo=Efectivo&categoria=General&puerta=Pendiente&page=1&limit=20`

- `q`: búsqueda literal, sin interpretar expresiones regulares, por nombre, teléfono, colegio o código.
- `estado`: CANCELADO (incluye PAGADO histórico), PENDIENTE o anulada. Sin estado se muestran todas las ventas vigentes; las anuladas se consultan explícitamente.
- `metodo`: Efectivo o Transferencia.
- `categoria`: Promo o General.
- `puerta`: Ingresado o Pendiente. Una compra grupal cuenta como Ingresado solo cuando todos sus accesos están registrados; los grupos parciales siguen pendientes y muestran X/Y.
- `page`: entero positivo; `limit`: 1–100, por defecto 20.

Devuelve `{ ventas, page, limit, total, pages }`. Las exportaciones aplican exactamente los mismos filtros y omiten la paginación. El CSV incluye BOM UTF-8, escapa comillas y neutraliza fórmulas de hoja de cálculo. El PDF incluye encabezados repetidos, número de página, filtros y suma de cobros de la selección; las anuladas y pendientes no incrementan esa suma.

## Editar y anular

PUT acepta `version` obligatorio (valor de `venta.version`) y los campos opcionales `nombreAsistente`, `telefono`, `colegio`, `comprobanteRef`, `estadoPago`. No permite cambiar cantidad, tarifa, método ni importe. Solo admite mantener el estado o pasar de PENDIENTE a CANCELADO; un pago confirmado no se degrada a pendiente. Una versión desactualizada responde 409.

PATCH de anulación requiere:

```json
{ "version": 0, "motivo": "Motivo de anulación" }
```

Anular libera el aforo una sola vez incluso ante solicitudes simultáneas. Las repeticiones de una anulación ya aplicada devuelven la venta anulada sin descontar otra vez. No se permite anular una venta con accesos registrados. Se conserva el motivo, la fecha y el administrador responsable.

## Reserva atómica y recuperación

MongoDB local continúa en modo standalone. Para reservar, NexoAdmin usa un compare-and-swap sobre el documento del evento: comprueba `entradasReservadas + cantidad <= aforoMaximo`, incrementa reserva y contador, y guarda un comando de venta pendiente en una misma operación atómica. Si no cabe, devuelve `409 Aforo agotado`.

El comando pendiente contiene el documento validado o el cambio por aplicar. Se materializa de forma idempotente en `asistentes_ventas` y solo después se libera el turno del evento. La anulación usa el mismo mecanismo con un incremento negativo. La edición de capacidad participa en el mismo control de revisión; no compite con las ventas mediante un recuento inseguro.

No es una transacción multidocumento: durante una interrupción, la reserva puede existir antes de que aparezca el documento de venta. El aforo permanece reservado para impedir una sobreventa. La recuperación se ejecuta al iniciar el backend, cada 10 segundos, antes de nuevas operaciones y al leer ventas, exportaciones o estadísticas. Los reintentos deben conservar Idempotency-Key. Un error HTTP no debe interpretarse como prueba de que no hubo reserva.

Los contadores se inicializan una sola vez a partir de las ventas históricas al realizar la primera operación del evento. A partir de entonces, todas las modificaciones de ventas y aforo deben pasar por la API. Las tarifas siguen siendo externas; insertar o alterar ventas/contadores manualmente en Compass después de inicializarlos rompe esa garantía y no está soportado. Un comando inválido introducido externamente requiere revisión y bloquea nuevas escrituras del evento, sin liberar reservas a ciegas.

Las operaciones pendientes se ocultan en las respuestas públicas del evento. La implementación no usa candados en memoria ni caducidades que permitan a dos procesos reservar simultáneamente el mismo espacio.

## Boleto y puerta

El detalle devuelve `qrPayload: NEXO:<ticketCode>`. La UI genera el QR localmente y ofrece un boleto 3D de React Three Fiber, con respaldo legible si no hay WebGL o se prefiere movimiento reducido. Un QR identifica un boleto, no autoriza por sí solo el ingreso. Los boletos pendientes/anulados se indican claramente. El endpoint para marcar ingresos y validar en puerta se implementará en la siguiente entrega.

## Comandos de prueba

Desde la carpeta del proyecto:

```powershell
npm test
npm run build
npx playwright test
# Solo pruebas nuevas:
node --test Backend/test/ventas.test.js
npx playwright test tests/sales.spec.js
```

Las pruebas crean bases temporales y no insertan ventas en la base real. Se verifican concurrencia, recuperación de interrupciones, precios de servidor, anulación repetida, permisos, filtros, exportaciones, persistencia de pagos y decodificación del QR.

## Ejemplo PowerShell con sesión

```powershell
$apiBase = 'http://localhost:5080/api'
$headers = @{ Origin = 'http://localhost:5180' }
$login = @{ correo = '<tu correo>'; password = '<tu contraseña>'; recordar = $false } | ConvertTo-Json
Invoke-RestMethod "$apiBase/auth/login" -Method Post -Headers $headers -ContentType 'application/json' -Body $login -SessionVariable nexoSession
$events = Invoke-RestMethod "$apiBase/configuracion" -WebSession $nexoSession
$eventId = ($events.eventos | Where-Object activo | Select-Object -First 1)._id
$prices = Invoke-RestMethod "$apiBase/tarifas?evento=$eventId" -WebSession $nexoSession
$tarifaId = $prices.tarifas[0]._id
$headers['Idempotency-Key'] = [guid]::NewGuid().ToString()
$body = @{ eventoId=$eventId; tarifaId=$tarifaId; nombreAsistente='Asistente de prueba'; telefono=''; colegio=''; cantidad=1; metodoPago='Efectivo'; estadoPago='PENDIENTE'; comprobanteRef='' } | ConvertTo-Json
# Esta llamada crea una venta real en la base seleccionada.
$sale = Invoke-RestMethod "$apiBase/ventas" -Method Post -Headers $headers -WebSession $nexoSession -ContentType 'application/json' -Body $body
Invoke-RestMethod "$apiBase/ventas?evento=$eventId" -WebSession $nexoSession
$edit = @{ version=$sale.venta.version; estadoPago='CANCELADO' } | ConvertTo-Json
Invoke-RestMethod "$apiBase/ventas/$($sale.venta.id)" -Method Put -Headers $headers -WebSession $nexoSession -ContentType 'application/json' -Body $edit
Invoke-WebRequest "$apiBase/ventas/exportar?evento=$eventId" -WebSession $nexoSession -OutFile ventas.csv
Invoke-WebRequest "$apiBase/ventas/exportar.pdf?evento=$eventId" -WebSession $nexoSession -OutFile ventas.pdf
```

Antes de probar POST, selecciona un evento activo y una tarifa real. Las pruebas automatizadas anteriores son la opción para validar sin modificar la operación real.

Referencia de la estrategia: [atomicidad de documentos MongoDB](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

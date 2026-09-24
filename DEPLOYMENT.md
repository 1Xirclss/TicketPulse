# TicketPulse · Guía de Despliegue en Producción (Render + Vercel)

Esta guía documenta el proceso paso a paso para desplegar **TicketPulse** (Frontend en **Vercel** y Backend en **Render**) con base de datos MongoDB Atlas y servicio de correo en producción.

---

## 1. Cuentas Oficiales Preconfiguradas

El sistema cuenta con cuentas para cada rol del equipo:

| Rol | Correo Electrónico | Contraseña Inicial | Espacio Asignado |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@nexoadmin.com` | `AdminOficial2026!*` | Dashboard, Métricas, Tarifas, Evento, Ventas, Puerta |
| **Portero** | `puerta@nexoadmin.com` | `PuertaControl2026!*` | Control en Puerta, Escáner, Aforo en tiempo real |
| **Taquilla** | `ventas@nexoadmin.com` | `VentasTaquilla2026!*` | Ventas, Registro de Asistentes, Boletos QR, Cobros |

> **Nota de Seguridad**: Tras desplegar, puedes cambiar las contraseñas en cualquier momento desde el módulo de recuperación o tu gestor de base de datos.
> Además, cualquier usuario nuevo puede registrarse desde `/registro` mediante el flujo de código de verificación de 6 dígitos enviado a su correo.

---

## 2. Despliegue del Backend en Render

El backend es una API REST construida en Node.js (Express) con MongoDB.

### Opción A: Usando el archivo `render.yaml` (Automático)
1. Conecta tu repositorio de GitHub `https://github.com/1Xirclss/TicketPulse.git` en [Render Dashboard](https://dashboard.render.com).
2. Render detectará automáticamente el archivo `render.yaml` incluido en la raíz.
3. Rellena las variables de entorno en el panel de Render.

### Opción B: Creación Manual de Web Service
1. En Render, haz clic en **New +** > **Web Service**.
2. Selecciona tu repositorio `TicketPulse`.
3. Configura los parámetros:
   - **Name**: `ticketpulse-backend` (o el nombre que elijas)
   - **Region**: La más cercana a tu audiencia (ej. `Oregon (US West)` o `Ohio (US East)`)
   - **Root Directory**: `Backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

### Variables de Entorno en Render (Backend)

Configura las siguientes variables en **Environment**:

| Variable | Descripción / Ejemplo |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render asigna el puerto automáticamente) |
| `MONGODB_URI` | `mongodb+srv://<usuario>:<password>@cluster.mongodb.net/ticketpulse?retryWrites=true&w=majority` |
| `FRONTEND_URL` | URL de tu frontend en Vercel (ej. `https://ticketpulse.vercel.app`) |
| `JWT_SECRET` | Cadena aleatoria segura de al menos 48 caracteres |
| `ADMIN_ORGANIZATION_KEY` | Clave secreta para autorizar registros con rol Admin |
| `STAFF_ORGANIZATION_KEY` | Clave secreta para autorizar registros con rol Taquilla / Portero |
| `SMTP_HOST` | Host SMTP para envío de correos (ej. `smtp.gmail.com` o `smtp.resend.com`) |
| `SMTP_PORT` | `587` (TLS) o `465` (SSL) |
| `SMTP_USER` | Tu usuario o correo SMTP |
| `SMTP_PASS` | Contraseña de aplicación SMTP (en Gmail: "Contraseña de aplicaciones") |
| `SMTP_FROM` | Remitente visible (ej. `TicketPulse <no-reply@tudominio.com>` o tu Gmail) |

### Inicialización de Datos en Render
Para cargar las cuentas oficiales y el evento inicial en tu base de datos de producción:
En Render, accede a la pestaña **Shell** de tu servicio y ejecuta:
```bash
node seed.js
```

---

## 3. Despliegue del Frontend en Vercel

1. Ingresa a [Vercel](https://vercel.com) y selecciona **Add New...** > **Project**.
2. Importa el repositorio `TicketPulse`.
3. En la configuración del proyecto:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Haz clic en *Edit* y selecciona `FrontEnd-NexoAdmin`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. En **Environment Variables**, añade:
   - `VITE_API_BASE_URL`: La URL pública de tu API de Render (ej. `https://ticketpulse-backend.onrender.com/api`)
5. Haz clic en **Deploy**.

> El archivo `FrontEnd-NexoAdmin/vercel.json` incluido en el proyecto ya contiene las reglas de redirección SPA (`rewrites`) para que React Router maneje las rutas correctamente.

---

## 4. Configuración de Correo en Producción (SMTP)

En Render, cuando configures las variables `SMTP_HOST` y `SMTP_FROM`, el sistema enviará correos reales de activación:
- **Código de Verificación OTP de 6 dígitos**: Se genera dinámicamente con tiempo de caducidad de 15 minutos.
- **Recuperación de Contraseña**: Permite a los operadores restablecer su acceso con seguridad.

### Ejemplo con Gmail:
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `587`
- `SMTP_USER`: `tucorreo@gmail.com`
- `SMTP_PASS`: *(Contraseña de aplicación de 16 letras generada en Google Account > Seguridad > Contraseñas de aplicaciones)*
- `SMTP_FROM`: `TicketPulse <tucorreo@gmail.com>`

---

## 5. Verificación de Funcionamiento

Una vez desplegados ambos servicios:
1. Abre la URL de Vercel.
2. Inicia sesión con cualquiera de las cuentas oficiales:
   - `admin@nexoadmin.com` para gestión administrativa y configuración de tarifas.
   - `puerta@nexoadmin.com` para acceso instantáneo a puerta.
   - `ventas@nexoadmin.com` para emisión de boletos y caja.
3. Prueba registrar un nuevo usuario en `/registro`:
   - El sistema enviará el código de 6 dígitos a su correo electrónico.
   - Al introducir el código, la cuenta quedará verificada y activa en tiempo real.

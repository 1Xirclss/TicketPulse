# TicketPulse · Event Operating System

TicketPulse es una plataforma integral de gestión de eventos, venta de entradas, control de accesos e inteligencia operativa en tiempo real, conectada directamente a MongoDB.

---

## 🌟 Características Principales

- **Gestión Integral de Eventos**: Configuración en tiempo real de detalles del evento, aforo máximo, fechas, horarios y branding.
- **Tarifas y Categorías Dinámicas**: Administración completa de tarifas de entrada (General, VIP, Preventa, etc.) y categorías personalizadas directamente desde la interfaz web.
- **Autenticación y Roles Especializados**:
  - **Admin**: Control total del evento, tarifas, métricas financieras y aforo global.
  - **Portero**: Interfaz táctil y de alta velocidad para escaneo de boletos, registro manual, entrega de pulseras y aforómetro en tiempo real.
  - **Taquilla**: Registro de asistentes, cálculo de importes, emisión de boletos con código QR y visualización 3D, cobros en efectivo/transferencia y exportación en CSV/PDF.
- **Verificación de Cuentas por Correo (OTP)**: Sistema de registro seguro con código de verificación de 6 dígitos enviado por correo (Nodemailer / SMTP en producción).
- **Control de Aforo Atómico**: Prevención de sobreventa y detección instantánea de boletos duplicados en puerta mediante escrituras atómicas en MongoDB.
- **Zero Hardcoded Data**: Todo el estado (usuarios, eventos, tarifas, transacciones y accesos) se lee y persiste en MongoDB en tiempo real.

---

## 🚀 Inicio Rápido (Local)

### Requisitos Previos
- Node.js 22+ (o 24+)
- MongoDB en ejecución localmente (`mongodb://localhost:27017`)

### Pasos de Instalación

```powershell
# 1. Instalar dependencias
npm install
npm run install:all

# 2. Configurar variables de entorno y bases de datos iniciales
node scripts/setup-local.mjs

# 3. Crear las cuentas oficiales y evento inicial
npm run seed

# 4. Iniciar servidores de desarrollo
npm run dev
```

La aplicación web estará disponible en `http://localhost:5180` y el backend en `http://localhost:5080/api`.

---

## 👥 Cuentas de Acceso Iniciales

Al ejecutar `npm run seed`, se crean las cuentas para cada rol:

| Rol | Correo | Contraseña | Espacio Principal |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@nexoadmin.com` | `AdminOficial2026!*` | Dashboard general y Configuración |
| **Portero** | `puerta@nexoadmin.com` | `PuertaControl2026!*` | `/puerta` (Control de Ingreso) |
| **Taquilla** | `ventas@nexoadmin.com` | `VentasTaquilla2026!*` | `/ventas` (Caja y Asistentes) |

*También puedes registrar una cuenta nueva en `/registro`, seleccionar tu rol e ingresar la clave de organización de tu equipo.*

---

## 🛠️ Arquitectura y Tecnologías

- **Backend**:
  - Node.js & Express (ES Modules)
  - Mongoose & MongoDB (Transacciones atómicas, agregaciones y validación estricta de esquemas)
  - Zod (Validación de entradas en tiempo de compilación y ejecución)
  - Nodemailer (Despacho de correos de verificación y recuperación)
  - Bcrypt & JWT (Autenticación con cookies HttpOnly seguras y rotación de versiones de sesión)
- **Frontend**:
  - React 19 + Vite
  - React Router 7
  - Vanilla CSS modular con paleta estética de alto contraste (Acero, Azul Profundo, Carbón y Acentos)
  - Three.js / React Three Fiber (Visualización interactiva 3D de boletos)
  - Lucide React (Iconografía técnica y accesible)

---

## 🌐 Despliegue en Producción (Render + Vercel)

El proyecto está preparado para su despliegue en la nube:
- **Backend (API)**: Listo para desplegar en **Render** mediante el archivo `render.yaml` incluido en la raíz.
- **Frontend (Web)**: Listo para desplegar en **Vercel** con reglas de redirección SPA en `FrontEnd-NexoAdmin/vercel.json`.

Para instrucciones detalladas de configuración de variables de entorno y SMTP de producción, consulta [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con suites de prueba automatizadas completas:

```powershell
# Pruebas unitarias y de integración del Backend (35 tests)
npm test

# Compilación de producción del Frontend
npm run build

# Pruebas End-to-End de navegador con Playwright (12 tests)
npx playwright test
```

---

## 📄 Licencia

TicketPulse - Sistema Privado de Operación de Eventos.

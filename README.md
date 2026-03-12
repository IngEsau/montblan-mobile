# Montblan Mobile

Aplicación móvil oficial del flujo de pedidos Montblan, integrada al backend Yii2 por API REST.

## 1) Alcance funcional

- Login con token Bearer.
- Catálogo de clientes y productos con búsqueda.
- Flujo completo de pedidos por etapa:
  - `CAPTURA` (Ventas)
  - `ALMACEN` validación
  - `CTAS X COBRAR`
  - `ALMACEN` ruta/entrega
  - `TERMINADO`
- Operaciones de CXC en móvil:
  - registro y eliminación de pagos
  - registro de documento global del pedido (factura o recibo simple)
- Vista de pedidos terminados para almacén y administrador.

## 2) Stack técnico

- Expo 55
- React Native 0.83
- React 19
- TypeScript
- React Navigation (Stack + Tabs)

## 3) Requisitos

- Node.js 20+
- npm 10+
- Backend API de Montblan disponible y accesible por red

## 4) Configuración rápida

En `/home/esau/Desktop/montblan/montblan-mobile`:

```bash
cp .env.example .env
npm install
```

Variable obligatoria:

```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api/v1
```

Reglas:
- usar URL sin slash final
- Android Emulator: `http://10.0.2.2:8080/api/v1`
- dispositivo físico: usar IP LAN del host (ej. `http://192.168.x.x:8080/api/v1`)

## 5) Ejecución

```bash
npm run web
```

Opcional:

```bash
npm run android
npm run ios
```

Para validación de tipos:

```bash
npx tsc --noEmit
```

## 6) Backend local (desarrollo)

En `/home/esau/Desktop/montblan/dev.montblan`:

```bash
php -S 127.0.0.1:8080 -t web
```

Documentación OpenAPI del backend:
- `http://127.0.0.1:8080/api/docs`

## 7) Endpoints que consume la app

Autenticación:
- `POST /auth/login`
- `GET /auth/me`

Catálogos:
- `GET /clientes`
- `GET /productos`
- `GET /direcciones/codigo-postal/{cp}`

Pedidos:
- `GET /pedidos`
- `GET /pedidos/{id}`
- `POST /pedidos`
- `PATCH /pedidos/{id}`
- `POST /pedidos/{id}/transition`
- `PATCH /pedidos/{id}/almacen`
- `GET /pedidos/{id}/pagos`
- `POST /pedidos/{id}/pagos`
- `DELETE /pedidos/{id}/pagos/{pagoId}`
- `PATCH /pedidos/{id}/ctas-cobrar`
- `POST /pedidos/{id}/documento`

Todos los endpoints son relativos a `EXPO_PUBLIC_API_BASE_URL`.

## 8) Roles y permisos

La app habilita módulos según `user.permissions` devuelto por `/auth/me`:

- `can_sales`: captura/edición de pedidos en fase ventas
- `can_warehouse`: validación almacén y captura de ruta/entrega
- `can_cxc`: operación de cuentas por cobrar

Si el backend no envía `permissions`, se aplica fallback por nombre de rol (`rol`) para mantener compatibilidad.

## 9) Estructura del proyecto

```text
src/
  core/                # bootstrap de app
  navigation/          # stack, tabs y rutas
  modules/
    auth/              # login y sesión
    catalog/           # clientes y productos
    orders/            # flujo operativo de pedidos
  shared/
    api/               # cliente HTTP
    config/            # env y configuración
    storage/           # token/sesión
    theme/             # paleta y tipografías
    utils/             # formatters/helpers
```

## 10) Criterios operativos clave

- En captura de ventas solo se registran campos permitidos para esa fase.
- `No pedido`, `Fecha/Hora`, vendedor y estatus son controlados por sistema.
- El tipo de comprobante es global por pedido.
- Ruta y fecha de entrega se capturan únicamente en `ALMACEN` final.
- CXC no captura ruta ni fecha de entrega.

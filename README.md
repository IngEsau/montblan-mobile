# Montblan Mobile MVP (Expo + React Native + TypeScript)

App móvil MVP para **Ventas** y **Almacén**, conectada al backend Yii2 existente.

## Arquitectura breve

- `Expo + React Native + TypeScript`.
- Autenticación por token Bearer (`/api/v1/auth/login`, `/api/v1/auth/me`).
- Estructura modular:
  - `src/modules/auth`: sesión/login.
  - `src/modules/orders`: listado, detalle, alta ventas, captura almacén.
  - `src/modules/catalog`: clientes/productos.
  - `src/shared`: cliente HTTP, storage token, tema, utilidades.
  - `src/navigation`: stack + tabs (`Ventas`, `Almacén`).

## Flujos MVP implementados

1. Login.
2. Listado básico de pedidos (ventas y almacén).
3. Detalle básico de pedido.
4. Alta/captura de pedido desde ventas.
5. Captura de almacén:
   - surtido por línea
   - rollos por línea
   - faltante calculado
   - validación de disponibilidad (inventario de referencia)
   - standby cuando queda incompleto
6. Transiciones básicas:
   - Ventas: enviar a almacén
   - Almacén: enviar a CTAS X COBRAR (cuando está completo)

## Endpoints reutilizados

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/clientes`
- `GET /api/v1/productos`
- `GET /api/v1/pedidos`
- `GET /api/v1/pedidos/{id}`
- `POST /api/v1/pedidos`
- `POST /api/v1/pedidos/{id}/transition`
- `GET /api/v1/pedidos/flow-map`
- `GET|POST /api/v1/pedidos/{id}/pagos` (queda listo para expansión cobranza)

## Endpoint faltante detectado y agregado (mínimo)

Para cubrir almacén móvil faltaba actualizar surtido/rollos por línea sin depender de vistas web + CSRF.

Se agregó:
- `PATCH /api/v1/pedidos/{id}/almacen`

Qué hace:
- valida fase `ALMACEN` y rol `almacenAccess`.
- recibe líneas (`id` o `codigo`) con `surtido` y `rollo`.
- valida: no negativos, no surtir más que solicitado, y no exceder inventario disponible de referencia.
- calcula `faltante` y estado de almacén automáticamente.
- devuelve `standby=true` si queda parcial.

También se extendió el detalle de pedido (`GET /pedidos/{id}`) con:
- `detalle[].faltante`
- `detalle[].inventario_sa`
- `detalle[].inventario_cmb`
- `detalle[].inventario_disponible`
- `detalle[].disponibilidad_ok`
- `is_standby` en listado.

## Ajustes backend Yii2 aplicados

En `/home/esau/Desktop/montblan/dev.montblan`:

- `config/web.php`
  - reglas REST nuevas:
    - `PUT /api/v1/pedidos/{id}/almacen`
    - `PATCH /api/v1/pedidos/{id}/almacen`
- `modules/api/modules/v1/controllers/PedidosController.php`
  - `actionAlmacen()`
  - serialización extendida de detalle/listado
- `docs/openapi/api-v1.yaml`
  - contrato del endpoint nuevo y nuevos campos de detalle

## Cómo correr en Ubuntu

### 1) Backend Yii2

Desde `/home/esau/Desktop/montblan/dev.montblan`:

```bash
php -S 127.0.0.1:8080 -t web
```

API docs:
- `http://127.0.0.1:8080/api/docs`

### 2) App móvil

Desde `/home/esau/Desktop/montblan/montblan-mobile`:

```bash
cp .env.example .env
npm install
npm run web
```

La app web abre en `http://localhost:8082`.

Notas de red:
- Android Emulator: usar `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080/api/v1`
- Dispositivo físico: usar la IP LAN de tu Ubuntu.

## Estructura principal

```text
src/
  core/AppRoot.tsx
  navigation/
  modules/
    auth/
    catalog/
    orders/
  shared/
```

## Pendientes (fuera de MVP actual)

- Catálogos con paginación/búsqueda incremental en modales.
- Offline/cola de sincronización.
- Gestión completa de cobranza en móvil.
- Tests E2E y endurecimiento de permisos por pantalla/rol.

# Montblan Mobile

Aplicación móvil oficial para la operación del flujo de pedidos Montblan, integrada al backend Yii2 mediante API REST.

## Overview

La app está diseñada para acompañar la operación diaria de ventas, almacén y CXC desde un flujo móvil consistente con el backend y las reglas actuales del negocio.

Flujo vigente:
- `CAPTURA`
- `AUTORIZACION`
- `ALMACEN`
- `FACTURACION`
- `TERMINADO`

Capacidades principales:
- autenticación con token Bearer
- consulta de clientes y productos
- captura y edición de pedidos en ventas
- autorización CXC con asignación de `No. pedido`
- captura de surtido y rollos en almacén
- operación de documento final en facturación
- cancelación documental con trazabilidad y reversa de inventario
- soporte para pedidos postfechados

## Stack

- Expo 55
- React Native 0.83
- React 19
- TypeScript
- React Navigation
- AsyncStorage para sesión local

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- backend Montblan accesible por red
- credenciales de Expo/EAS si se generarán builds Android

## Configuración de entorno

La app toma la URL base del backend desde la variable:

```env
EXPO_PUBLIC_API_BASE_URL=
```

Buenas prácticas:
- no versionar archivos `.env` reales
- mantener solo `.env.example` como plantilla
- usar una URL sin slash final
- resolver la URL final por entorno fuera del repositorio

### Entorno local

1. Crea tu archivo `.env` a partir de `.env.example`.
2. Define `EXPO_PUBLIC_API_BASE_URL` con la URL del backend correspondiente al entorno donde vas a trabajar.
3. No subas archivos `.env` reales al repositorio.

## Desarrollo local

Instalación:

```bash
npm install
```

Scripts disponibles:

```bash
npm run start
npm run android
npm run ios
npm run web
```

Validación de tipos:

```bash
npx tsc --noEmit
```

## Build Android

La app incluye configuración para EAS Build.

Build interno en formato APK:

```bash
npx eas build -p android --profile preview
```

Build orientado a distribución:

```bash
npx eas build -p android --profile production
```

Identificador Android configurado:
- `com.lerco.montblan`

### Variables para build

Los builds no incluyen URLs hardcodeadas dentro del repositorio.

Antes de ejecutar un build, define `EXPO_PUBLIC_API_BASE_URL` en alguno de estos puntos:
- variables de entorno locales de la sesión
- configuración segura del proveedor de CI/CD
- variables de entorno administradas en Expo/EAS

Ejemplo local:

```bash
export EXPO_PUBLIC_API_BASE_URL=<backend-url-without-trailing-slash>
npx eas build -p android --profile preview
```

## Integración con backend

La app consume los endpoints principales de autenticación, catálogos y pedidos.

Operaciones relevantes:
- login y recuperación de perfil autenticado
- listado y detalle de pedidos
- creación y actualización de pedidos en captura
- transición entre fases del flujo
- operación de almacén
- operación CXC en autorización y facturación
- cancelación documental

## Reglas operativas relevantes

- ventas captura el pedido y puede editarlo mientras siga en `CAPTURA`
- `No. pedido` se asigna en `AUTORIZACION`
- `FACTURACION` opera con la variante facturada del pedido
- los pedidos postfechados se bloquean en almacén hasta 24 horas antes de `fecha_entrega`
- la afectación de inventario ocurre al pasar a `TERMINADO`
- la cancelación del documento final no reabre el flujo y revierte inventario
- la visibilidad de pedidos respeta el rol y, en ventas, el vendedor asignado

## Estructura del proyecto

```text
src/
  navigation/          # rutas y tabs principales
  modules/
    auth/              # login y contexto de sesión
    catalog/           # clientes y productos
    orders/            # flujo operativo de pedidos
  shared/
    api/               # cliente HTTP
    config/            # lectura de entorno
    storage/           # token y sesión local
    theme/             # paleta, tipografía y estilos base
```

## Convenciones de mantenimiento

- mantener el flujo móvil alineado con la API publicada
- evitar hardcodear credenciales o URLs reales dentro del repositorio
- documentar cualquier cambio de contrato en paralelo con el backend
- separar cambios de build, funcionalidad y UI en commits distintos cuando sea posible

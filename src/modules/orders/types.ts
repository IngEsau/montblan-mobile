import { PaginatedResponse } from '../catalog/types';

export type PedidoListItem = {
  id: number;
  no_pedido: string | null;
  no_cliente: string | null;
  cliente_razon_social: string | null;
  tipo_fac_rem: number;
  tipo_fac_rem_label: string | null;
  no_factura: string | null;
  status: number;
  status_label: string | null;
  is_standby?: boolean | null;
  ctas_cobrar_status_code?: number | null;
  ctas_cobrar_status: string | null;
  almacen_status: string | null;
  documento_cancelado?: boolean;
  postfechado?: boolean;
  venta_especial?: boolean;
  subtotal: number;
  iva: number;
  total: number;
  fecha: number;
  fecha_text: string | null;
};

export type PedidoDetalleLinea = {
  id: number;
  codigo: string | null;
  cantidad: number;
  surtido: number | null;
  faltante: number;
  rollo: number | null;
  descripcion: string | null;
  observaciones: string | null;
  precio: number;
  importe: number;
  tipo_comprobante: number;
  tipo_comprobante_label: string | null;
  inventario_sa: number | null;
  inventario_cmb: number | null;
  inventario_disponible: number | null;
  disponibilidad_ok: boolean | null;
  largo?: number | null;
};

export type PedidoDireccion = {
  id?: number;
  direccion: string | null;
  num_ext: string | null;
  num_int: string | null;
  referencia: string | null;
  codigo_postal: string | null;
  codigo_postal_id: number | null;
  estado_id: number | null;
  estado: string | null;
  municipio_id: number | null;
  municipio: string | null;
};

export type Pedido = PedidoListItem & {
  ruta: string | null;
  fecha_entrega: string | null;
  postfechado?: boolean;
  vendedor: string | null;
  cliente_telefono: string | null;
  cliente_correo: string | null;
  cliente_rfc: string | null;
  uso_cfdi: string | null;
  cliente_condiciones: string | null;
  observaciones: string | null;
  instrucciones_credito?: string | null;
  instrucciones_almacen?: string | null;
  surtido: number | null;
  rollo: number | null;
  total_pagado?: number;
  saldo?: number;
  pagos?: PedidoPagoItem[];
  historial_documentos?: PedidoHistorialDocumento[];
  documento_cancelado?: boolean;
  motivo_cancelacion_documento?: string | null;
  documento_cancelado_at?: number | null;
  documento_cancelado_by?: number | null;
  documento_cancelado_by_username?: string | null;
  direccion?: PedidoDireccion | null;
  detalle: PedidoDetalleLinea[];
};

export type PedidoListResponse = PaginatedResponse<PedidoListItem>;

export type PedidoDetailResponse = {
  ok: boolean;
  item: Pedido;
};

export type PedidoCreatePayload = {
  pedido: {
    no_cliente: string;
    cliente_razon_social: string;
    cliente_telefono?: string;
    cliente_correo?: string;
    cliente_rfc?: string;
    uso_cfdi?: string;
    cliente_condiciones?: string;
    tipo_fac_rem: number;
    venta_especial?: number;
    postfechado?: number;
    fecha_entrega?: string;
    observaciones?: string;
    instrucciones_credito?: string;
    instrucciones_almacen?: string;
    vendedor?: string;
  };
  direccion?: {
    direccion: string;
    num_ext?: string;
    num_int?: string;
    referencia?: string;
    codigo_postal?: string;
    estado_id?: number;
    municipio_id?: number;
    codigo_postal_id?: number;
  };
  detalle: Array<{
    codigo: string;
    cantidad: number;
    precio: number;
    descripcion?: string;
    observaciones?: string;
    importe?: number;
  }>;
};

export type PedidoCreateResponse = {
  ok: boolean;
  message: string;
  item: Pedido;
};

export type PedidoTransitionResponse = {
  ok: boolean;
  message: string;
  transition?: {
    from?: { code: number; label: string };
    to?: { code: number; label: string };
  };
  inventory_affected?: {
    productos_afectados: number;
    cantidad_total: number;
    lineas: Array<{
      codigo: string;
      cantidad_afectada: number;
      inventario_sa_anterior: number;
      inventario_sa_nuevo: number;
      inventario_cmb_anterior: number;
      inventario_cmb_nuevo: number;
      descuento_desde_sa: number;
      descuento_desde_cmb: number;
      lineas_pedido: number;
    }>;
  } | null;
  item: Pedido;
};

export type PedidoCancelarDocumentoPayload = {
  motivo_cancelacion_documento: string;
  confirmacion_documento: string;
};

export type PedidoCancelarDocumentoResponse = {
  ok: boolean;
  message: string;
  inventory_reverted?: {
    productos_afectados: number;
    cantidad_total: number;
    lineas: Array<{
      codigo: string;
      cantidad_revertida: number;
      inventario_sa_anterior: number;
      inventario_sa_nuevo: number;
      inventario_cmb_anterior: number;
      inventario_cmb_nuevo: number;
      reversion_hacia_sa: number;
      reversion_hacia_cmb: number;
      lineas_pedido: number;
    }>;
  } | null;
  item: Pedido;
};

export type PedidoPagoItem = {
  id: number;
  monto: number;
  fecha_pago: string;
  referencia: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: number | null;
};

export type PedidoPagosResponse = {
  ok: boolean;
  pedido_id: number;
  cobranza_status: string | null;
  totals: {
    total_pedido: number;
    total_pagado: number;
    saldo: number;
  };
  items: PedidoPagoItem[];
};

export type PedidoRegistrarPagoPayload = {
  monto: number;
  fecha_pago?: string;
  referencia?: string;
  notas?: string;
};

export type PedidoRegistrarPagoResponse = {
  ok: boolean;
  message: string;
  item: PedidoPagoItem;
  pedido_totals: {
    total_pedido: number;
    total_pagado: number;
    saldo: number;
    cobranza_status: string | null;
  };
};

export type PedidoDeletePagoResponse = {
  ok: boolean;
  message: string;
  pedido_totals: {
    total_pedido: number;
    total_pagado: number;
    saldo: number;
    cobranza_status: string | null;
  };
};

export type PedidoCxcUpdatePayload = {
  no_pedido?: string;
  no_factura?: string;
};

export type PedidoCxcUpdateResponse = {
  ok: boolean;
  message: string;
  item: Pedido;
};

export type PedidoHistorialDocumento = {
  id_pedido_historial: number;
  subtotal_pedido: number;
  surtido_pedido: number;
  rollos_surtido: number | null;
  fecha_surtido: string | null;
  numero_factura: string | null;
};

export type PedidoRegistrarDocumentoPayload = {
  id_pedido_historial: number;
  numero_factura?: string;
};

export type PedidoRegistrarDocumentoResponse = {
  ok: boolean;
  message: string;
  item: {
    id_pedido_historial: number;
    numero_factura: string;
  };
};

export type WarehouseLineUpdateInput = {
  id: number;
  surtido: number;
  rollo: number;
};

export type WarehouseUpdatePayload = {
  detalle: WarehouseLineUpdateInput[];
};

export type WarehouseUpdateResponse = {
  ok: boolean;
  message: string;
  standby: boolean;
  resumen_almacen: {
    almacen_status: string | null;
    total_surtido: number;
    total_rollo: number;
    total_faltante: number;
  };
  item: Pedido;
};

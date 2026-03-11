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
  ctas_cobrar_status: string | null;
  almacen_status: string | null;
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
  precio: number;
  importe: number;
  tipo_comprobante: number;
  tipo_comprobante_label: string | null;
  inventario_sa: number | null;
  inventario_cmb: number | null;
  inventario_disponible: number | null;
  disponibilidad_ok: boolean | null;
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
  vendedor: string | null;
  cliente_telefono: string | null;
  cliente_correo: string | null;
  cliente_rfc: string | null;
  uso_cfdi: string | null;
  cliente_condiciones: string | null;
  observaciones: string | null;
  surtido: number | null;
  rollo: number | null;
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
    no_pedido?: string;
    cliente_razon_social: string;
    cliente_telefono?: string;
    cliente_correo?: string;
    cliente_rfc?: string;
    uso_cfdi?: string;
    cliente_condiciones?: string;
    tipo_fac_rem: number;
    fecha_entrega: string;
    observaciones?: string;
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
  item: Pedido;
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

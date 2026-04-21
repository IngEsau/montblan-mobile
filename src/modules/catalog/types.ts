export type PaginatedResponse<T> = {
  meta: {
    page: number;
    per_page: number;
    total: number;
    page_count: number;
    sales_total?: number;
    capture_sales_total?: number;
    subtotal?: number;
    iva?: number;
    total_amount?: number;
    capture_subtotal?: number;
    capture_iva?: number;
    capture_total?: number;
  };
  items: T[];
};

export type Cliente = {
  id: number;
  clave: string;
  nombre: string;
  nombre_comercial: string | null;
  calle: string | null;
  telefono: string | null;
  saldo: number;
  asignado_a_id?: number | null;
  asignado_a_username?: string | null;
  asignado_a_nombre?: string | null;
};

export type Producto = {
  id: number;
  codigo: string;
  nombre: string | null;
  precio_venta: number;
  precio_venta_especial?: number | null;
  categoria?: string | null;
  largo?: number | null;
  inventario_sa: number | null;
  inventario_cmb: number | null;
  inventario_fisico?: number | null;
  cantidad_negativa_ml?: number | null;
  inventario_sae?: number | null;
  inventario_disponible?: number | null;
  minimo?: number | null;
  maximo?: number | null;
  updated_at?: number | null;
};

export type CodigoPostalEstado = {
  id: number;
  nombre: string;
};

export type CodigoPostalMunicipio = {
  id: number;
  estado_id: number;
  nombre: string;
};

export type CodigoPostalColonia = {
  id: number;
  codigo_postal: string;
  estado_id: number;
  estado: string;
  municipio_id: number;
  municipio: string;
  nombre: string;
};

export type CodigoPostalLookupResponse = {
  ok: boolean;
  codigo_postal: string;
  estados: CodigoPostalEstado[];
  municipios: CodigoPostalMunicipio[];
  colonias: CodigoPostalColonia[];
};

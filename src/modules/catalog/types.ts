export type PaginatedResponse<T> = {
  meta: {
    page: number;
    per_page: number;
    total: number;
    page_count: number;
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
  inventario_sa: number | null;
  inventario_cmb: number | null;
  inventario_disponible?: number | null;
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

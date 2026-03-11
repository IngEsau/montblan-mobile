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
  telefono: string | null;
  saldo: number;
};

export type Producto = {
  id: number;
  codigo: string;
  nombre: string | null;
  precio_venta: number;
  inventario_sa: number | null;
  inventario_cmb: number | null;
};

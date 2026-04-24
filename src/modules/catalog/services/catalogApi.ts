import { apiRequest } from '../../../shared/api/http';
import { Cliente, CodigoPostalLookupResponse, PaginatedResponse, Producto } from '../types';

const SERVICIO_ML_CLIENT_CODE = '9009';
const SERVICIO_ML_CLIENT_NAME = 'SERVICIO ML';

type BaseCatalogOptions = {
  page?: number;
  perPage?: number;
};

type ProductosOptions = BaseCatalogOptions & {
  includeOutOfLine?: boolean;
  onlyWithName?: boolean;
  onlyWithPrice?: boolean;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }

    query.set(key, String(value));
  });

  return query.toString();
}

function buildServicioMlCliente(): Cliente {
  return {
    id: -9009,
    clave: SERVICIO_ML_CLIENT_CODE,
    nombre: SERVICIO_ML_CLIENT_NAME,
    nombre_comercial: SERVICIO_ML_CLIENT_NAME,
    calle: null,
    telefono: null,
    saldo: 0,
    asignado_a_id: null,
    asignado_a_username: null,
    asignado_a_nombre: null,
  };
}

function matchesServicioMlSearch(search = '') {
  const normalized = search.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return SERVICIO_ML_CLIENT_CODE.includes(normalized)
    || SERVICIO_ML_CLIENT_NAME.toLowerCase().includes(normalized);
}

function mergeServicioMlCliente(items: Cliente[], search = '') {
  if (!matchesServicioMlSearch(search)) {
    return items;
  }

  const existingIndex = items.findIndex((item) => (item.clave || '').trim() === SERVICIO_ML_CLIENT_CODE);
  if (existingIndex === -1) {
    return [buildServicioMlCliente(), ...items];
  }

  const existing = items[existingIndex];
  const merged = {
    ...buildServicioMlCliente(),
    ...existing,
    clave: SERVICIO_ML_CLIENT_CODE,
    nombre: existing.nombre || existing.nombre_comercial || SERVICIO_ML_CLIENT_NAME,
    nombre_comercial: existing.nombre_comercial || existing.nombre || SERVICIO_ML_CLIENT_NAME,
  };

  return [merged, ...items.filter((_, index) => index !== existingIndex)];
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<PaginatedResponse<T>> {
  const firstPage = await fetchPage(1);
  if (firstPage.meta.page_count <= 1) {
    return firstPage;
  }

  const items = [...firstPage.items];
  for (let page = 2; page <= firstPage.meta.page_count; page += 1) {
    const nextPage = await fetchPage(page);
    items.push(...nextPage.items);
  }

  return {
    meta: {
      page: 1,
      per_page: items.length,
      total: firstPage.meta.total,
      page_count: 1,
    },
    items,
  };
}

export const catalogApi = {
  listClientes: (token: string, search = '', options: BaseCatalogOptions = {}) => {
    const query = buildQuery({
      per_page: options.perPage ?? 50,
      page: options.page,
      search: search.trim(),
    });

    return apiRequest<PaginatedResponse<Cliente>>(`/clientes?${query}`, { token });
  },
  listProductos: (token: string, search = '', options: ProductosOptions = {}) => {
    const query = buildQuery({
      per_page: options.perPage ?? 100,
      page: options.page,
      search: search.trim(),
      include_out_of_line: options.includeOutOfLine ? 1 : 0,
      only_with_name: options.onlyWithName === false ? 0 : 1,
      only_with_price: options.onlyWithPrice ? 1 : 0,
    });

    return apiRequest<PaginatedResponse<Producto>>(`/productos?${query}`, { token });
  },
  listClientesAll: async (token: string, search = '', options: BaseCatalogOptions = {}) => {
    const response = await fetchAllPages((page) =>
      catalogApi.listClientes(token, search, {
        ...options,
        page,
      }),
    );
    const items = mergeServicioMlCliente(response.items, search);

    return {
      ...response,
      meta: {
        ...response.meta,
        total: items.length,
        per_page: items.length,
        page_count: 1,
      },
      items,
    };
  },
  listProductosAll: (token: string, search = '', options: ProductosOptions = {}) =>
    fetchAllPages((page) =>
      catalogApi.listProductos(token, search, {
        ...options,
        page,
      }),
    ),

  lookupCodigoPostal: (token: string, codigoPostal: string) =>
    apiRequest<CodigoPostalLookupResponse>(`/direcciones/codigo-postal/${encodeURIComponent(codigoPostal)}`, {
      token,
    }),
};

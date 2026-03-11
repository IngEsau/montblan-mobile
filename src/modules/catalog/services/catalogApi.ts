import { apiRequest } from '../../../shared/api/http';
import { Cliente, PaginatedResponse, Producto } from '../types';

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
  listClientesAll: (token: string, search = '', options: BaseCatalogOptions = {}) =>
    fetchAllPages((page) =>
      catalogApi.listClientes(token, search, {
        ...options,
        page,
      }),
    ),
  listProductosAll: (token: string, search = '', options: ProductosOptions = {}) =>
    fetchAllPages((page) =>
      catalogApi.listProductos(token, search, {
        ...options,
        page,
      }),
    ),
};

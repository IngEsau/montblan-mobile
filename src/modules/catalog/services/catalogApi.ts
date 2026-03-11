import { apiRequest } from '../../../shared/api/http';
import { Cliente, PaginatedResponse, Producto } from '../types';

export const catalogApi = {
  listClientes: (token: string, search = '') =>
    apiRequest<PaginatedResponse<Cliente>>(
      `/clientes?per_page=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      { token },
    ),
  listProductos: (token: string, search = '') =>
    apiRequest<PaginatedResponse<Producto>>(
      `/productos?per_page=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      { token },
    ),
};

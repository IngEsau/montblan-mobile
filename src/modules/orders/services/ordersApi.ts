import { apiRequest } from '../../../shared/api/http';
import {
  PedidoCreatePayload,
  PedidoCreateResponse,
  PedidoDetailResponse,
  PedidoListResponse,
  PedidoTransitionResponse,
  WarehouseUpdatePayload,
  WarehouseUpdateResponse,
} from '../types';

type ListOrdersParams = {
  search?: string;
  status?: number;
  page?: number;
};

function buildOrdersQuery({ search, status, page = 1 }: ListOrdersParams) {
  const params = new URLSearchParams();
  params.set('per_page', '20');
  params.set('page', String(page));

  if (search) {
    params.set('search', search);
  }

  if (status !== undefined) {
    params.set('status', String(status));
  }

  return params.toString();
}

export const ordersApi = {
  list: (token: string, params: ListOrdersParams) =>
    apiRequest<PedidoListResponse>(`/pedidos?${buildOrdersQuery(params)}`, {
      token,
    }),

  detail: (token: string, orderId: number) =>
    apiRequest<PedidoDetailResponse>(`/pedidos/${orderId}`, {
      token,
    }),

  create: (token: string, payload: PedidoCreatePayload) =>
    apiRequest<PedidoCreateResponse>('/pedidos', {
      token,
      method: 'POST',
      body: payload,
    }),

  transition: (token: string, orderId: number, to: 'almacen' | 'ctas_cobrar' | 'almacen_final' | 'terminado') =>
    apiRequest<PedidoTransitionResponse>(`/pedidos/${orderId}/transition`, {
      token,
      method: 'POST',
      body: { to },
    }),

  updateWarehouse: (token: string, orderId: number, payload: WarehouseUpdatePayload) =>
    apiRequest<WarehouseUpdateResponse>(`/pedidos/${orderId}/almacen`, {
      token,
      method: 'PATCH',
      body: payload,
    }),
};

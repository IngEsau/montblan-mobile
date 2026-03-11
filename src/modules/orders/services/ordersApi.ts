import { apiRequest } from '../../../shared/api/http';
import {
  PedidoCxcUpdatePayload,
  PedidoCxcUpdateResponse,
  PedidoCreatePayload,
  PedidoCreateResponse,
  PedidoDeletePagoResponse,
  PedidoDetailResponse,
  PedidoPagosResponse,
  PedidoRegistrarDocumentoPayload,
  PedidoRegistrarDocumentoResponse,
  PedidoRegistrarPagoPayload,
  PedidoRegistrarPagoResponse,
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

export type PedidoTransitionTarget = 'almacen' | 'ctas_cobrar' | 'almacen_final' | 'terminado';

type TransitionPayload = {
  ruta?: string;
  fecha_entrega?: string;
};

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

  update: (token: string, orderId: number, payload: PedidoCreatePayload) =>
    apiRequest<PedidoCreateResponse>(`/pedidos/${orderId}`, {
      token,
      method: 'PATCH',
      body: payload,
    }),

  transition: (
    token: string,
    orderId: number,
    to: PedidoTransitionTarget,
    payload: TransitionPayload = {},
  ) =>
    apiRequest<PedidoTransitionResponse>(`/pedidos/${orderId}/transition`, {
      token,
      method: 'POST',
      body: { to, ...payload },
    }),

  updateWarehouse: (token: string, orderId: number, payload: WarehouseUpdatePayload) =>
    apiRequest<WarehouseUpdateResponse>(`/pedidos/${orderId}/almacen`, {
      token,
      method: 'PATCH',
      body: payload,
    }),

  pagos: (token: string, orderId: number) =>
    apiRequest<PedidoPagosResponse>(`/pedidos/${orderId}/pagos`, {
      token,
    }),

  registrarPago: (token: string, orderId: number, payload: PedidoRegistrarPagoPayload) =>
    apiRequest<PedidoRegistrarPagoResponse>(`/pedidos/${orderId}/pagos`, {
      token,
      method: 'POST',
      body: payload,
    }),

  deletePago: (token: string, orderId: number, pagoId: number) =>
    apiRequest<PedidoDeletePagoResponse>(`/pedidos/${orderId}/pagos/${pagoId}`, {
      token,
      method: 'DELETE',
    }),

  updateCxc: (token: string, orderId: number, payload: PedidoCxcUpdatePayload) =>
    apiRequest<PedidoCxcUpdateResponse>(`/pedidos/${orderId}/ctas-cobrar`, {
      token,
      method: 'PATCH',
      body: payload,
    }),

  registrarDocumento: (token: string, orderId: number, payload: PedidoRegistrarDocumentoPayload) =>
    apiRequest<PedidoRegistrarDocumentoResponse>(`/pedidos/${orderId}/documento`, {
      token,
      method: 'POST',
      body: payload,
    }),
};

import { apiRequest } from '../../../shared/api/http';
import { API_BASE_URL } from '../../../shared/config/env';
import { PedidoAdjuntoUploadAsset, PedidoAdjuntosResponse } from '../types';

function buildEvidenceFormValue(asset: PedidoAdjuntoUploadAsset) {
  if (asset.file) {
    return asset.file;
  }

  return {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || 'application/octet-stream',
  } as any;
}

function appendEvidenceAsset(formData: FormData, asset: PedidoAdjuntoUploadAsset) {
  formData.append('pedido_adjuntos[]', buildEvidenceFormValue(asset));
}

function buildHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    Accept: '*/*',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export const evidenceApi = {
  list: (token: string, orderId: number) =>
    apiRequest<PedidoAdjuntosResponse>(`/pedidos/${orderId}/adjuntos`, {
      token,
    }),

  upload: (token: string, orderId: number, assets: PedidoAdjuntoUploadAsset[]) => {
    const formData = new FormData();
    assets.forEach((asset) => appendEvidenceAsset(formData, asset));

    return apiRequest<PedidoAdjuntosResponse>(`/pedidos/${orderId}/adjuntos`, {
      token,
      method: 'POST',
      body: formData,
    });
  },

  fetch: (token: string, orderId: number, adjuntoId: number, action: 'preview' | 'download') =>
    fetch(`${API_BASE_URL}/pedidos/${orderId}/adjuntos/${adjuntoId}/${action}`, {
      headers: buildHeaders(token),
    }),

  previewPath: (orderId: number, adjuntoId: number) => `/pedidos/${orderId}/adjuntos/${adjuntoId}/preview`,
  downloadPath: (orderId: number, adjuntoId: number) => `/pedidos/${orderId}/adjuntos/${adjuntoId}/download`,
};

import * as DocumentPicker from 'expo-document-picker';
import { ApiError } from '../../../shared/api/http';
import { downloadEvidenceFile, formatEvidenceBytes, openEvidencePreview } from '../services/evidenceFiles';
import { evidenceApi } from '../services/evidenceApi';
import { PedidoAdjuntoUploadAsset, PedidoEvidenciaItem } from '../types';

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const asObject = payload as Record<string, unknown>;
    if (typeof asObject.message === 'string' && asObject.message.trim()) {
      return asObject.message;
    }
  }

  return fallback;
}

export function formatEvidenceSize(bytes?: number | null) {
  return formatEvidenceBytes(bytes);
}

export function formatEvidenceExpiry(timestamp?: number | null) {
  if (!timestamp) {
    return 'Sin expiración visible';
  }

  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

export async function pickEvidenceFiles(): Promise<PedidoAdjuntoUploadAsset[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ['image/*', 'application/pdf'],
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType || null,
    size: asset.size ?? null,
    file: asset.file,
  }));
}

export async function previewEvidence(token: string, orderId: number, evidence: PedidoEvidenciaItem) {
  try {
    await openEvidencePreview(token, evidenceApi.previewPath(orderId, evidence.id), evidence.nombre_original);
  } catch (error) {
    if (error instanceof ApiError || error instanceof Error) {
      throw error;
    }

    throw new Error(parseErrorMessage(error, 'No fue posible abrir la evidencia.'));
  }
}

export async function downloadEvidence(token: string, orderId: number, evidence: PedidoEvidenciaItem) {
  try {
    await downloadEvidenceFile(token, evidenceApi.downloadPath(orderId, evidence.id), evidence.nombre_original, evidence.mime_type);
  } catch (error) {
    if (error instanceof ApiError || error instanceof Error) {
      throw error;
    }

    throw new Error(parseErrorMessage(error, 'No fue posible descargar la evidencia.'));
  }
}

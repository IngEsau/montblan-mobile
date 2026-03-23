import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { API_BASE_URL } from '../../../shared/config/env';

function getAuthorizedHeaders(token: string) {
  return {
    Accept: '*/*',
    Authorization: `Bearer ${token}`,
  };
}

function parseErrorMessage(payloadText: string, fallback: string) {
  if (!payloadText) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(payloadText) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // Ignore parsing errors; fall back to raw text.
  }

  const cleaned = payloadText.trim();
  return cleaned || fallback;
}

export function formatEvidenceBytes(bytes?: number | null) {
  const value = Number(bytes || 0);
  if (value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const quotient = value / 1024 ** power;
  return `${quotient.toFixed(power === 0 ? 0 : 2)} ${units[power]}`;
}

export function sanitizeEvidenceFileName(fileName: string) {
  const cleaned = String(fileName || 'evidencia')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');

  return cleaned || 'evidencia';
}

async function fetchEvidenceResponse(token: string, path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: getAuthorizedHeaders(token),
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(parseErrorMessage(rawText, `No fue posible obtener la evidencia (${response.status}).`));
  }

  return response;
}

async function openNativeFile(token: string, path: string, fileName: string, mimeType: string | null | undefined, forDownload: boolean) {
  const directory = forDownload ? new Directory(Paths.document, 'montblan-evidence') : new Directory(Paths.cache, 'montblan-evidence');
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  const targetFile = new File(directory, sanitizeEvidenceFileName(fileName));
  const downloaded = await File.downloadFileAsync(`${API_BASE_URL}${path}`, targetFile, {
    headers: getAuthorizedHeaders(token),
    idempotent: true,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloaded.uri, {
      dialogTitle: forDownload ? 'Descargar evidencia' : 'Ver evidencia',
      mimeType: mimeType || undefined,
    });
    return;
  }

  Alert.alert(
    forDownload ? 'Evidencia descargada' : 'Evidencia lista',
    `El archivo quedó guardado en ${downloaded.uri}.`,
  );
}

export async function openEvidencePreview(token: string, path: string, fileName: string) {
  if (Platform.OS !== 'web') {
    await openNativeFile(token, path, fileName, null, false);
    return;
  }

  const response = await fetchEvidenceResponse(token, path);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadEvidenceFile(
  token: string,
  path: string,
  fileName: string,
  mimeType?: string | null,
) {
  if (Platform.OS !== 'web') {
    await openNativeFile(token, path, fileName, mimeType || null, true);
    return;
  }

  const response = await fetchEvidenceResponse(token, path);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = sanitizeEvidenceFileName(fileName);
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

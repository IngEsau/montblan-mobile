const STATUS_LABELS: Record<number, string> = {
  1: 'CANCELADO',
  10: 'CAPTURA',
  20: 'AUTORIZACION',
  30: 'ALMACEN',
  40: 'CREDITO',
  45: 'FACTURACION',
  50: 'TERMINADO',
};

export type OrderStatusTone = 'primary' | 'warning' | 'danger' | 'success' | 'default';

function isUsableLabel(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return false;
  }

  if (/^STATUS\s+\d+$/i.test(normalized) || /^FASE\s+\d+$/i.test(normalized)) {
    return false;
  }

  return true;
}

export function resolveOrderStatusLabel(
  status: number | null | undefined,
  statusLabel?: string | null,
  isStandby?: boolean | null,
) {
  if (isStandby) {
    return 'STANDBY';
  }

  if (status === 1) {
    return 'CANCELADO';
  }

  if (isUsableLabel(statusLabel)) {
    return String(statusLabel).trim().toUpperCase();
  }

  if (typeof status === 'number' && STATUS_LABELS[status]) {
    return STATUS_LABELS[status];
  }

  return 'SIN ESTADO';
}

export function resolveOrderStatusTone(
  status: number | null | undefined,
  isStandby?: boolean | null,
): OrderStatusTone {
  if (isStandby) {
    return 'warning';
  }

  if (status === 50) {
    return 'success';
  }

  if (status === 1) {
    return 'danger';
  }

  if (status === 20 || status === 30 || status === 45) {
    return 'warning';
  }

  if (status === 10) {
    return 'primary';
  }

  return 'default';
}

export function resolveOrderStageLabel(status: number | null | undefined) {
  if (typeof status === 'number' && STATUS_LABELS[status]) {
    return STATUS_LABELS[status];
  }

  return 'SIN ESTADO';
}

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

export function formatMoney(value: number | null | undefined) {
  return moneyFormatter.format(Number(value || 0));
}

export function formatDateYmd(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const parts = value.split('-');
  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatUnixDateTime(unixTs: number | null | undefined) {
  if (!unixTs) {
    return '-';
  }

  const date = new Date(unixTs * 1000);
  return date.toLocaleString('es-MX');
}

export function getTodayYmd() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, '0');
  const dd = `${now.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

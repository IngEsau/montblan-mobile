import { Pedido, PedidoDetalleLinea } from '../types';

const FACTURA_TYPE = 10;

type PedidoLike = Pick<Pedido, 'detalle' | 'tipo_fac_rem' | 'venta_especial' | 'is_canceled_effective'>;

export type PedidoSpecialPriceComparison = {
  available: boolean;
  originalSubtotal: number;
  originalIva: number;
  originalTotal: number;
  finalSubtotal: number;
  finalIva: number;
  finalTotal: number;
};

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function resolveFacturableQty(line: PedidoDetalleLinea) {
  const surtido = Number(line.surtido ?? 0);
  if (surtido > 0) {
    return surtido;
  }

  return Number(line.cantidad ?? 0);
}

function signAmount(order: PedidoLike | null | undefined, value: number) {
  return order?.is_canceled_effective ? roundMoney(value * -1) : roundMoney(value);
}

export function buildPedidoSpecialPriceComparison(order: PedidoLike | null | undefined): PedidoSpecialPriceComparison | null {
  if (!order?.venta_especial || !order.detalle?.length) {
    return null;
  }

  let originalSubtotal = 0;
  let finalSubtotal = 0;

  order.detalle.forEach((line) => {
    const cantidad = resolveFacturableQty(line);
    const precioOriginal = roundMoney(Number(line.precio_base ?? line.precio ?? 0));
    const precioFinal = line.precio_especial !== null && typeof line.precio_especial !== 'undefined'
      ? roundMoney(Number(line.precio_especial))
      : roundMoney(Number(line.precio ?? line.precio_base ?? 0));

    originalSubtotal += roundMoney(cantidad * precioOriginal);
    finalSubtotal += roundMoney(cantidad * precioFinal);
  });

  originalSubtotal = roundMoney(originalSubtotal);
  finalSubtotal = roundMoney(finalSubtotal);

  const originalIva = Number(order.tipo_fac_rem) === FACTURA_TYPE ? roundMoney(originalSubtotal * 0.16) : 0;
  const finalIva = Number(order.tipo_fac_rem) === FACTURA_TYPE ? roundMoney(finalSubtotal * 0.16) : 0;

  return {
    available: true,
    originalSubtotal: signAmount(order, originalSubtotal),
    originalIva: signAmount(order, originalIva),
    originalTotal: signAmount(order, originalSubtotal + originalIva),
    finalSubtotal: signAmount(order, finalSubtotal),
    finalIva: signAmount(order, finalIva),
    finalTotal: signAmount(order, finalSubtotal + finalIva),
  };
}

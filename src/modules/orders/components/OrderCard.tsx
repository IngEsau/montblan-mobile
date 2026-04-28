import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PedidoListItem } from '../types';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { formatMoney, formatUnixDateTime } from '../../../shared/utils/formatters';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { resolveOrderStatusLabel, resolveOrderStatusTone } from '../utils/status';
import { OrderMode } from '../../../navigation/types';

type OrderCardProps = {
  order: PedidoListItem;
  mode: OrderMode;
  onPress: () => void;
  showEvidenceIndicator?: boolean;
};

export function OrderCard({ order, mode, onPress, showEvidenceIndicator = false }: OrderCardProps) {
  const isFinished = order.status === 50;
  const isCanceled = Boolean(order.is_canceled_effective) || order.status === 1 || Boolean(order.documento_cancelado);
  const canViewSpecialPrice = Boolean(order.can_view_special_price);
  const primaryStatusLabel = resolveOrderStatusLabel(order.status, order.status_label, order.is_standby);
  const documentLabel =
    (order.tipo_fac_rem ?? 10) === 20 ? 'Remisión SA' : 'Factura';
  const mercadoLibreLabel = order.es_ml_facturacion ? 'ML FACTURACION' : 'MERCADO LIBRE';
  const canSeeEvidenceIndicator = Boolean(order.can_view_evidence || order.can_manage_evidence || showEvidenceIndicator);
  const hasEvidence = Boolean(order.has_evidence);
  const inventoryFeedback = order.inventory_feedback ?? [];
  const visibleInventoryFeedback = inventoryFeedback.slice(0, 2);
  const subtotal = mode === 'sales'
    ? Number(order.subtotal_captura_signed ?? order.subtotal_signed ?? order.subtotal_captura ?? order.subtotal)
    : Number(order.subtotal_signed ?? order.subtotal);
  const iva = mode === 'sales'
    ? Number(order.iva_captura_signed ?? order.iva_signed ?? order.iva_captura ?? order.iva)
    : Number(order.iva_signed ?? order.iva);
  const total = mode === 'sales'
    ? Number(order.total_captura_signed ?? order.total_signed ?? order.total_captura ?? order.total)
    : Number(order.total_signed ?? order.total);

  return (
    <Pressable style={[styles.card, isFinished && styles.cardFinished, isCanceled && styles.cardCanceled]} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.orderNumber}>Pedido #{order.no_pedido || order.id}</Text>
        <View style={styles.badgesGroup}>
          <StatusBadge
            label={primaryStatusLabel}
            tone={resolveOrderStatusTone(order.status, order.is_standby)}
          />
          {order.postfechado ? <StatusBadge label="POSTFECHADO" tone="warning" /> : null}
          {canViewSpecialPrice && order.venta_especial ? <StatusBadge label="VENTA ESPECIAL" tone="primary" /> : null}
          {order.es_mercado_libre ? <StatusBadge label={mercadoLibreLabel} tone="mercadoLibre" /> : null}
          {isCanceled ? <StatusBadge label="CANCELADO" tone="danger" /> : null}
        </View>
      </View>

      <Text style={styles.client}>{order.cliente_razon_social || 'Sin razón social'}</Text>
      <Text style={styles.clientCode}>Cliente: {order.no_cliente || '-'}</Text>
      {canSeeEvidenceIndicator ? (
        <View style={styles.evidenceIndicatorRow}>
          <Ionicons
            name={hasEvidence ? 'document-text' : 'document-text-outline'}
            size={15}
            color={hasEvidence ? palette.primaryDark : palette.mutedText}
          />
          <Text style={[styles.evidenceIndicatorText, hasEvidence && styles.evidenceIndicatorTextActive]}>
            {hasEvidence ? 'Con documento adjunto' : 'Sin documento adjunto'}
          </Text>
        </View>
      ) : null}
      {isFinished ? (
        <Text style={styles.finishedMeta}>
          {documentLabel}: {order.no_factura || 'Sin documento final'}
        </Text>
      ) : null}

      {visibleInventoryFeedback.length > 0 ? (
        <View style={styles.inventoryFeedbackCard}>
          <Text style={styles.inventoryFeedbackTitle}>Inv. inicial - pedido = restante</Text>
          {visibleInventoryFeedback.map((item, index) => {
            const resultNegative = Number(item.inventario_resultante) < 0;
            return (
              <Text key={`${item.codigo || 'item'}-${index}`} style={styles.inventoryFeedbackLine}>
                <Text style={styles.inventoryFeedbackCode}>{item.codigo || 'S/C'}</Text>
                <Text style={styles.inventoryFeedbackMuted}>: {Math.round(item.inventario_inicial)} - {Math.round(item.cantidad_pedido)} = </Text>
                <Text style={resultNegative ? styles.inventoryFeedbackResultDanger : styles.inventoryFeedbackResult}>
                  {Math.round(item.inventario_resultante)}
                </Text>
              </Text>
            );
          })}
          {inventoryFeedback.length > visibleInventoryFeedback.length ? (
            <Text style={styles.inventoryFeedbackMore}>+{inventoryFeedback.length - visibleInventoryFeedback.length} más</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <View style={styles.totalsColumn}>
          <Text style={styles.totalLine}>Subtotal: {formatMoney(subtotal)}</Text>
          <Text style={styles.totalLine}>IVA: {formatMoney(iva)}</Text>
          <Text style={styles.total}>Total: {formatMoney(total)}</Text>
        </View>
        <Text style={styles.date}>{formatUnixDateTime(order.fecha)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 10,
  },
  cardFinished: {
    borderColor: '#ccecdf',
    backgroundColor: '#f7fcfa',
  },
  cardCanceled: {
    borderColor: '#f3c6cf',
    backgroundColor: '#fff8f9',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  badgesGroup: {
    alignItems: 'flex-end',
    gap: 6,
  },
  orderNumber: {
    flex: 1,
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  client: {
    marginTop: 10,
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
  clientCode: {
    marginTop: 3,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
  evidenceIndicatorRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  evidenceIndicatorText: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  evidenceIndicatorTextActive: {
    color: palette.primaryDark,
  },
  finishedMeta: {
    marginTop: 6,
    color: palette.primaryDark,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  inventoryFeedbackCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe9e3',
    backgroundColor: '#f8fcfa',
  },
  inventoryFeedbackTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
    marginBottom: 4,
  },
  inventoryFeedbackLine: {
    color: palette.text,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  inventoryFeedbackCode: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  inventoryFeedbackMuted: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
  inventoryFeedbackResult: {
    color: palette.primaryDark,
    fontFamily: typography.bold,
    fontSize: 12,
  },
  inventoryFeedbackResultDanger: {
    color: '#c0392b',
    fontFamily: typography.bold,
    fontSize: 12,
  },
  inventoryFeedbackMore: {
    marginTop: 3,
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 11,
  },
  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  totalsColumn: {
    flex: 1,
  },
  total: {
    color: palette.primaryDark,
    fontFamily: typography.bold,
    fontSize: 15,
  },
  totalLine: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  date: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PedidoListItem } from '../types';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { formatMoney, formatUnixDateTime } from '../../../shared/utils/formatters';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { resolveOrderStatusLabel, resolveOrderStatusTone } from '../utils/status';

type OrderCardProps = {
  order: PedidoListItem;
  onPress: () => void;
};

export function OrderCard({ order, onPress }: OrderCardProps) {
  const isFinished = order.status === 50;
  const isCanceled = order.status === 1 || Boolean(order.documento_cancelado);
  const primaryStatusLabel = resolveOrderStatusLabel(order.status, order.status_label, order.is_standby);
  const documentLabel =
    (order.tipo_fac_rem ?? 10) === 20 ? 'Remisión SA' : 'Factura';

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
          {order.status !== 1 && Boolean(order.documento_cancelado) ? <StatusBadge label="CANCELADO" tone="danger" /> : null}
        </View>
      </View>

      <Text style={styles.client}>{order.cliente_razon_social || 'Sin razón social'}</Text>
      <Text style={styles.clientCode}>Cliente: {order.no_cliente || '-'}</Text>
      {isFinished ? (
        <Text style={styles.finishedMeta}>
          {documentLabel}: {order.no_factura || 'Sin documento final'}
        </Text>
      ) : null}

      <View style={styles.bottomRow}>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
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
  finishedMeta: {
    marginTop: 6,
    color: palette.primaryDark,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    color: palette.primaryDark,
    fontFamily: typography.bold,
    fontSize: 16,
  },
  date: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PedidoListItem } from '../types';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { formatMoney, formatUnixDateTime } from '../../../shared/utils/formatters';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';

type OrderCardProps = {
  order: PedidoListItem;
  onPress: () => void;
};

function resolveStatusTone(order: PedidoListItem): 'primary' | 'warning' | 'danger' | 'success' | 'default' {
  if (order.is_standby) {
    return 'warning';
  }

  if (order.status === 50) {
    return 'success';
  }

  if (order.status === 1) {
    return 'danger';
  }

  if (order.status === 30 || order.status === 20 || order.status === 45) {
    return 'warning';
  }

  if (order.status === 10) {
    return 'primary';
  }

  return 'default';
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.orderNumber}>Pedido #{order.no_pedido || order.id}</Text>
        <StatusBadge
          label={order.is_standby ? 'STANDBY' : order.status_label || 'SIN ESTADO'}
          tone={resolveStatusTone(order)}
        />
      </View>

      <Text style={styles.client}>{order.cliente_razon_social || 'Sin razón social'}</Text>
      <Text style={styles.clientCode}>Cliente: {order.no_cliente || '-'}</Text>

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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
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

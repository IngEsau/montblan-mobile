import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../../shared/api/http';
import { EmptyState } from '../../../shared/components/EmptyState';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatDateYmd, formatMoney } from '../../../shared/utils/formatters';
import { useAuth } from '../../auth/AuthContext';
import { ordersApi } from '../services/ordersApi';
import { Pedido } from '../types';

type OrderDetailScreenProps = {
  orderId: number;
  mode: 'sales' | 'warehouse';
  onOpenWarehouseCapture: (orderId: number) => void;
  onOpenWarehouseDelivery: (orderId: number) => void;
};

export function OrderDetailScreen({
  orderId,
  mode,
  onOpenWarehouseCapture,
  onOpenWarehouseDelivery,
}: OrderDetailScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await ordersApi.detail(token, orderId);
      setOrder(response.item);
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible cargar el detalle del pedido.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const canSendToWarehouse = useMemo(() => mode === 'sales' && order?.status === 10, [mode, order?.status]);
  const canCaptureWarehouse = useMemo(
    () => mode === 'warehouse' && order?.status === 30,
    [mode, order?.status],
  );
  const canCaptureWarehouseDelivery = useMemo(
    () => mode === 'warehouse' && order?.status === 45,
    [mode, order?.status],
  );

  const sendToWarehouse = async () => {
    if (!token || !order || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await ordersApi.transition(token, order.id, 'almacen');
      Alert.alert('Pedido actualizado', 'El pedido fue enviado a ALMACÉN.');
      await fetchDetail();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible enviar el pedido.';
      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <EmptyState title="Pedido no disponible" subtitle={errorMessage || 'Sin información para mostrar.'} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.orderNumber}>Pedido #{order.no_pedido || order.id}</Text>
        <View style={styles.badgesRow}>
          <StatusBadge label={order.status_label || 'SIN ESTADO'} tone={order.is_standby ? 'warning' : 'primary'} />
          {order.almacen_status ? <StatusBadge label={order.almacen_status} tone="warning" /> : null}
        </View>

        <Text style={styles.customer}>{order.cliente_razon_social || 'Sin razón social'}</Text>
        <Text style={styles.meta}>Cliente: {order.no_cliente || '-'}</Text>
        <Text style={styles.meta}>Entrega: {formatDateYmd(order.fecha_entrega)}</Text>
        <Text style={styles.meta}>Ruta: {order.ruta || '-'}</Text>
        <Text style={styles.meta}>Cobranza: {order.ctas_cobrar_status || '-'}</Text>
        <Text style={styles.meta}>Vendedor: {order.vendedor || '-'}</Text>

        <View style={styles.amountsRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Subtotal</Text>
            <Text style={styles.amountValue}>{formatMoney(order.subtotal)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>IVA</Text>
            <Text style={styles.amountValue}>{formatMoney(order.iva)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>{formatMoney(order.total)}</Text>
          </View>
        </View>
      </View>

      {order.observaciones ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Observaciones</Text>
          <Text style={styles.observaciones}>{order.observaciones}</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Detalle del pedido</Text>
        {order.detalle.length === 0 ? (
          <Text style={styles.meta}>Sin partidas</Text>
        ) : (
          order.detalle.map((line) => (
            <View key={line.id} style={styles.lineCard}>
              <View style={styles.lineTopRow}>
                <Text style={styles.lineCode}>{line.codigo || 'SIN CÓDIGO'}</Text>
                <Text style={styles.lineAmount}>{formatMoney(line.importe)}</Text>
              </View>
              <Text style={styles.lineDesc}>{line.descripcion || 'Sin descripción'}</Text>
              <Text style={styles.metaRow}>
                Cantidad: {line.cantidad} | Surtido: {line.surtido ?? 0} | Faltante: {line.faltante}
              </Text>
              <Text style={styles.metaRow}>
                Rollos: {line.rollo ?? 0} | Inventario: {line.inventario_disponible ?? '-'}
              </Text>
            </View>
          ))
        )}
      </View>

      {canSendToWarehouse ? (
        <Pressable style={styles.actionButton} onPress={sendToWarehouse} disabled={isSending}>
          <Text style={styles.actionLabel}>{isSending ? 'Enviando...' : 'Enviar a Almacén'}</Text>
        </Pressable>
      ) : null}

      {canCaptureWarehouse ? (
        <Pressable
          style={[styles.actionButton, styles.actionButtonWarehouse]}
          onPress={() => onOpenWarehouseCapture(order.id)}
        >
          <Text style={styles.actionLabel}>Capturar Almacén</Text>
        </Pressable>
      ) : null}

      {canCaptureWarehouseDelivery ? (
        <Pressable
          style={[styles.actionButton, styles.actionButtonDelivery]}
          onPress={() => onOpenWarehouseDelivery(order.id)}
        >
          <Text style={styles.actionLabel}>Capturar ruta y entrega</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  headerCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  orderNumber: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 19,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  customer: {
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 16,
    marginBottom: 4,
  },
  meta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 13,
    marginBottom: 2,
  },
  amountsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  amountItem: {
    flex: 1,
    backgroundColor: '#f5faf9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9efea',
    padding: 10,
  },
  amountLabel: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
  },
  amountValue: {
    marginTop: 3,
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 15,
    marginBottom: 10,
  },
  observaciones: {
    color: palette.text,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  lineCard: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#edf2f6',
  },
  lineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineCode: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  lineAmount: {
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  lineDesc: {
    color: palette.text,
    fontFamily: typography.regular,
    marginTop: 3,
    marginBottom: 4,
  },
  metaRow: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    marginTop: 1,
  },
  actionButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonWarehouse: {
    backgroundColor: palette.navy,
  },
  actionButtonDelivery: {
    backgroundColor: '#4a6da7',
  },
  actionLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
});

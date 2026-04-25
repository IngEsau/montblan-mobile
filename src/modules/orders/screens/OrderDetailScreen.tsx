import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../../../shared/config/env';
import { ApiError } from '../../../shared/api/http';
import { EmptyState } from '../../../shared/components/EmptyState';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatDateYmd, formatMoney } from '../../../shared/utils/formatters';
import { useAuth } from '../../auth/AuthContext';
import { ordersApi } from '../services/ordersApi';
import { Pedido, PedidoEvidenciaItem } from '../types';
import { OrderMode } from '../../../navigation/types';
import { resolveOrderStatusLabel, resolveOrderStatusTone } from '../utils/status';

type OrderDetailScreenProps = {
  orderId: number;
  mode: OrderMode;
  onOpenWarehouseCapture: (orderId: number) => void;
  onEditCaptureOrder: (orderId: number) => void;
  onOpenCxcOperation: (orderId: number) => void;
  onOpenFinishedOrders: () => void;
};

function formatBytes(bytes?: number | null) {
  const value = Number(bytes || 0);
  if (!value || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const sized = value / 1024 ** power;
  return `${sized.toFixed(power === 0 ? 0 : 2)} ${units[power]}`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function formatWholeNumber(value: number | null | undefined) {
  if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) {
    return '0';
  }

  return String(Math.max(0, Math.round(Number(value))));
}

export function OrderDetailScreen({
  orderId,
  mode,
  onOpenWarehouseCapture,
  onEditCaptureOrder,
  onOpenCxcOperation,
  onOpenFinishedOrders,
}: OrderDetailScreenProps) {
  const { token, user } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const detailResponse = await ordersApi.detail(token, orderId);
      const item = detailResponse.item;
      setOrder(item);
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

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
    }, [fetchDetail]),
  );

  const normalizedRole = useMemo(
    () =>
      String(user?.rol ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim(),
    [user?.rol],
  );

  const canSeeFinishedStage = useMemo(() => {
    const permissionFlags = user?.permissions;
    const byPermission = permissionFlags && typeof permissionFlags.can_warehouse === 'boolean'
      ? Boolean(permissionFlags.can_warehouse)
      : false;
    if (normalizedRole === '') {
      return true;
    }

    return byPermission || (
      normalizedRole.includes('ALMACEN') ||
      normalizedRole.includes('THECREATOR') ||
      normalizedRole.includes('ADMIN') ||
      normalizedRole.includes('SUPER')
    );
  }, [normalizedRole, user?.permissions]);

  const canSeeCxcStage = useMemo(() => {
    const permissionFlags = user?.permissions;
    const byPermission = permissionFlags && typeof permissionFlags.can_cxc === 'boolean'
      ? Boolean(permissionFlags.can_cxc)
      : false;
    if (normalizedRole === '') {
      return true;
    }

    return byPermission || (
      normalizedRole.includes('CTAS') ||
      normalizedRole.includes('COBRAR') ||
      normalizedRole.includes('CXC') ||
      normalizedRole.includes('THECREATOR') ||
      normalizedRole.includes('ADMIN') ||
      normalizedRole.includes('SUPER')
    );
  }, [normalizedRole, user?.permissions]);

  const canOperateSales = useMemo(() => {
    const permissionFlags = user?.permissions;
    const byPermission = permissionFlags && typeof permissionFlags.can_sales === 'boolean'
      ? Boolean(permissionFlags.can_sales)
      : false;
    return byPermission || mode === 'sales' || normalizedRole === '' || normalizedRole.includes('VENTAS') || normalizedRole.includes('VENDEDOR') || normalizedRole.includes('THECREATOR') || normalizedRole.includes('ADMIN') || normalizedRole.includes('SUPER');
  }, [mode, normalizedRole, user?.permissions]);
  const canSendToAuthorization = useMemo(
    () => canOperateSales && order?.status === 10,
    [canOperateSales, order?.status],
  );
  const isPostdatedLocked = useMemo(() => {
    if (!order?.postfechado || !order.fecha_entrega) {
      return false;
    }
    const unlockAt = new Date(`${order.fecha_entrega}T00:00:00`);
    unlockAt.setDate(unlockAt.getDate() - 1);
    return Date.now() < unlockAt.getTime();
  }, [order?.fecha_entrega, order?.postfechado]);
  const canCaptureWarehouse = useMemo(() => {
    const permissionFlags = user?.permissions;
    const byPermission = permissionFlags && typeof permissionFlags.can_warehouse === 'boolean'
      ? Boolean(permissionFlags.can_warehouse)
      : false;
    const byRole = mode === 'warehouse' || normalizedRole === '' || normalizedRole.includes('ALMACEN') || normalizedRole.includes('THECREATOR') || normalizedRole.includes('ADMIN') || normalizedRole.includes('SUPER');
    return (byPermission || byRole) && order?.status === 30;
  }, [mode, normalizedRole, order?.status, user?.permissions]);
  const canOperateCxc = useMemo(
    () => canSeeCxcStage && (order?.status === 20 || order?.status === 45 || order?.status === 50),
    [canSeeCxcStage, order?.status],
  );
  const canEditMlFacturacionFromDetail = useMemo(
    () =>
      Boolean(
        order?.status === 45 &&
          (order?.es_ml_salida ?? (order?.es_mercado_libre && !order?.es_ml_facturacion)) &&
          ((order?.can_edit_ml_facturacion ?? false) ||
            (user?.permissions?.can_edit_ml_facturacion ?? false) ||
            (user?.permissions?.can_cxc ?? false) ||
            normalizedRole.includes('CTAS') ||
            normalizedRole.includes('COBRAR') ||
            normalizedRole.includes('CXC') ||
            normalizedRole.includes('THECREATOR') ||
            normalizedRole.includes('ADMIN') ||
            normalizedRole.includes('SUPER')),
      ),
    [
      normalizedRole,
      order?.can_edit_ml_facturacion,
      order?.es_mercado_libre,
      order?.es_ml_facturacion,
      order?.es_ml_salida,
      order?.status,
      user?.permissions,
    ],
  );
  const canOpenFinishedList = useMemo(
    () => canSeeFinishedStage && order?.status === 50,
    [canSeeFinishedStage, order?.status],
  );
  const showWarehouseStatusBadge = useMemo(
    () => Boolean(order?.almacen_status) && order?.status === 30,
    [order?.almacen_status, order?.status],
  );
  const showCaptureAmounts = mode === 'sales';
  const displaySubtotal = showCaptureAmounts
    ? Number(order?.subtotal_captura_signed ?? order?.subtotal_signed ?? order?.subtotal_captura ?? order?.subtotal ?? 0)
    : Number(order?.subtotal_signed ?? order?.subtotal ?? 0);
  const displayIva = showCaptureAmounts
    ? Number(order?.iva_captura_signed ?? order?.iva_signed ?? order?.iva_captura ?? order?.iva ?? 0)
    : Number(order?.iva_signed ?? order?.iva ?? 0);
  const displayTotal = showCaptureAmounts
    ? Number(order?.total_captura_signed ?? order?.total_signed ?? order?.total_captura ?? order?.total ?? 0)
    : Number(order?.total_signed ?? order?.total ?? 0);
  const showCaptureReference = useMemo(() => {
    if (!order || showCaptureAmounts) {
      return false;
    }

    return Math.abs(Number(order.total_captura || 0) - Number(order.total || 0)) > 0.0001
      || Math.abs(Number(order.subtotal_captura || 0) - Number(order.subtotal || 0)) > 0.0001
      || Math.abs(Number(order.iva_captura || 0) - Number(order.iva || 0)) > 0.0001;
  }, [order, showCaptureAmounts]);

  const sendToAuthorization = async () => {
    if (!token || !order || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await ordersApi.transition(token, order.id, 'autorizacion');
      Alert.alert('Pedido actualizado', 'El pedido fue enviado a AUTORIZACIÓN.');
      await fetchDetail();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible enviar el pedido.';
      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleEvidenceAction = useCallback(
    async (item: PedidoEvidenciaItem, mode: 'preview' | 'download') => {
      if (!token || !order || activeEvidenceId === item.id) {
        return;
      }

      setActiveEvidenceId(item.id);
      try {
        const effectiveMode = mode === 'preview' && !item.previewable ? 'download' : mode;

        if (Platform.OS === 'web') {
          const response = await ordersApi.fetchAdjunto(token, order.id, item.id, effectiveMode);
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);

          if (effectiveMode === 'preview') {
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
          } else {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = item.nombre_original || `evidencia-${item.id}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
          }
          return;
        }

        const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!baseDirectory) {
          throw new Error('No hay un directorio temporal disponible en este dispositivo.');
        }

        const targetName = sanitizeFileName(item.nombre_original || `evidencia-${item.id}`);
        const targetUri = `${baseDirectory}${Date.now()}-${targetName}`;
        const sourceUrl =
          effectiveMode === 'preview'
            ? `${API_BASE_URL}${ordersApi.previewEvidencePath(order.id, item.id)}`
            : `${API_BASE_URL}${ordersApi.downloadEvidencePath(order.id, item.id)}`;

        const result = await FileSystem.downloadAsync(sourceUrl, targetUri, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: '*/*',
          },
        });

        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('Archivo listo', 'La evidencia se descargó, pero este dispositivo no soporta abrirla desde la app.');
          return;
        }

        await Sharing.shareAsync(result.uri, {
          mimeType: item.mime_type || undefined,
          dialogTitle: effectiveMode === 'preview' ? 'Abrir evidencia' : 'Compartir evidencia',
        });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'No fue posible procesar la evidencia.';
        Alert.alert('Error', message);
      } finally {
        setActiveEvidenceId(null);
      }
    },
    [activeEvidenceId, order, token],
  );

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
          <StatusBadge
            label={resolveOrderStatusLabel(order.status, order.status_label, order.is_standby)}
            tone={resolveOrderStatusTone(order.status, order.is_standby)}
          />
          {order.postfechado ? <StatusBadge label="POSTFECHADO" tone="warning" /> : null}
          {order.es_mercado_libre ? <StatusBadge label="MERCADO LIBRE" tone="mercadoLibre" /> : null}
          {order.origen_ml ? <StatusBadge label="DERIVADO ML" tone="default" /> : null}
          {order.venta_especial ? <StatusBadge label="VENTA ESPECIAL" tone="primary" /> : null}
          {order.status !== 1 && order.documento_cancelado ? <StatusBadge label="CANCELADO" tone="danger" /> : null}
          {showWarehouseStatusBadge ? <StatusBadge label={order.almacen_status || ''} tone="warning" /> : null}
        </View>

        <Text style={styles.customer}>{order.cliente_razon_social || 'Sin razón social'}</Text>
        <Text style={styles.meta}>Cliente: {order.no_cliente || '-'}</Text>
        {order.postfechado ? <Text style={styles.meta}>Entrega: {formatDateYmd(order.fecha_entrega)}</Text> : null}
        {order.es_mercado_libre ? (
          <Text style={styles.meta}>Mercado Libre: {order.es_ml_facturacion ? 'Facturación' : 'Salida'}</Text>
        ) : null}
        {order.origen_ml ? <Text style={styles.meta}>Pedido derivado desde ML: Sí</Text> : null}
        {order.es_ml_salida ? (
          <Text style={styles.meta}>
            Inventario afectado en almacén: {order.ml_inventario_afectado ? 'Sí' : 'No'}
          </Text>
        ) : null}
        {order.inventario_preafectado ? <Text style={styles.meta}>Inventario preafectado: Sí</Text> : null}
        {order.venta_especial ? <Text style={styles.meta}>Precio especial aplicado: Sí (precio promedio + 3%)</Text> : null}
        <Text style={styles.meta}>Vendedor: {order.vendedor || '-'}</Text>

        <View style={styles.amountsRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Subtotal</Text>
            <Text style={styles.amountValue}>{formatMoney(displaySubtotal)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>IVA</Text>
            <Text style={styles.amountValue}>{formatMoney(displayIva)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>{formatMoney(displayTotal)}</Text>
          </View>
        </View>
        {showCaptureReference ? (
          <Text style={styles.captureReference}>
            Captura original: Subtotal {formatMoney(Number(order.subtotal_captura_signed ?? order.subtotal_captura ?? 0))} | IVA {formatMoney(Number(order.iva_captura_signed ?? order.iva_captura ?? 0))} | Total {formatMoney(Number(order.total_captura_signed ?? order.total_captura ?? 0))}
          </Text>
        ) : null}
      </View>

      {order.observaciones ? (
        <View style={order.origen_ml ? styles.derivedObservationCard : styles.sectionCard}>
          <Text style={order.origen_ml ? styles.derivedObservationTitle : styles.sectionTitle}>Observaciones</Text>
          <Text style={styles.observaciones}>{order.observaciones}</Text>
          {order.origen_ml ? (
            <Text style={styles.derivedObservationMeta}>
              Contexto: este pedido fue generado desde un desglose final de Mercado Libre y conserva inventario preafectado desde el pedido origen.
            </Text>
          ) : null}
        </View>
      ) : null}

      {order.comentario_almacen ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Comentario de almacén</Text>
          <Text style={styles.observaciones}>{order.comentario_almacen}</Text>
        </View>
      ) : null}

      {order.es_mercado_libre ? (
        <View style={styles.mlInfoCard}>
          <Text style={styles.mlInfoTitle}>Mercado Libre</Text>
          <Text style={styles.mlInfoText}>
            {order.es_ml_facturacion
              ? 'Este pedido factura material ya consignado en ML; al terminar descuenta solo el saldo ML y no toca inventario físico.'
              : order.ml_inventario_afectado
                ? 'El inventario de este pedido ya fue afectado desde almacén para reflejar la salida física del producto.'
                : 'Este pedido está identificado como Mercado Libre. El inventario se afectará cuando salga de almacén hacia facturación.'}
          </Text>
          {order.ml_pendiente_facturacion ? (
            <Text style={styles.mlInfoMeta}>
              Pendiente por facturar: sí. Facturación no volverá a descontar inventario.
            </Text>
          ) : null}
        </View>
      ) : null}

      {order.origen_ml ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pedido derivado desde Mercado Libre</Text>
          <Text style={styles.observaciones}>
            Este pedido nació desde un ajuste final de Mercado Libre. El inventario ya estaba afectado previamente en el pedido origen y este flujo no volverá a descontarlo.
          </Text>
          {order.ml_origen_pedido_id ? (
            <Text style={styles.meta}>Pedido origen ML: #{order.ml_origen_pedido_id}</Text>
          ) : null}
        </View>
      ) : null}

      {(order.can_view_evidence || order.can_manage_evidence) && (order.evidencias?.length || 0) > 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Evidencia</Text>
          <Text style={styles.meta}>
            Visible solo para el vendedor que capturó el pedido y CXC.
          </Text>
          {(order.evidence_max_file_size_label || order.evidence_max_file_size_bytes || order.max_upload_bytes) ? (
            <Text style={styles.meta}>
              Tamaño máximo por archivo:{' '}
              {order.evidence_max_file_size_label || formatBytes(order.evidence_max_file_size_bytes || order.max_upload_bytes)}
            </Text>
          ) : null}
          {order.evidencias?.map((item) => (
            <View key={`evidence-${item.id}`} style={styles.evidenceCard}>
              <View style={styles.evidenceInfo}>
                <Text style={styles.evidenceName}>{item.nombre_original}</Text>
                <Text style={styles.evidenceMeta}>
                  {(item.extension || '-').toUpperCase()} | {formatBytes(item.tamano_bytes)}
                </Text>
              </View>
              <View style={styles.evidenceActions}>
                <Pressable
                  style={[styles.evidenceButton, styles.evidencePreviewButton]}
                  onPress={() => handleEvidenceAction(item, 'preview')}
                  disabled={activeEvidenceId === item.id}
                >
                  <Text style={styles.evidenceButtonLabel}>
                    {activeEvidenceId === item.id ? 'Procesando...' : 'Ver'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.evidenceButton, styles.evidenceDownloadButton]}
                  onPress={() => handleEvidenceAction(item, 'download')}
                  disabled={activeEvidenceId === item.id}
                >
                  <Text style={styles.evidenceButtonLabel}>Descargar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {order.status === 50 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Resumen de terminado</Text>
          <View style={styles.finishedSummaryRow}>
            <Text style={styles.finishedSummaryLabel}>Documento final</Text>
            <Text style={styles.finishedSummaryValue}>{order.no_factura || 'Sin documento final'}</Text>
          </View>
          {order.postfechado ? (
            <View style={styles.finishedSummaryRow}>
              <Text style={styles.finishedSummaryLabel}>Entrega</Text>
              <Text style={styles.finishedSummaryValue}>{formatDateYmd(order.fecha_entrega)}</Text>
            </View>
          ) : null}
          <View style={styles.finishedSummaryRow}>
            <Text style={styles.finishedSummaryLabel}>Documento cancelado</Text>
            <Text style={[styles.finishedSummaryValue, order.documento_cancelado && styles.finishedSummaryDanger]}>
              {order.documento_cancelado ? 'Sí' : 'No'}
            </Text>
          </View>
          {order.documento_cancelado ? (
            <>
              <View style={styles.finishedSummaryRow}>
                <Text style={styles.finishedSummaryLabel}>Motivo de cancelación</Text>
                <Text style={styles.finishedSummaryValue}>{order.motivo_cancelacion_documento || 'Sin motivo registrado'}</Text>
              </View>
              <View style={styles.finishedSummaryRow}>
                <Text style={styles.finishedSummaryLabel}>Cancelado por</Text>
                <Text style={styles.finishedSummaryValue}>{order.documento_cancelado_by_username || '-'}</Text>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Detalle de producto(s)</Text>
        {order.detalle.length === 0 ? (
          <Text style={styles.meta}>Sin partidas</Text>
        ) : (
          order.detalle.map((line) => (
            <View key={line.id} style={styles.lineCard}>
              <View style={styles.lineTopRow}>
                <Text style={styles.lineCode}>{line.codigo || 'SIN CÓDIGO'}</Text>
                <Text style={styles.lineAmount}>{formatMoney(line.importe)}</Text>
              </View>
              <Text style={styles.lineDesc}>{line.descripcion || line.codigo || 'Producto sin nombre'}</Text>
              <Text style={styles.metaRow}>
                Cantidad: {formatWholeNumber(line.cantidad)} | Surtido: {formatWholeNumber(line.surtido)} | Faltante: {formatWholeNumber(line.faltante)}
              </Text>
              <Text style={styles.metaRow}>
                Rollos: {formatWholeNumber(line.rollo)} | Inventario: {line.inventario_disponible ?? '-'}
              </Text>
              {order.venta_especial && line.precio_especial != null ? (
                <Text style={styles.metaRow}>
                  Precio base: {formatMoney(line.precio_base ?? line.precio)} | Especial: {formatMoney(line.precio_especial)}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      {canSendToAuthorization ? (
        <Pressable
          style={[styles.actionButton, styles.actionButtonEdit]}
          onPress={() => onEditCaptureOrder(order.id)}
        >
          <Text style={styles.actionLabel}>Editar pedido</Text>
        </Pressable>
      ) : null}

      {canSendToAuthorization ? (
        <Pressable
          style={styles.actionButton}
          onPress={sendToAuthorization}
          disabled={isSending}
        >
          <Text style={styles.actionLabel}>{isSending ? 'Enviando...' : 'Enviar a Autorización'}</Text>
        </Pressable>
      ) : null}

      {canCaptureWarehouse ? (
        <Pressable
          style={[
            styles.actionButton,
            styles.actionButtonWarehouse,
            isPostdatedLocked && styles.actionButtonDisabled,
          ]}
          onPress={() => {
            if (isPostdatedLocked) {
              Alert.alert('Postfechado bloqueado', 'Este pedido solo puede capturarse 24 horas antes de la fecha de entrega.');
              return;
            }
            onOpenWarehouseCapture(order.id);
          }}
        >
          <Text style={styles.actionLabel}>{isPostdatedLocked ? 'Postfechado bloqueado' : 'Capturar surtido'}</Text>
        </Pressable>
      ) : null}

      {canOperateCxc ? (
        <Pressable
          style={[styles.actionButton, styles.actionButtonCxc]}
          onPress={() => onOpenCxcOperation(order.id)}
        >
          <Text style={styles.actionLabel}>
            {order.status === 20
              ? 'Abrir autorización'
              : canEditMlFacturacionFromDetail
                ? 'Ajustar / derivar ML'
                : order.status === 45
                  ? 'Abrir facturación'
                  : 'Abrir cancelación de documento'}
          </Text>
        </Pressable>
      ) : null}

      {canOpenFinishedList ? (
        <Pressable
          style={[styles.actionButton, styles.actionButtonFinished]}
          onPress={onOpenFinishedOrders}
        >
          <Text style={styles.actionLabel}>Ir a pedidos terminados</Text>
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
  captureReference: {
    marginTop: 10,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  mlInfoCard: {
    backgroundColor: '#eef7fb',
    borderWidth: 1,
    borderColor: '#c6dcea',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  derivedObservationCard: {
    backgroundColor: '#f6f9fc',
    borderWidth: 1,
    borderColor: '#d5e0ea',
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
  derivedObservationTitle: {
    color: '#32556f',
    fontFamily: typography.semiBold,
    fontSize: 15,
    marginBottom: 8,
  },
  mlInfoTitle: {
    color: '#1d5f7a',
    fontFamily: typography.semiBold,
    fontSize: 15,
    marginBottom: 8,
  },
  observaciones: {
    color: palette.text,
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  mlInfoText: {
    color: '#24485d',
    fontFamily: typography.regular,
    lineHeight: 20,
  },
  mlInfoMeta: {
    color: '#3f6b81',
    fontFamily: typography.medium,
    fontSize: 12,
    marginTop: 8,
  },
  derivedObservationMeta: {
    color: '#587188',
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  evidenceCard: {
    borderTopWidth: 1,
    borderTopColor: '#edf2f6',
    paddingVertical: 10,
  },
  evidenceInfo: {
    marginBottom: 8,
  },
  evidenceName: {
    color: palette.text,
    fontFamily: typography.medium,
    fontSize: 13,
  },
  evidenceMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  evidenceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  evidenceButton: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  evidencePreviewButton: {
    backgroundColor: '#eef5fb',
  },
  evidenceDownloadButton: {
    backgroundColor: '#def3ee',
  },
  evidenceButtonLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  finishedSummaryRow: {
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#edf2f6',
  },
  finishedSummaryLabel: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
  finishedSummaryValue: {
    marginTop: 3,
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  finishedSummaryDanger: {
    color: '#b42318',
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
  actionButtonEdit: {
    backgroundColor: '#49738e',
  },
  actionButtonCxc: {
    backgroundColor: '#6b60c9',
  },
  actionButtonFinished: {
    backgroundColor: '#18a689',
  },
  actionButtonDisabled: {
    backgroundColor: '#a8c8c0',
  },
  actionLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
});

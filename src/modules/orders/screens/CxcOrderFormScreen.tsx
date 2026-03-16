import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../../../shared/api/http';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatMoney } from '../../../shared/utils/formatters';
import { useAuth } from '../../auth/AuthContext';
import { ordersApi } from '../services/ordersApi';
import { Pedido } from '../types';

type CxcOrderFormScreenProps = {
  orderId: number;
  onDone: (orderId: number) => void;
};

function formatHistorialDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.substring(0, 10);
  }

  return value;
}

export function CxcOrderFormScreen({ orderId, onDone }: CxcOrderFormScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [totals, setTotals] = useState({
    total_pedido: 0,
    cobranza_status: 'NO PAGADO',
  });
  const [noFacturaInput, setNoFacturaInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFactura = useMemo(() => (order?.tipo_fac_rem ?? 10) === 10, [order?.tipo_fac_rem]);
  const isAuthorizationStage = useMemo(() => (order?.status ?? 0) === 20, [order?.status]);
  const isBillingStage = useMemo(() => (order?.status ?? 0) === 45, [order?.status]);
  const documentFieldLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'No. recibo simple' : 'No. factura'),
    [order?.tipo_fac_rem],
  );
  const stageLabel = useMemo(
    () => (isAuthorizationStage ? 'AUTORIZACION' : isBillingStage ? 'FACTURACION' : 'CXC'),
    [isAuthorizationStage, isBillingStage],
  );
  const documentoGlobalAplicado = useMemo(() => {
    if (!order) {
      return 'SIN DOCUMENTO GLOBAL';
    }

    const current = (order.no_factura || '').trim();
    return current || ((order.tipo_fac_rem ?? 10) === 20 ? 'SIN RECIBO SIMPLE' : 'SIN FACTURA');
  }, [order]);
  const documentoGuardado = useMemo(() => Boolean((order?.no_factura || '').trim()), [order?.no_factura]);
  const documentInputPreview = useMemo(() => noFacturaInput.trim(), [noFacturaInput]);
  const documentActionLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'Guardar recibo simple' : 'Guardar factura'),
    [order?.tipo_fac_rem],
  );
  const finishActionLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'Terminar pedido con recibo simple' : 'Terminar pedido facturado'),
    [order?.tipo_fac_rem],
  );
  const noPedidoVisible = useMemo(() => {
    const noPedido = (order?.no_pedido || '').trim();
    if (noPedido) {
      return noPedido;
    }

    return isBillingStage ? 'Se asignará al guardar el documento final' : 'Pendiente hasta facturación';
  }, [isBillingStage, order?.no_pedido]);
  const cxcNotes = useMemo(
    () =>
      [
        {
          label: 'Condiciones',
          value: order?.cliente_condiciones || 'Sin condiciones registradas',
        },
        {
          label: 'Observaciones',
          value: order?.observaciones || 'Sin observaciones',
        },
        {
          label: 'Instrucciones para Crédito',
          value: order?.instrucciones_credito || 'Sin instrucciones para Crédito',
        },
        {
          label: 'Instrucciones para Almacén',
          value: order?.instrucciones_almacen || 'Sin instrucciones para Almacén',
        },
      ].filter((item) => item.value),
    [order?.cliente_condiciones, order?.instrucciones_almacen, order?.instrucciones_credito, order?.observaciones],
  );
  const billingChecklist = useMemo(
    () => [
      {
        label: documentFieldLabel,
        done: documentoGuardado,
        value: documentoGlobalAplicado,
      },
      {
        label: 'No. pedido visible',
        done: Boolean((order?.no_pedido || '').trim()),
        value: noPedidoVisible,
      },
      {
        label: 'Cobranza',
        done: true,
        value: totals.cobranza_status,
      },
    ],
    [documentFieldLabel, documentoGlobalAplicado, documentoGuardado, noPedidoVisible, order?.no_pedido, totals.cobranza_status],
  );

  const fetchCxcData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const detailResponse = await ordersApi.detail(token, orderId);
      const item = detailResponse.item;
      setOrder(item);
      setTotals({
        total_pedido: Number(item.total || 0),
        cobranza_status: item.ctas_cobrar_status || 'NO PAGADO',
      });

      setNoFacturaInput(item.no_factura || '');

      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible cargar la operación de CXC.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    fetchCxcData();
  }, [fetchCxcData]);

  const saveDocumentoGlobal = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    const numero = noFacturaInput.trim();
    if (!numero) {
      setErrorMessage('Debes capturar el número de documento.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.updateCxc(token, order.id, { no_factura: numero });
      Alert.alert('Documento actualizado', response.message);
      await fetchCxcData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible actualizar el documento.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const continueFlow = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const transitionTarget = isAuthorizationStage ? 'almacen' : 'terminado';
      const response = await ordersApi.transition(token, order.id, transitionTarget);
      Alert.alert(
        'Flujo actualizado',
        response.message || (isAuthorizationStage ? 'Pedido enviado a almacén.' : 'Pedido terminado correctamente.'),
      );
      onDone(order.id);
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : isAuthorizationStage
          ? 'No fue posible enviar a ALMACÉN.'
          : 'No fue posible terminar el pedido.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
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
        <Text style={styles.error}>{errorMessage || 'No hay pedido disponible para CXC.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isAuthorizationStage ? 'Autorización' : 'Facturación'}</Text>
      <Text style={styles.subtitle}>Pedido #{order.no_pedido || order.id}</Text>
      <Text style={styles.subtitle}>Cliente: {order.cliente_razon_social || '-'}</Text>
      <Text style={styles.subtitle}>Tipo: {order.tipo_fac_rem_label || '-'}</Text>

      <View style={styles.card}>
        <View style={styles.stageHeader}>
          <View style={[styles.stageBadge, isAuthorizationStage ? styles.stageBadgeAuthorization : styles.stageBadgeBilling]}>
            <Text style={[styles.stageBadgeLabel, isAuthorizationStage ? styles.stageBadgeLabelAuthorization : styles.stageBadgeLabelBilling]}>
              {stageLabel}
            </Text>
          </View>
          <Text style={styles.stageHelper}>
            {isAuthorizationStage
              ? 'CXC valida el pedido y lo libera a almacén.'
              : 'CXC registra el documento final y cierra el flujo.'}
          </Text>
        </View>

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

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>No. pedido</Text>
            <Text style={styles.summaryValue}>{noPedidoVisible}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{documentFieldLabel}</Text>
            <Text style={styles.summaryValue}>{documentoGlobalAplicado}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Cobranza</Text>
            <Text style={styles.summaryValue}>{totals.cobranza_status}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Documento listo</Text>
            <Text style={styles.summaryValue}>{documentoGuardado ? 'Sí' : 'Pendiente'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contexto del pedido</Text>
        {cxcNotes.map((item) => (
          <View key={item.label} style={styles.noteRow}>
            <Text style={styles.noteLabel}>{item.label}</Text>
            <Text style={styles.noteValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {isAuthorizationStage ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Autorización del pedido</Text>
            <Text style={styles.meta}>
              Revisa condiciones comerciales, observaciones y tipo de comprobante antes de enviarlo a almacén.
            </Text>
            <Text style={styles.hint}>
              En esta fase todavía no se registra documento final. Es una liberación operativa de CXC.
            </Text>
          </View>

          <Pressable style={styles.primaryButton} onPress={continueFlow} disabled={isBusy}>
            <Text style={styles.primaryButtonLabel}>{isBusy ? 'Procesando...' : 'Autorizar y enviar a Almacén'}</Text>
          </Pressable>
        </>
      ) : null}

      {isBillingStage ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Checklist de facturación</Text>
            {billingChecklist.map((item) => (
              <View key={item.label} style={styles.checkRow}>
                <View style={[styles.checkDot, item.done ? styles.checkDotDone : styles.checkDotPending]} />
                <View style={styles.checkContent}>
                  <Text style={styles.checkLabel}>{item.label}</Text>
                  <Text style={styles.checkValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documento final</Text>
            <Text style={styles.fieldLabel}>{documentFieldLabel}</Text>
            <TextInput
              value={noFacturaInput}
              onChangeText={setNoFacturaInput}
              style={styles.input}
              placeholder={isFactura ? 'Ingrese el número de factura' : 'Ingrese el número de recibo simple'}
            />
            <Text style={styles.hint}>
              Al guardar el documento final, el sistema sincroniza ese folio como número visible del pedido.
            </Text>
            {documentInputPreview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Vista previa de sincronización</Text>
                <Text style={styles.previewValue}>
                  No. pedido: {documentInputPreview} | {documentFieldLabel}: {documentInputPreview}
                </Text>
              </View>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={saveDocumentoGlobal} disabled={isBusy}>
              <Text style={styles.secondaryButtonLabel}>{documentActionLabel}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cobranza</Text>
            <Text style={styles.meta}>Estatus: {totals.cobranza_status}</Text>
            <View style={styles.amountsRow}>
              <View style={styles.amountItem}>
                <Text style={styles.amountLabel}>Total pedido</Text>
                <Text style={styles.amountValue}>{formatMoney(totals.total_pedido)}</Text>
              </View>
            </View>
            <Text style={styles.hint}>
              La cobranza se controla fuera de la app. En esta fase CXC solo registra el documento final y cierra el pedido cuando corresponda.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historial de surtido usado para documento</Text>
            {(order.historial_documentos || []).length === 0 ? (
              <Text style={styles.hint}>Sin registros de historial para documento.</Text>
            ) : (
              (order.historial_documentos || []).map((row) => (
                <View key={row.id_pedido_historial} style={styles.historialRow}>
                  <Text style={styles.historialMeta}>
                    Historial #{row.id_pedido_historial} | Subtotal: {formatMoney(row.subtotal_pedido)}
                  </Text>
                  <Text style={styles.historialMeta}>Fecha surtido: {formatHistorialDate(row.fecha_surtido)}</Text>
                  <Text style={styles.historialMeta}>
                    Documento aplicado: {documentoGlobalAplicado.startsWith('SIN ')
                      ? row.numero_factura || documentoGlobalAplicado
                      : documentoGlobalAplicado}
                  </Text>
                </View>
              ))
            )}
          </View>

          {!documentoGuardado ? (
            <Text style={styles.warningText}>
              Debes guardar el documento final antes de poder terminar el pedido.
            </Text>
          ) : null}

          <Pressable
            style={[styles.primaryButton, !documentoGuardado && styles.primaryButtonDisabled]}
            onPress={continueFlow}
            disabled={isBusy || !documentoGuardado}
          >
            <Text style={styles.primaryButtonLabel}>{isBusy ? 'Procesando...' : finishActionLabel}</Text>
          </Pressable>
        </>
      ) : null}

      {!isAuthorizationStage && !isBillingStage ? (
        <Text style={styles.hint}>Este pedido no está en una fase operable de CXC dentro del flujo actual.</Text>
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
  title: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 22,
    marginBottom: 8,
  },
  subtitle: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    marginBottom: 2,
  },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
  },
  cardTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 15,
    marginBottom: 8,
  },
  stageHeader: {
    marginBottom: 10,
  },
  stageBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  stageBadgeAuthorization: {
    backgroundColor: '#fff3d9',
  },
  stageBadgeBilling: {
    backgroundColor: '#def3ee',
  },
  stageBadgeLabel: {
    fontFamily: typography.bold,
    fontSize: 11,
  },
  stageBadgeLabelAuthorization: {
    color: '#9a6200',
  },
  stageBadgeLabelBilling: {
    color: palette.primaryDark,
  },
  stageHelper: {
    color: palette.text,
    fontFamily: typography.medium,
    fontSize: 13,
  },
  meta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    marginBottom: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCell: {
    width: '48%',
    borderRadius: 10,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e7eef5',
    padding: 10,
  },
  summaryLabel: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 11,
    marginBottom: 2,
  },
  summaryValue: {
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  noteRow: {
    borderTopWidth: 1,
    borderTopColor: '#ecf1f6',
    paddingTop: 8,
    marginTop: 8,
  },
  noteLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
    marginBottom: 2,
  },
  noteValue: {
    color: palette.text,
    fontFamily: typography.regular,
    fontSize: 13,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  checkDotDone: {
    backgroundColor: palette.primary,
  },
  checkDotPending: {
    backgroundColor: '#d9c07a',
  },
  checkContent: {
    flex: 1,
  },
  checkLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
    marginBottom: 2,
  },
  checkValue: {
    color: palette.text,
    fontFamily: typography.regular,
    fontSize: 13,
  },
  fieldLabel: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 12,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontFamily: typography.regular,
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  previewCard: {
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 10,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e7eef5',
    padding: 10,
  },
  previewLabel: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 11,
    marginBottom: 2,
  },
  previewValue: {
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  hint: {
    marginTop: 8,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
  amountsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  amountItem: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9efea',
    backgroundColor: '#f4fbf9',
    padding: 8,
  },
  amountLabel: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
  },
  amountValue: {
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    fontSize: 14,
    marginTop: 2,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#a8c8c0',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: palette.navy,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  paymentRow: {
    borderTopWidth: 1,
    borderTopColor: '#ecf1f6',
    paddingTop: 8,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  paymentMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#f35d74',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  historialRow: {
    borderTopWidth: 1,
    borderTopColor: '#ecf1f6',
    paddingTop: 8,
    marginTop: 8,
  },
  historialMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    marginBottom: 4,
  },
  error: {
    marginTop: 12,
    color: palette.danger,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  warningText: {
    marginTop: 12,
    color: '#9a6200',
    fontFamily: typography.medium,
    fontSize: 12,
  },
});

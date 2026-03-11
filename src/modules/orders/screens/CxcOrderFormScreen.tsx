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
import { formatMoney, getTodayYmd } from '../../../shared/utils/formatters';
import { useAuth } from '../../auth/AuthContext';
import { ordersApi } from '../services/ordersApi';
import { Pedido, PedidoHistorialDocumento, PedidoPagoItem } from '../types';

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

function formatMontoInput(value: string) {
  return value.replace(',', '.').replace(/[^0-9.]/g, '');
}

export function CxcOrderFormScreen({ orderId, onDone }: CxcOrderFormScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [pagos, setPagos] = useState<PedidoPagoItem[]>([]);
  const [totals, setTotals] = useState({
    total_pedido: 0,
    total_pagado: 0,
    saldo: 0,
    cobranza_status: 'NO PAGADO',
  });
  const [noFacturaInput, setNoFacturaInput] = useState('');
  const [documentoByHistorial, setDocumentoByHistorial] = useState<Record<number, string>>({});
  const [montoPago, setMontoPago] = useState('');
  const [fechaPago, setFechaPago] = useState(getTodayYmd());
  const [referenciaPago, setReferenciaPago] = useState('');
  const [notasPago, setNotasPago] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFactura = useMemo(() => (order?.tipo_fac_rem ?? 10) === 10, [order?.tipo_fac_rem]);
  const canOperateCxc = useMemo(() => (order?.status ?? 0) === 20, [order?.status]);

  const applyClampMonto = useCallback(
    (raw: string) => {
      const parsed = Number(raw || 0);
      const saldoActual = Number(totals.saldo || 0);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return '';
      }

      const clamped = saldoActual > 0 ? Math.min(parsed, saldoActual) : 0;
      return clamped > 0 ? clamped.toFixed(2) : '';
    },
    [totals.saldo],
  );

  const fetchCxcData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const [detailResponse, pagosResponse] = await Promise.all([
        ordersApi.detail(token, orderId),
        ordersApi.pagos(token, orderId),
      ]);

      const item = detailResponse.item;
      setOrder(item);
      setPagos(pagosResponse.items || []);
      setTotals({
        total_pedido: pagosResponse.totals.total_pedido,
        total_pagado: pagosResponse.totals.total_pagado,
        saldo: pagosResponse.totals.saldo,
        cobranza_status: pagosResponse.cobranza_status || item.ctas_cobrar_status || 'NO PAGADO',
      });

      if ((item.tipo_fac_rem || 10) === 20) {
        setNoFacturaInput('RECIBO SIMPLE');
      } else {
        setNoFacturaInput(item.no_factura || '');
      }

      const documentInputs: Record<number, string> = {};
      (item.historial_documentos || []).forEach((row) => {
        documentInputs[row.id_pedido_historial] = row.numero_factura || '';
      });
      setDocumentoByHistorial(documentInputs);

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

    const numero = isFactura ? noFacturaInput.trim() : 'RECIBO SIMPLE';
    if (isFactura && !numero) {
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

  const registerPago = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    const montoNormalizado = applyClampMonto(montoPago);
    if (!montoNormalizado) {
      setErrorMessage('Debes capturar un monto válido mayor a 0.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago.trim())) {
      setErrorMessage('La fecha de pago debe estar en formato YYYY-MM-DD.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.registrarPago(token, order.id, {
        monto: Number(montoNormalizado),
        fecha_pago: fechaPago.trim(),
        referencia: referenciaPago.trim() || undefined,
        notas: notasPago.trim() || undefined,
      });

      Alert.alert('Pago registrado', response.message);
      setMontoPago('');
      setReferenciaPago('');
      setNotasPago('');
      await fetchCxcData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible registrar el pago.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const deletePago = (pago: PedidoPagoItem) => {
    if (!token || !order || isBusy) {
      return;
    }

    Alert.alert(
      'Eliminar pago',
      `¿Eliminar el pago de ${formatMoney(pago.monto)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            setErrorMessage(null);
            try {
              const response = await ordersApi.deletePago(token, order.id, pago.id);
              Alert.alert('Pago eliminado', response.message);
              await fetchCxcData();
            } catch (error) {
              const message =
                error instanceof ApiError ? error.message : 'No fue posible eliminar el pago.';
              setErrorMessage(message);
            } finally {
              setIsBusy(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const registrarDocumentoHistorial = async (row: PedidoHistorialDocumento) => {
    if (!token || !order || isBusy) {
      return;
    }

    const raw = documentoByHistorial[row.id_pedido_historial] || '';
    const numero = isFactura ? raw.trim() : 'RECIBO SIMPLE';
    if (isFactura && !numero) {
      setErrorMessage(`Debes capturar documento para historial #${row.id_pedido_historial}.`);
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.registrarDocumento(token, order.id, {
        id_pedido_historial: row.id_pedido_historial,
        numero_factura: numero,
      });
      Alert.alert('Documento registrado', response.message);
      await fetchCxcData();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'No fue posible registrar documento de historial.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const sendToAlmacenFinal = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.transition(token, order.id, 'almacen_final');
      Alert.alert('Flujo actualizado', response.message || 'Pedido enviado a almacén final.');
      onDone(order.id);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'No fue posible enviar a ALMACÉN final.';
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
      <Text style={styles.title}>Ctas x Cobrar</Text>
      <Text style={styles.subtitle}>Pedido #{order.no_pedido || order.id}</Text>
      <Text style={styles.subtitle}>Cliente: {order.cliente_razon_social || '-'}</Text>
      <Text style={styles.subtitle}>Tipo: {order.tipo_fac_rem_label || '-'}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Documento global</Text>
        <TextInput
          value={noFacturaInput}
          onChangeText={setNoFacturaInput}
          style={styles.input}
          editable={isFactura}
          placeholder={isFactura ? 'Ingrese el número de documento' : 'RECIBO SIMPLE'}
        />
        {!isFactura ? <Text style={styles.hint}>Para recibo simple se aplica automáticamente.</Text> : null}
        <Pressable style={styles.secondaryButton} onPress={saveDocumentoGlobal} disabled={!canOperateCxc || isBusy}>
          <Text style={styles.secondaryButtonLabel}>Guardar documento</Text>
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
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Total pagado</Text>
            <Text style={styles.amountValue}>{formatMoney(totals.total_pagado)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Saldo</Text>
            <Text style={styles.amountValue}>{formatMoney(totals.saldo)}</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Monto pago</Text>
        <TextInput
          value={montoPago}
          onChangeText={(text) => setMontoPago(formatMontoInput(text))}
          onBlur={() => setMontoPago((prev) => applyClampMonto(prev))}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholder="0.00"
        />

        <Text style={styles.fieldLabel}>Fecha pago (YYYY-MM-DD)</Text>
        <TextInput
          value={fechaPago}
          onChangeText={setFechaPago}
          style={styles.input}
          placeholder={getTodayYmd()}
        />

        <Text style={styles.fieldLabel}>Referencia</Text>
        <TextInput
          value={referenciaPago}
          onChangeText={setReferenciaPago}
          style={styles.input}
          placeholder="Referencia"
        />

        <Text style={styles.fieldLabel}>Notas</Text>
        <TextInput
          value={notasPago}
          onChangeText={setNotasPago}
          style={[styles.input, styles.textarea]}
          placeholder="Notas"
          multiline
        />

        <Pressable style={styles.primaryButton} onPress={registerPago} disabled={!canOperateCxc || isBusy}>
          <Text style={styles.primaryButtonLabel}>Registrar pago</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pagos registrados</Text>
        {pagos.length === 0 ? (
          <Text style={styles.hint}>Sin pagos registrados.</Text>
        ) : (
          pagos.map((pago) => (
            <View key={pago.id} style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentAmount}>{formatMoney(pago.monto)}</Text>
                <Text style={styles.paymentMeta}>{pago.fecha_pago}</Text>
                <Text style={styles.paymentMeta}>{pago.referencia || 'Sin referencia'}</Text>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => deletePago(pago)}
                disabled={!canOperateCxc || isBusy}
              >
                <Text style={styles.deleteButtonLabel}>Eliminar</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Documento por surtido</Text>
        {(order.historial_documentos || []).length === 0 ? (
          <Text style={styles.hint}>Sin registros de historial para documento.</Text>
        ) : (
          (order.historial_documentos || []).map((row) => (
            <View key={row.id_pedido_historial} style={styles.historialRow}>
              <Text style={styles.historialMeta}>
                Historial #{row.id_pedido_historial} | Subtotal: {formatMoney(row.subtotal_pedido)}
              </Text>
              <Text style={styles.historialMeta}>Fecha surtido: {formatHistorialDate(row.fecha_surtido)}</Text>
              <TextInput
                value={isFactura ? documentoByHistorial[row.id_pedido_historial] || '' : 'RECIBO SIMPLE'}
                onChangeText={(text) =>
                  setDocumentoByHistorial((prev) => ({
                    ...prev,
                    [row.id_pedido_historial]: text,
                  }))
                }
                editable={isFactura}
                style={styles.input}
                placeholder={isFactura ? 'Número de documento' : 'RECIBO SIMPLE'}
              />
              <Pressable
                style={styles.secondaryButton}
                onPress={() => registrarDocumentoHistorial(row)}
                disabled={!canOperateCxc || isBusy}
              >
                <Text style={styles.secondaryButtonLabel}>Registrar documento</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.primaryButton} onPress={sendToAlmacenFinal} disabled={!canOperateCxc || isBusy}>
        <Text style={styles.primaryButtonLabel}>Enviar a Almacén final</Text>
      </Pressable>

      {!canOperateCxc ? (
        <Text style={styles.hint}>Este pedido ya no está en CTAS X COBRAR, por eso no admite captura CXC.</Text>
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
  meta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    marginBottom: 8,
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
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { EvidenceSection } from '../components/EvidenceSection';
import { ordersApi } from '../services/ordersApi';
import { Pedido, PedidoEvidenciaItem } from '../types';
import { downloadEvidence, previewEvidence } from '../utils/evidence';

type CxcOrderFormScreenProps = {
  orderId: number;
  onDone: (orderId: number) => void;
};

function formatHistorialDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const plainValue = value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!plainValue) {
    return '-';
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(plainValue)) {
    return plainValue.substring(0, 10);
  }

  return plainValue;
}

export function CxcOrderFormScreen({ orderId, onDone }: CxcOrderFormScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [noPedidoInput, setNoPedidoInput] = useState('');
  const [noFacturaInput, setNoFacturaInput] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmInput, setCancelConfirmInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFactura = useMemo(() => (order?.tipo_fac_rem ?? 10) === 10, [order?.tipo_fac_rem]);
  const isAuthorizationStage = useMemo(() => (order?.status ?? 0) === 20, [order?.status]);
  const isBillingStage = useMemo(() => (order?.status ?? 0) === 45, [order?.status]);
  const isFinishedStage = useMemo(() => (order?.status ?? 0) === 50, [order?.status]);
  const documentFieldLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'No. remisión' : 'No. factura'),
    [order?.tipo_fac_rem],
  );
  const stageLabel = useMemo(
    () => (isAuthorizationStage ? 'AUTORIZACION' : isBillingStage ? 'FACTURACION' : isFinishedStage ? 'TERMINADO' : 'CXC'),
    [isAuthorizationStage, isBillingStage, isFinishedStage],
  );
  const documentoGlobalAplicado = useMemo(() => {
    if (!order) {
      return 'SIN DOCUMENTO GLOBAL';
    }

    const current = (order.no_factura || '').trim();
    return current || ((order.tipo_fac_rem ?? 10) === 20 ? 'SIN REMISIÓN' : 'SIN FACTURA');
  }, [order]);
  const documentoGuardado = useMemo(() => Boolean((order?.no_factura || '').trim()), [order?.no_factura]);
  const documentInputPreview = useMemo(() => noFacturaInput.trim(), [noFacturaInput]);
  const documentActionLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'Guardar remisión' : 'Guardar factura'),
    [order?.tipo_fac_rem],
  );
  const ventaEspecialAplicada = useMemo(() => Boolean(order?.venta_especial), [order?.venta_especial]);
  const finishActionLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'Terminar pedido con remisión' : 'Terminar pedido facturado'),
    [order?.tipo_fac_rem],
  );
  const documentoCancelado = useMemo(() => Boolean(order?.documento_cancelado), [order?.documento_cancelado]);
  const canCancelFinalDocument = useMemo(
    () => isFinishedStage && documentoGuardado && !documentoCancelado,
    [documentoCancelado, documentoGuardado, isFinishedStage],
  );
  const isPostfechado = useMemo(() => Boolean(order?.postfechado), [order?.postfechado]);
  const fechaEntregaVisible = useMemo(() => (order?.fecha_entrega || '').trim() || '-', [order?.fecha_entrega]);
  const noPedidoGuardado = useMemo(() => Boolean((order?.no_pedido || '').trim()), [order?.no_pedido]);
  const noPedidoVisible = useMemo(() => {
    const noPedido = (order?.no_pedido || '').trim();
    if (noPedido) {
      return noPedido;
    }

    return isAuthorizationStage ? 'Pendiente de asignación en autorización' : 'Sin número de pedido';
  }, [isAuthorizationStage, order?.no_pedido]);
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
    ],
    [documentFieldLabel, documentoGlobalAplicado, documentoGuardado, noPedidoVisible, order?.no_pedido],
  );
  const canViewEvidence = useMemo(
    () => Boolean(order?.can_view_evidence ?? order?.can_upload_evidence ?? false),
    [order?.can_upload_evidence, order?.can_view_evidence],
  );
  const canManageEvidence = useMemo(
    () => false,
    [],
  );
  const existingEvidence = useMemo<PedidoEvidenciaItem[]>(
    () => (canViewEvidence ? order?.evidencias || [] : []),
    [canViewEvidence, order?.evidencias],
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
      setNoPedidoInput(item.no_pedido || '');
      setNoFacturaInput(item.no_factura || '');
      setCancelConfirmInput('');
      setCancelReason('');

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
      const response = await ordersApi.updateCxc(token, order.id, {
        no_factura: numero,
      });
      Alert.alert('Documento actualizado', response.message);
      await fetchCxcData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible actualizar el documento.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const saveNoPedido = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    const numero = noPedidoInput.trim();
    if (!numero) {
      setErrorMessage('Debes capturar el número de pedido.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.updateCxc(token, order.id, {
        no_pedido: numero,
      });
      Alert.alert('Número de pedido actualizado', response.message);
      await fetchCxcData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible actualizar el número de pedido.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const toggleVentaEspecial = async (aplicar: boolean) => {
    if (!token || !order || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.updateCxc(token, order.id, {
        venta_especial: aplicar ? 1 : 0,
      });
      Alert.alert(
        aplicar ? 'Precio especial aplicado' : 'Precio especial retirado',
        response.message,
      );
      await fetchCxcData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible actualizar el precio especial.';
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
      const successMessage = !isAuthorizationStage && response.inventory_affected
        ? `${response.message || 'Pedido terminado correctamente.'}\n\nInventario afectado: ${response.inventory_affected.productos_afectados} producto(s), ${response.inventory_affected.cantidad_total.toFixed(2)} unidades totales.`
        : (response.message || (isAuthorizationStage ? 'Pedido enviado a almacén.' : 'Pedido terminado correctamente.'));
      Alert.alert(
        'Flujo actualizado',
        successMessage,
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

  const cancelFinalDocument = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    const reason = cancelReason.trim();
    const confirmation = cancelConfirmInput.trim();
    const currentDocument = (order.no_factura || '').trim();

    if (reason.length < 10) {
      setErrorMessage('Debes capturar un motivo de cancelación con al menos 10 caracteres.');
      return;
    }

    if (!currentDocument) {
      setErrorMessage('El pedido no tiene documento final registrado para cancelar.');
      return;
    }

    if (confirmation !== currentDocument) {
      setErrorMessage('La confirmación no coincide con el documento final actual.');
      return;
    }

    const performCancellation = async () => {
      setIsBusy(true);
      setErrorMessage(null);
      try {
        const response = await ordersApi.cancelarDocumento(token, order.id, {
          motivo_cancelacion_documento: reason,
          confirmacion_documento: confirmation,
        });
        const successMessage = response.inventory_reverted
          ? `${response.message}\n\nInventario revertido: ${response.inventory_reverted.productos_afectados} producto(s), ${response.inventory_reverted.cantidad_total.toFixed(2)} unidades totales.`
          : response.message;
        Alert.alert('Documento cancelado', successMessage);
        await fetchCxcData();
        onDone(order.id);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'No fue posible cancelar el documento final.';
        setErrorMessage(message);
      } finally {
        setIsBusy(false);
      }
    };

    const confirmationMessage = `Se cancelará el documento ${currentDocument}.\n\nEsta acción revertirá inventario y el flujo permanecerá en TERMINADO.`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const accepted = window.confirm(confirmationMessage);
      if (!accepted) {
        return;
      }
      await performCancellation();
      return;
    }

    Alert.alert(
      'Confirmar cancelación',
      confirmationMessage,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar documento',
          style: 'destructive',
          onPress: performCancellation,
        },
      ],
    );
  };

  const previewOrderEvidence = useCallback(
    async (evidence: PedidoEvidenciaItem) => {
      if (!token || !order) {
        return;
      }

      try {
        await previewEvidence(token, order.id, evidence);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible abrir la evidencia.';
        Alert.alert('Error', message);
      }
    },
    [order, token],
  );

  const downloadOrderEvidence = useCallback(
    async (evidence: PedidoEvidenciaItem) => {
      if (!token || !order) {
        return;
      }

      try {
        await downloadEvidence(token, order.id, evidence);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible descargar la evidencia.';
        Alert.alert('Error', message);
      }
    },
    [order, token],
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
        <Text style={styles.error}>{errorMessage || 'No hay pedido disponible para CXC.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isAuthorizationStage ? 'Autorización' : isBillingStage ? 'Facturación' : isFinishedStage ? 'Terminado / Cancelación' : 'CXC'}</Text>
      <Text style={styles.subtitle}>Pedido #{order.no_pedido || order.id}</Text>
      <Text style={styles.subtitle}>Cliente: {order.cliente_razon_social || '-'}</Text>
      <Text style={styles.subtitle}>Tipo: {order.tipo_fac_rem_label || '-'}</Text>

      <View style={styles.card}>
        <View style={styles.stageHeader}>
          <View style={styles.stageBadgesRow}>
            <View style={[styles.stageBadge, isAuthorizationStage ? styles.stageBadgeAuthorization : styles.stageBadgeBilling]}>
              <Text style={[styles.stageBadgeLabel, isAuthorizationStage ? styles.stageBadgeLabelAuthorization : styles.stageBadgeLabelBilling]}>
                {stageLabel}
              </Text>
            </View>
            {isPostfechado ? (
              <View style={[styles.stageBadge, styles.stageBadgePostdated]}>
                <Text style={[styles.stageBadgeLabel, styles.stageBadgeLabelPostdated]}>POSTFECHADO</Text>
              </View>
            ) : null}
          </View>
          {isPostfechado ? (
            <View style={styles.postdatedContextCard}>
              <Text style={styles.postdatedContextTitle}>Fecha de entrega</Text>
              <Text style={styles.postdatedContextValue}>{fechaEntregaVisible}</Text>
              <Text style={styles.postdatedContextNote}>
                Este pedido conserva su condición de postfechado y CXC debe tener visible esta fecha durante la operación.
              </Text>
            </View>
          ) : null}
          <Text style={styles.stageHelper}>
            {isAuthorizationStage
              ? 'CXC valida el pedido y lo libera a almacén.'
              : isBillingStage
                ? 'CXC registra el documento final y cierra el flujo.'
                : isFinishedStage
                  ? 'CXC puede revisar el cierre y, si aplica, cancelar el documento final con trazabilidad.'
                  : 'Operación actual de CXC.'}
          </Text>
          {isPostfechado ? (
            <Text style={styles.postdatedHint}>
              Pedido postfechado con entrega programada para {fechaEntregaVisible}.
            </Text>
          ) : null}
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
            <Text style={styles.summaryLabel}>Documento listo</Text>
            <Text style={styles.summaryValue}>{documentoGuardado ? 'Sí' : 'Pendiente'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contexto del pedido</Text>
        <View style={styles.noteRow}>
          <Text style={styles.noteLabel}>Precio especial</Text>
          <Text style={styles.noteValue}>
            {ventaEspecialAplicada ? 'Sí (precio promedio + 3%)' : 'No aplicado'}
          </Text>
        </View>
        {isPostfechado ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Postfechado</Text>
            <Text style={styles.noteValue}>Sí</Text>
          </View>
        ) : null}
        {isPostfechado ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Fecha de entrega</Text>
            <Text style={styles.noteValue}>{fechaEntregaVisible}</Text>
          </View>
        ) : null}
        {cxcNotes.map((item) => (
          <View key={item.label} style={styles.noteRow}>
            <Text style={styles.noteLabel}>{item.label}</Text>
            <Text style={styles.noteValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <EvidenceSection
        title="EVIDENCIA"
        canView={canViewEvidence}
        canManage={canManageEvidence}
        evidences={existingEvidence}
        uploading={isBusy}
        onPreviewEvidence={previewOrderEvidence}
        onDownloadEvidence={downloadOrderEvidence}
      />

      {isAuthorizationStage ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Autorización del pedido</Text>
            <Text style={styles.meta}>
              Revisa condiciones comerciales, observaciones y tipo global antes de enviarlo a almacén.
            </Text>
            <Text style={styles.hint}>
              En esta fase CXC asigna el número de pedido y libera operativamente el pedido a almacén.
            </Text>
            <Text style={styles.fieldLabel}>No. pedido</Text>
            <TextInput
              value={noPedidoInput}
              onChangeText={setNoPedidoInput}
              style={styles.input}
              placeholder="Captura el número de pedido"
            />
            <Pressable style={styles.secondaryButton} onPress={saveNoPedido} disabled={isBusy}>
              <Text style={styles.secondaryButtonLabel}>Guardar número de pedido</Text>
            </Pressable>
          </View>

          {!noPedidoGuardado ? (
            <Text style={styles.warningText}>
              Debes guardar el número de pedido antes de autorizar y enviar a almacén.
            </Text>
          ) : null}

          <Pressable style={[styles.primaryButton, !noPedidoGuardado && styles.primaryButtonDisabled]} onPress={continueFlow} disabled={isBusy || !noPedidoGuardado}>
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
              placeholder={isFactura ? 'Ingrese el número de factura' : 'Ingrese el número de remisión'}
            />
            <Text style={styles.hint}>
              En esta fase CXC solo captura el documento final. El número de pedido ya debió quedar asignado en autorización.
            </Text>
            {documentInputPreview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Vista previa del documento final</Text>
                <Text style={styles.previewValue}>
                  No. pedido: {noPedidoVisible} | {documentFieldLabel}: {documentInputPreview}
                </Text>
              </View>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={saveDocumentoGlobal} disabled={isBusy}>
              <Text style={styles.secondaryButtonLabel}>{documentActionLabel}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Precio especial</Text>
            <Text style={styles.hint}>
              CXC puede aplicar o retirar precio especial en FACTURACION usando la regla precio promedio + 3%.
            </Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Estado actual</Text>
                <Text style={styles.summaryValue}>
                  {ventaEspecialAplicada ? 'Aplicado' : 'No aplicado'}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Regla</Text>
                <Text style={styles.summaryValue}>Precio promedio + 3%</Text>
              </View>
            </View>
            <Pressable
              style={[styles.secondaryButton, ventaEspecialAplicada ? styles.destructiveButton : styles.infoButton]}
              onPress={() => toggleVentaEspecial(!ventaEspecialAplicada)}
              disabled={isBusy}
            >
              <Text style={styles.primaryButtonLabel}>
                {isBusy
                  ? 'Procesando...'
                  : ventaEspecialAplicada
                    ? 'Quitar precio especial'
                    : 'Aplicar precio especial'}
              </Text>
            </Pressable>
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

      {isFinishedStage ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documento final terminado</Text>
            <Text style={styles.meta}>
              El pedido ya cerró el flujo y el inventario ya fue afectado. La cancelación del documento no reabre el pedido.
            </Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Documento final</Text>
                <Text style={styles.summaryValue}>{documentoGlobalAplicado}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Documento cancelado</Text>
                <Text style={[styles.summaryValue, documentoCancelado && styles.dangerText]}>
                  {documentoCancelado ? 'Sí' : 'No'}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Cancelado por</Text>
                <Text style={styles.summaryValue}>{order.documento_cancelado_by_username || '-'}</Text>
              </View>
            </View>
            {documentoCancelado ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Motivo de cancelación</Text>
                <Text style={styles.previewValue}>{order.motivo_cancelacion_documento || 'Sin motivo registrado'}</Text>
              </View>
            ) : null}
          </View>

          {canCancelFinalDocument ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cancelar documento final</Text>
              <Text style={styles.hint}>
                Confirma el número exacto del documento y captura el motivo. El inventario se revertirá y el pedido permanecerá en TERMINADO.
              </Text>
              <Text style={styles.fieldLabel}>Confirmar {documentFieldLabel}</Text>
              <TextInput
                value={cancelConfirmInput}
                onChangeText={setCancelConfirmInput}
                style={styles.input}
                placeholder={documentFieldLabel}
                autoCapitalize="characters"
              />
              <Text style={styles.fieldLabel}>Motivo de cancelación</Text>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                style={[styles.input, styles.textarea]}
                placeholder="Explica por qué se cancela el documento final"
                multiline
                textAlignVertical="top"
              />
              <Pressable style={styles.destructiveButton} onPress={cancelFinalDocument} disabled={isBusy}>
                <Text style={styles.primaryButtonLabel}>{isBusy ? 'Procesando...' : 'Cancelar documento final'}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {!isAuthorizationStage && !isBillingStage && !isFinishedStage ? (
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
  stageBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  stageBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stageBadgeAuthorization: {
    backgroundColor: '#fff3d9',
  },
  stageBadgeBilling: {
    backgroundColor: '#def3ee',
  },
  stageBadgePostdated: {
    backgroundColor: '#fff3d9',
    borderWidth: 1,
    borderColor: '#f3d08f',
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
  stageBadgeLabelPostdated: {
    color: '#9a6200',
  },
  postdatedContextCard: {
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#fff9ef',
    borderWidth: 1,
    borderColor: '#f3d08f',
    padding: 10,
  },
  postdatedContextTitle: {
    color: '#9a6200',
    fontFamily: typography.semiBold,
    fontSize: 12,
    marginBottom: 2,
  },
  postdatedContextValue: {
    color: palette.text,
    fontFamily: typography.bold,
    fontSize: 14,
  },
  postdatedContextNote: {
    marginTop: 6,
    color: '#7a5b2b',
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  stageHelper: {
    color: palette.text,
    fontFamily: typography.medium,
    fontSize: 13,
  },
  postdatedHint: {
    marginTop: 6,
    color: '#9a6200',
    fontFamily: typography.medium,
    fontSize: 12,
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
  dangerText: {
    color: '#b42318',
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
  destructiveButton: {
    marginTop: 10,
    backgroundColor: '#b42318',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  infoButton: {
    marginTop: 10,
    backgroundColor: '#0f7a8a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
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

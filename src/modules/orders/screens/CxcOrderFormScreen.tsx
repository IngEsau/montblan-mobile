import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { Pedido, PedidoDetalleLinea, PedidoEvidenciaItem, PedidoMlAssignableSeller } from '../types';
import { downloadEvidence, previewEvidence } from '../utils/evidence';
import { resolveOrderStageLabel } from '../utils/status';

const SERVICIO_ML_CLIENT_CODE = '9009';
const SERVICIO_ML_CLIENT_NAME = 'SERVICIO ML';

type CxcOrderFormScreenProps = {
  orderId: number;
  onDone: (orderId: number) => void;
  onOpenDerivedOrder?: (orderId: number) => void;
};

type MlAdjustmentLineDraft = {
  id: number;
  codigo: string;
  descripcion: string;
  cantidadInput: string;
  surtidoInput: string;
  rolloInput: string;
};

type MlSplitLineDraft = {
  id: number;
  codigo: string;
  descripcion: string;
  cantidadOriginal: number;
  cantidadDerivarInput: string;
  precioInput: string;
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

function buildMlAdjustmentLine(line: PedidoDetalleLinea): MlAdjustmentLineDraft {
  return {
    id: line.id,
    codigo: line.codigo || '-',
    descripcion: line.descripcion || 'Sin descripción',
    cantidadInput: String(line.cantidad ?? 0),
    surtidoInput: normalizeWholeNumberValue(line.surtido),
    rolloInput: normalizeWholeNumberValue(line.rollo),
  };
}

function buildMlSplitLine(line: PedidoDetalleLinea): MlSplitLineDraft {
  const precioBase = line.precio_base ?? line.precio ?? 0;
  return {
    id: line.id,
    codigo: line.codigo || '-',
    descripcion: line.descripcion || 'Sin descripción',
    cantidadOriginal: Number(line.cantidad ?? 0),
    cantidadDerivarInput: '',
    precioInput: Number(precioBase).toFixed(2),
  };
}

function normalizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, '');
}

function isDigitsOnly(value: string) {
  return /^\d+$/.test(value);
}

function normalizeWholeNumberValue(value: number | null | undefined) {
  if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) {
    return '0';
  }

  return String(Math.max(0, Math.round(Number(value))));
}

function normalizeRole(role: string | null | undefined) {
  return String(role ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

export function CxcOrderFormScreen({ orderId, onDone, onOpenDerivedOrder }: CxcOrderFormScreenProps) {
  const { token, user } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [mlAdjustmentLines, setMlAdjustmentLines] = useState<MlAdjustmentLineDraft[]>([]);
  const [mlSplitLines, setMlSplitLines] = useState<MlSplitLineDraft[]>([]);
  const [noPedidoInput, setNoPedidoInput] = useState('');
  const [noFacturaInput, setNoFacturaInput] = useState('');
  const [splitNoClienteInput, setSplitNoClienteInput] = useState('');
  const [splitRazonSocialInput, setSplitRazonSocialInput] = useState('');
  const [splitSellerId, setSplitSellerId] = useState<number | null>(null);
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmInput, setCancelConfirmInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [specialPriceError, setSpecialPriceError] = useState<string | null>(null);
  const lastAutofilledSplitClientRef = useRef('');

  const normalizedRole = useMemo(() => normalizeRole(user?.rol), [user?.rol]);
  const roleCanCxc = useMemo(
    () =>
      normalizedRole.includes('CTAS') ||
      normalizedRole.includes('COBRAR') ||
      normalizedRole.includes('CXC') ||
      normalizedRole.includes('THECREATOR') ||
      normalizedRole.includes('ADMIN') ||
      normalizedRole.includes('SUPER'),
    [normalizedRole],
  );
  const isFactura = useMemo(() => (order?.tipo_fac_rem ?? 10) === 10, [order?.tipo_fac_rem]);
  const isAuthorizationStage = useMemo(() => (order?.status ?? 0) === 20, [order?.status]);
  const isBillingStage = useMemo(() => (order?.status ?? 0) === 45, [order?.status]);
  const isFinishedStage = useMemo(() => (order?.status ?? 0) === 50, [order?.status]);
  const canEditMlFacturacion = useMemo(
    () =>
      Boolean(
        isBillingStage &&
          (order?.es_ml_salida ?? (order?.es_mercado_libre && !order?.es_ml_facturacion)) &&
          ((order?.can_edit_ml_facturacion ?? false) ||
            (user?.permissions?.can_edit_ml_facturacion ?? false) ||
            (user?.permissions?.can_cxc ?? false) ||
            roleCanCxc),
      ),
    [
      isBillingStage,
      order?.can_edit_ml_facturacion,
      order?.es_mercado_libre,
      order?.es_ml_facturacion,
      order?.es_ml_salida,
      roleCanCxc,
      user?.permissions?.can_cxc,
      user?.permissions?.can_edit_ml_facturacion,
    ],
  );
  const documentFieldLabel = useMemo(
    () => ((order?.tipo_fac_rem ?? 10) === 20 ? 'No. remisión' : 'No. factura'),
    [order?.tipo_fac_rem],
  );
  const stageLabel = useMemo(
    () => {
      if (isAuthorizationStage || isBillingStage || isFinishedStage) {
        return resolveOrderStageLabel(order?.status);
      }
      return 'CXC';
    },
    [isAuthorizationStage, isBillingStage, isFinishedStage, order?.status],
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
  const canApplySpecialPrice = useMemo(() => Boolean(order?.cliente_temporal), [order?.cliente_temporal]);
  const shouldShowSpecialPriceSection = useMemo(
    () => canApplySpecialPrice || ventaEspecialAplicada,
    [canApplySpecialPrice, ventaEspecialAplicada],
  );
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
  const isMercadoLibre = useMemo(() => Boolean(order?.es_mercado_libre), [order?.es_mercado_libre]);
  const isMercadoLibreSalida = useMemo(
    () => Boolean(order?.es_ml_salida ?? (order?.es_mercado_libre && !order?.es_ml_facturacion)),
    [order?.es_mercado_libre, order?.es_ml_facturacion, order?.es_ml_salida],
  );
  const isMercadoLibreFacturacion = useMemo(
    () => Boolean(order?.es_ml_facturacion),
    [order?.es_ml_facturacion],
  );
  const isMercadoLibreDerived = useMemo(() => Boolean(order?.origen_ml), [order?.origen_ml]);
  const mlInventarioAfectado = useMemo(
    () => Boolean(order?.ml_inventario_afectado),
    [order?.ml_inventario_afectado],
  );
  const inventarioPreafectado = useMemo(
    () => Boolean(order?.inventario_preafectado),
    [order?.inventario_preafectado],
  );
  const mlPendienteFacturacion = useMemo(
    () => Boolean(order?.ml_pendiente_facturacion),
    [order?.ml_pendiente_facturacion],
  );
  const mlOrigenPedidoId = useMemo(() => order?.ml_origen_pedido_id ?? null, [order?.ml_origen_pedido_id]);
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
  const warehouseTotalFaltante = useMemo(() => {
    if (typeof order?.warehouse_total_faltante === 'number') {
      return Number(order.warehouse_total_faltante);
    }

    return (order?.detalle || []).reduce((acc, line) => acc + Number(line.faltante || 0), 0);
  }, [order?.detalle, order?.warehouse_total_faltante]);
  const warehouseFullySupplied = useMemo(() => {
    if (typeof order?.warehouse_fully_supplied === 'boolean') {
      return order.warehouse_fully_supplied;
    }

    return warehouseTotalFaltante <= 0 && (order?.detalle || []).length > 0;
  }, [order?.detalle, order?.warehouse_fully_supplied, warehouseTotalFaltante]);
  const originalSubtotal = useMemo(
    () => Number(order?.subtotal_captura_signed ?? order?.subtotal_captura ?? order?.subtotal_signed ?? order?.subtotal ?? 0),
    [order?.subtotal, order?.subtotal_captura, order?.subtotal_captura_signed, order?.subtotal_signed],
  );
  const originalIva = useMemo(
    () => Number(order?.iva_captura_signed ?? order?.iva_captura ?? order?.iva_signed ?? order?.iva ?? 0),
    [order?.iva, order?.iva_captura, order?.iva_captura_signed, order?.iva_signed],
  );
  const originalTotal = useMemo(
    () => Number(order?.total_captura_signed ?? order?.total_captura ?? order?.total_signed ?? order?.total ?? 0),
    [order?.total, order?.total_captura, order?.total_captura_signed, order?.total_signed],
  );
  const finalSubtotal = useMemo(
    () => Number(order?.subtotal_signed ?? order?.subtotal ?? originalSubtotal),
    [order?.subtotal, order?.subtotal_signed, originalSubtotal],
  );
  const finalIva = useMemo(
    () => Number(order?.iva_signed ?? order?.iva ?? originalIva),
    [order?.iva, order?.iva_signed, originalIva],
  );
  const finalTotal = useMemo(
    () => Number(order?.total_signed ?? order?.total ?? originalTotal),
    [order?.total, order?.total_signed, originalTotal],
  );
  const canCompareSpecialAmounts = useMemo(() => {
    if (!order) {
      return false;
    }

    const hasAmountDelta = Math.abs(Number(order.total_captura || 0) - Number(order.total || 0)) > 0.0001
      || Math.abs(Number(order.subtotal_captura || 0) - Number(order.subtotal || 0)) > 0.0001
      || Math.abs(Number(order.iva_captura || 0) - Number(order.iva || 0)) > 0.0001;

    return ventaEspecialAplicada || hasAmountDelta;
  }, [order, ventaEspecialAplicada]);
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
  const shouldShowEvidenceSection = useMemo(
    () => canManageEvidence || existingEvidence.length > 0,
    [canManageEvidence, existingEvidence.length],
  );
  const mlAssignableSellers = useMemo<PedidoMlAssignableSeller[]>(
    () => order?.ml_assignable_sellers || [],
    [order?.ml_assignable_sellers],
  );
  const selectedMlAssignableSeller = useMemo(
    () => mlAssignableSellers.find((item) => item.id === splitSellerId) || null,
    [mlAssignableSellers, splitSellerId],
  );
  const filteredMlAssignableSellers = useMemo(() => {
    const needle = sellerSearch.trim().toLowerCase();
    if (!needle) {
      return mlAssignableSellers;
    }

    return mlAssignableSellers.filter((item) => {
      const label = (item.label || '').toLowerCase();
      const displayName = (item.display_name || '').toLowerCase();
      const username = (item.username || '').toLowerCase();
      return label.includes(needle) || displayName.includes(needle) || username.includes(needle);
    });
  }, [mlAssignableSellers, sellerSearch]);

  const fetchCxcData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const detailResponse = await ordersApi.detail(token, orderId);
      const item = detailResponse.item;
      setOrder(item);
      setMlAdjustmentLines(item.detalle.map(buildMlAdjustmentLine));
      setMlSplitLines(item.detalle.map(buildMlSplitLine));
      setNoPedidoInput(normalizeIntegerInput(item.no_pedido || ''));
      setNoFacturaInput(normalizeIntegerInput(item.no_factura || ''));
      setSplitNoClienteInput('');
      setSplitRazonSocialInput('');
      setSplitSellerId(null);
      setSellerSearch('');
      setCancelConfirmInput('');
      setCancelReason('');

      setErrorMessage(null);
      setSpecialPriceError(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible cargar la operación de CXC.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token]);

  const updateMlAdjustmentLine = useCallback(
    (lineId: number, field: keyof Pick<MlAdjustmentLineDraft, 'cantidadInput' | 'surtidoInput' | 'rolloInput'>, value: string) => {
      setMlAdjustmentLines((prev) =>
        prev.map((line) =>
          line.id === lineId
            ? {
                ...line,
                [field]:
                  field === 'cantidadInput'
                    ? normalizeIntegerInput(value)
                    : normalizeIntegerInput(value),
              }
            : line,
        ),
      );
    },
    [],
  );

  const updateMlSplitQtyLine = useCallback((lineId: number, value: string) => {
    setMlSplitLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              cantidadDerivarInput: normalizeIntegerInput(value),
            }
          : line,
      ),
    );
  }, []);

  const updateMlSplitPriceLine = useCallback((lineId: number, value: string) => {
    const normalized = value.replace(/[^0-9.]/g, '');
    const parts = normalized.split('.');
    const integerPart = parts.shift() || '';
    const decimalPart = parts.join('').slice(0, 2);
    const nextValue = decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;

    setMlSplitLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              precioInput: nextValue,
            }
          : line,
      ),
    );
  }, []);

  const removeMlAdjustmentLine = useCallback((lineId: number) => {
    setMlAdjustmentLines((prev) => prev.filter((line) => line.id !== lineId));
    setMlSplitLines((prev) => prev.filter((line) => line.id !== lineId));
  }, []);

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
    if (!isDigitsOnly(numero)) {
      setErrorMessage('El documento final solo acepta números.');
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
    if (!isDigitsOnly(numero)) {
      setErrorMessage('El número de pedido solo acepta números.');
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
    setSpecialPriceError(null);
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
      setSpecialPriceError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const saveMlAdjustments = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    if (!canEditMlFacturacion) {
      setErrorMessage('No tienes permiso para ajustar partidas de Mercado Libre en facturación.');
      return;
    }

    if (mlAdjustmentLines.length === 0) {
      setErrorMessage('Debes conservar al menos una partida para guardar el ajuste.');
      return;
    }

    const detail: Array<{
      id: number;
      cantidad: number;
      surtido: number;
      rollo: number;
    }> = [];
    for (const line of mlAdjustmentLines) {
      const cantidad = Number.parseInt(line.cantidadInput, 10);
      const surtido = line.surtidoInput.trim() === '' ? NaN : Number.parseInt(line.surtidoInput, 10);
      const rollo = line.rolloInput.trim() === '' ? NaN : Number.parseInt(line.rolloInput, 10);

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        setErrorMessage(`La cantidad debe ser un entero mayor a 0 en la línea ${line.codigo}.`);
        return;
      }

      if (!Number.isInteger(surtido) || surtido < 0) {
        setErrorMessage(`El surtido debe ser un entero mayor o igual a 0 en la línea ${line.codigo}.`);
        return;
      }

      if (!Number.isInteger(rollo) || rollo < 0) {
        setErrorMessage(`El rollo debe ser un entero mayor o igual a 0 en la línea ${line.codigo}.`);
        return;
      }

      detail.push({
        id: line.id,
        cantidad,
        surtido,
        rollo,
      });
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.updateCxc(token, order.id, {
        detalle: detail,
      });
      Alert.alert(
        'Ajuste guardado',
        `${response.message}\n\nEste ajuste solo modifica el pedido ML pendiente en facturación y no vuelve a descontar inventario.`,
      );
      await fetchCxcData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible guardar el ajuste de partidas.';
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const autofillSplitClientData = useCallback(async (rawClave?: string, clearOnNotFound = false) => {
    const clave = (rawClave ?? splitNoClienteInput).trim();
    if (!token || !clave) {
      if (clearOnNotFound) {
        setSplitRazonSocialInput('');
        setSplitSellerId(null);
      }
      return;
    }

    if (lastAutofilledSplitClientRef.current === clave) {
      return;
    }

    try {
      const response = await ordersApi.clienteByClave(token, clave);
      const cliente = response.item;
      const razonSocial = (cliente.nombre_comercial || cliente.nombre || '').trim();
      const vendedorSugeridoId = Number(cliente.asignado_a_id || 0);

      if (cliente.clave) {
        setSplitNoClienteInput(cliente.clave);
      }
      if (razonSocial) {
        setSplitRazonSocialInput(razonSocial);
      }
      if (splitSellerId === null && vendedorSugeridoId > 0) {
        const sellerExists = mlAssignableSellers.some((item) => item.id === vendedorSugeridoId);
        if (sellerExists) {
          setSplitSellerId(vendedorSugeridoId);
        }
      }
      lastAutofilledSplitClientRef.current = cliente.clave || clave;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        lastAutofilledSplitClientRef.current = '';
        if (clearOnNotFound) {
          setSplitRazonSocialInput('');
        }
        return;
      }
      lastAutofilledSplitClientRef.current = '';
    }
  }, [mlAssignableSellers, splitNoClienteInput, splitSellerId, token]);

  useEffect(() => {
    const clave = splitNoClienteInput.trim();
    if (!clave) {
      lastAutofilledSplitClientRef.current = '';
      setSplitRazonSocialInput('');
      return;
    }

    if (clave.length < 4) {
      return;
    }

    const timer = setTimeout(() => {
      void autofillSplitClientData(clave, false);
    }, 350);

    return () => clearTimeout(timer);
  }, [autofillSplitClientData, splitNoClienteInput]);

  const saveMlSplit = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    if (!canEditMlFacturacion) {
      setErrorMessage('No tienes permiso para derivar pedidos de Mercado Libre en facturación.');
      return;
    }

    const noClienteDestino = splitNoClienteInput.trim();
    const razonSocialDestino =
      noClienteDestino === SERVICIO_ML_CLIENT_CODE ? SERVICIO_ML_CLIENT_NAME : splitRazonSocialInput.trim();
    const vendedorDestinoId = splitSellerId;

    if (!noClienteDestino) {
      setErrorMessage('Debes capturar el número de cliente destino.');
      return;
    }

    if (!razonSocialDestino) {
      setErrorMessage('Debes capturar la razón social del cliente destino.');
      return;
    }

    if (!vendedorDestinoId || !mlAssignableSellers.some((item) => item.id === vendedorDestinoId)) {
      setErrorMessage('Debes asignar un vendedor válido para el pedido derivado.');
      return;
    }

    const lineas: Array<{ id: number; cantidad: number; precio: number }> = [];
    for (const line of mlSplitLines) {
      const cantidad = Number.parseInt(line.cantidadDerivarInput, 10);
      if (!line.cantidadDerivarInput.trim()) {
        continue;
      }

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        setErrorMessage(`La cantidad a derivar debe ser un entero mayor a 0 en la línea ${line.codigo}.`);
        return;
      }

      if (cantidad > line.cantidadOriginal) {
        setErrorMessage(`La cantidad a derivar no puede ser mayor que la cantidad original en la línea ${line.codigo}.`);
        return;
      }

      const precio = Number.parseFloat(line.precioInput);
      if (!line.precioInput.trim() || Number.isNaN(precio) || precio < 0) {
        setErrorMessage(`El precio derivado debe ser mayor o igual a 0 en la línea ${line.codigo}.`);
        return;
      }

      lineas.push({
        id: line.id,
        cantidad,
        precio: Number(precio.toFixed(2)),
      });
    }

    if (lineas.length === 0) {
      setErrorMessage('Debes capturar al menos una cantidad a derivar para crear el pedido normal.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.updateCxc(token, order.id, {
        split_ml: {
          cliente_destino: {
            no_cliente: noClienteDestino,
            cliente_razon_social: razonSocialDestino,
            vendedor_id: vendedorDestinoId,
          },
          lineas,
        },
      });
      await fetchCxcData();
      const derivedOrderId = response.derived_item?.id ?? null;
      const successMessage = derivedOrderId
        ? `${response.message}\n\nSe creó el pedido #${derivedOrderId}. El inventario ya estaba preafectado y este flujo no volverá a descontarlo.`
        : `${response.message}\n\nLa derivación generó un pedido normal y no volverá a descontar inventario.`;

      if (derivedOrderId && onOpenDerivedOrder) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const shouldOpenDerived = window.confirm(`${successMessage}\n\n¿Quieres abrir el pedido derivado ahora?`);
          if (shouldOpenDerived) {
            onOpenDerivedOrder(derivedOrderId);
            return;
          }

          Alert.alert('Pedido derivado creado', successMessage);
          return;
        }

        Alert.alert('Pedido derivado creado', successMessage, [
          {
            text: 'Seguir aquí',
            style: 'cancel',
          },
          {
            text: 'Ver pedido derivado',
            onPress: () => onOpenDerivedOrder(derivedOrderId),
          },
        ]);
        return;
      }

      Alert.alert('Pedido derivado creado', successMessage);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible derivar el pedido normal desde Mercado Libre.';
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

  const returnToWarehouse = async () => {
    if (!token || !order || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await ordersApi.transition(token, order.id, 'almacen');
      Alert.alert('Pedido regresado', response.message || 'El pedido regresó a almacén.');
      onDone(order.id);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible regresar el pedido a almacén.';
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

    const confirmationMessage = isMercadoLibreFacturacion
      ? `Se cancelará el documento ${currentDocument}.\n\nNo se hará reversa física; el saldo ML ignorará este documento cancelado. El flujo permanecerá en TERMINADO.`
      : isMercadoLibreSalida && mlInventarioAfectado
      ? `Se cancelará el documento ${currentDocument}.\n\nEl inventario se mantendrá afectado porque este pedido es Mercado Libre y la salida ya ocurrió en almacén. El flujo permanecerá en TERMINADO.`
      : `Se cancelará el documento ${currentDocument}.\n\nEsta acción revertirá inventario y el flujo permanecerá en TERMINADO.`;

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
    <>
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
            {isMercadoLibre ? (
              <View style={[styles.stageBadge, styles.stageBadgeMercadoLibre]}>
                <Text style={[styles.stageBadgeLabel, styles.stageBadgeLabelMercadoLibre]}>MERCADO LIBRE</Text>
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
                ? 'CXC registra el documento final y, si aún falta material, puede regresar el pedido a almacén.'
                : isFinishedStage
                  ? 'CXC puede revisar el cierre y, si aplica, cancelar el documento final con trazabilidad.'
                  : 'Operación actual de CXC.'}
          </Text>
          {isMercadoLibre ? (
            <Text style={styles.mlHint}>
              {isMercadoLibreFacturacion
                ? 'Mercado Libre facturación: al terminar, descuenta únicamente el saldo ML y no toca inventario físico.'
                : mlInventarioAfectado
                  ? 'Mercado Libre: el inventario ya fue afectado en almacén y facturación no volverá a descontarlo.'
                  : 'Mercado Libre: al salir de almacén hacia facturación, el inventario se afecta para reflejar la salida física.'}
            </Text>
          ) : null}
          {isMercadoLibreDerived ? (
            <Text style={styles.mlHint}>
              Pedido derivado desde Mercado Libre: el inventario ya estaba preafectado en el pedido origen y este flujo no volverá a descontarlo.
            </Text>
          ) : null}
          {isPostfechado ? (
            <Text style={styles.postdatedHint}>
              Pedido postfechado con entrega programada para {fechaEntregaVisible}.
            </Text>
          ) : null}
        </View>

        <Text style={styles.amountSectionTitle}>
          {canCompareSpecialAmounts ? 'Importe original del pedido' : 'Importe del pedido'}
        </Text>
        <View style={styles.amountsRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Subtotal</Text>
            <Text style={styles.amountValue}>{formatMoney(originalSubtotal)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>IVA</Text>
            <Text style={styles.amountValue}>{formatMoney(originalIva)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>{formatMoney(originalTotal)}</Text>
          </View>
        </View>
        {canCompareSpecialAmounts ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Importe final del pedido</Text>
            <Text style={styles.previewValue}>
              Subtotal: {formatMoney(finalSubtotal)} | IVA: {formatMoney(finalIva)} | Total: {formatMoney(finalTotal)}
            </Text>
          </View>
        ) : null}

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
          <Text style={styles.noteLabel}>Venta especial</Text>
          <Text style={styles.noteValue}>
            {ventaEspecialAplicada ? 'Aplicada' : 'No aplicada'}
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
        {isMercadoLibre ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Mercado Libre</Text>
            <Text style={styles.noteValue}>{isMercadoLibreFacturacion ? 'Facturación' : 'Salida'}</Text>
          </View>
        ) : null}
        {isMercadoLibreDerived ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Derivado desde ML</Text>
            <Text style={styles.noteValue}>{mlOrigenPedidoId ? `Sí. Pedido origen #${mlOrigenPedidoId}` : 'Sí'}</Text>
          </View>
        ) : null}
        {isMercadoLibreSalida ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Inventario afectado en almacén</Text>
            <Text style={styles.noteValue}>{mlInventarioAfectado ? 'Sí' : 'No'}</Text>
          </View>
        ) : null}
        {inventarioPreafectado ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Inventario preafectado</Text>
            <Text style={styles.noteValue}>Sí. No se descuenta de nuevo en este flujo.</Text>
          </View>
        ) : null}
        {mlPendienteFacturacion ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteLabel}>Pendiente por facturar</Text>
            <Text style={styles.noteValue}>Sí. Facturación no volverá a descontar inventario.</Text>
          </View>
        ) : null}
        {cxcNotes.map((item) => (
          <View key={item.label} style={styles.noteRow}>
            <Text style={styles.noteLabel}>{item.label}</Text>
            <Text style={styles.noteValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {shouldShowEvidenceSection ? (
        <EvidenceSection
          title="EVIDENCIA"
          canView={canViewEvidence}
          canManage={canManageEvidence}
          evidences={existingEvidence}
          uploading={isBusy}
          onPreviewEvidence={previewOrderEvidence}
          onDownloadEvidence={downloadOrderEvidence}
        />
      ) : null}

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
              placeholderTextColor={palette.mutedText}
              value={noPedidoInput}
              onChangeText={(value) => setNoPedidoInput(normalizeIntegerInput(value))}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={50}
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

          {canEditMlFacturacion ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ajuste de partidas Mercado Libre</Text>
              <Text style={styles.hint}>
                Ajusta únicamente las líneas activas del pedido ML pendiente en facturación. Este guardado no vuelve a descontar inventario; solo actualiza el detalle.
              </Text>
              <Text style={styles.mlAdjustmentWarning}>
                Si eliminas una línea, ya no se enviará en el guardado.
              </Text>

              {mlAdjustmentLines.length === 0 ? (
                <Text style={styles.warningText}>
                  Debes conservar al menos una partida para poder guardar el ajuste.
                </Text>
              ) : null}

              {mlAdjustmentLines.map((line, index) => (
                <View key={line.id} style={styles.mlLineCard}>
                  <View style={styles.mlLineHeader}>
                    <View>
                      <Text style={styles.mlLineTitle}>Partida {index + 1}</Text>
                      <Text style={styles.mlLineSubtitle}>
                        {line.codigo} | {line.descripcion}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.mlDeleteButton}
                      onPress={() => removeMlAdjustmentLine(line.id)}
                      disabled={isBusy}
                    >
                      <Text style={styles.mlDeleteButtonLabel}>Eliminar</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.fieldLabel}>Cantidad</Text>
                  <TextInput
              placeholderTextColor={palette.mutedText}
                    value={line.cantidadInput}
                    onChangeText={(value) => updateMlAdjustmentLine(line.id, 'cantidadInput', value)}
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="Cantidad entera"
                  />

                  <View style={styles.mlLineInputsRow}>
                    <View style={styles.mlLineInputColumn}>
                      <Text style={styles.fieldLabel}>Surtido</Text>
                      <TextInput
              placeholderTextColor={palette.mutedText}
                        value={line.surtidoInput}
                        onChangeText={(value) => updateMlAdjustmentLine(line.id, 'surtidoInput', value)}
                        style={styles.input}
                        keyboardType="number-pad"
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.mlLineInputColumn}>
                      <Text style={styles.fieldLabel}>Rollo</Text>
                      <TextInput
              placeholderTextColor={palette.mutedText}
                        value={line.rolloInput}
                        onChangeText={(value) => updateMlAdjustmentLine(line.id, 'rolloInput', value)}
                        style={styles.input}
                        keyboardType="number-pad"
                        placeholder="0"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <Pressable
                style={[styles.secondaryButton, mlAdjustmentLines.length === 0 && styles.primaryButtonDisabled]}
                onPress={saveMlAdjustments}
                disabled={isBusy || mlAdjustmentLines.length === 0}
              >
                <Text style={styles.secondaryButtonLabel}>{isBusy ? 'Guardando...' : 'Guardar ajustes'}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documento final</Text>
            <Text style={styles.fieldLabel}>{documentFieldLabel}</Text>
            <TextInput
              placeholderTextColor={palette.mutedText}
              value={noFacturaInput}
              onChangeText={(value) => setNoFacturaInput(normalizeIntegerInput(value))}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={50}
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

          {shouldShowSpecialPriceSection ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Precio especial</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryLabel}>Estado actual</Text>
                  <Text style={styles.summaryValue}>
                    {ventaEspecialAplicada ? 'Aplicado' : 'No aplicado'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.secondaryButton, ventaEspecialAplicada ? styles.destructiveButton : styles.infoButton, !canApplySpecialPrice && !ventaEspecialAplicada && styles.primaryButtonDisabled]}
                onPress={() => toggleVentaEspecial(!ventaEspecialAplicada)}
                disabled={isBusy || (!canApplySpecialPrice && !ventaEspecialAplicada)}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isBusy
                    ? 'Procesando...'
                    : ventaEspecialAplicada
                      ? 'Quitar precio especial'
                      : 'Aplicar precio especial'}
                </Text>
              </Pressable>
              {specialPriceError ? (
                <Text style={styles.cardError}>{specialPriceError}</Text>
              ) : null}
            </View>
          ) : null}

          {canEditMlFacturacion ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Derivar pedido normal</Text>
              <Text style={styles.hint}>
                Captura un cliente destino y las cantidades que se transformarán en un pedido normal derivado. Esta derivación no vuelve a descontar inventario.
              </Text>
              <Text style={styles.fieldLabel}>No. cliente destino</Text>
              <TextInput
              placeholderTextColor={palette.mutedText}
                value={splitNoClienteInput}
                onChangeText={setSplitNoClienteInput}
                onBlur={() => {
                  void autofillSplitClientData();
                }}
                onSubmitEditing={() => {
                  void autofillSplitClientData();
                }}
                style={styles.input}
                placeholder="No. cliente del pedido derivado"
                keyboardType="number-pad"
              />
              <Text style={styles.fieldLabel}>Razón social destino</Text>
              <TextInput
              placeholderTextColor={palette.mutedText}
                value={splitRazonSocialInput}
                onChangeText={setSplitRazonSocialInput}
                style={styles.input}
                placeholder="Razón social del cliente destino"
              />
              <Text style={styles.fieldLabel}>Asignar vendedor</Text>
              <Pressable
                style={[styles.selectorButton, mlAssignableSellers.length === 0 && styles.selectorButtonDisabled]}
                onPress={() => {
                  if (mlAssignableSellers.length === 0) {
                    return;
                  }
                  setSellerSearch('');
                  setSellerModalOpen(true);
                }}
                disabled={mlAssignableSellers.length === 0}
              >
                <Text style={[styles.selectorButtonLabel, !selectedMlAssignableSeller && styles.selectorButtonPlaceholder]}>
                  {selectedMlAssignableSeller?.label || 'Selecciona un vendedor'}
                </Text>
              </Pressable>
              {mlAssignableSellers.length === 0 ? (
                <Text style={styles.hint}>No hay vendedores disponibles para asignar en este momento.</Text>
              ) : null}
              <Text style={styles.mlAdjustmentWarning}>
                Deja en blanco o en cero las líneas que no quieras derivar. Solo se enviarán las cantidades capturadas.
              </Text>

              {mlSplitLines.map((line, index) => (
                <View key={line.id} style={styles.mlLineCard}>
                  <View style={styles.mlLineHeader}>
                    <View>
                      <Text style={styles.mlLineTitle}>Partida {index + 1}</Text>
                      <Text style={styles.mlLineSubtitle}>
                        {line.codigo} | {line.descripcion}
                      </Text>
                    </View>
                    <View style={styles.mlSplitOriginBox}>
                      <Text style={styles.mlSplitOriginLabel}>Original</Text>
                      <Text style={styles.mlSplitOriginValue}>{line.cantidadOriginal}</Text>
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Cantidad a derivar</Text>
                  <TextInput
              placeholderTextColor={palette.mutedText}
                    value={line.cantidadDerivarInput}
                    onChangeText={(value) => updateMlSplitQtyLine(line.id, value)}
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                  <Text style={styles.fieldLabel}>Precio derivado</Text>
                  <TextInput
              placeholderTextColor={palette.mutedText}
                    value={line.precioInput}
                    onChangeText={(value) => updateMlSplitPriceLine(line.id, value)}
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              ))}

              <Pressable
                style={[styles.secondaryButton, isBusy && styles.primaryButtonDisabled]}
                onPress={saveMlSplit}
                disabled={isBusy}
              >
                <Text style={styles.secondaryButtonLabel}>{isBusy ? 'Derivando...' : 'Crear pedido derivado'}</Text>
              </Pressable>
            </View>
          ) : null}

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
          {!warehouseFullySupplied ? (
            <Text style={styles.warningText}>
              Faltan {warehouseTotalFaltante} pieza(s) por surtir. Regresa el pedido a almacén antes de terminarlo.
            </Text>
          ) : null}
          <Pressable
            style={styles.secondaryButton}
            onPress={returnToWarehouse}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonLabel}>{isBusy ? 'Procesando...' : 'Regresar a Almacén'}</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, (!documentoGuardado || !warehouseFullySupplied) && styles.primaryButtonDisabled]}
            onPress={continueFlow}
            disabled={isBusy || !documentoGuardado || !warehouseFullySupplied}
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
              {isMercadoLibreFacturacion
                ? 'El pedido ya cerró el flujo. En Mercado Libre facturación solo se descuenta el saldo ML; la cancelación documental lo excluye del saldo.'
                : isMercadoLibreSalida && mlInventarioAfectado
                  ? 'El pedido ya cerró el flujo. En Mercado Libre el inventario ya había sido afectado desde almacén y la cancelación documental no reabre el pedido.'
                : 'El pedido ya cerró el flujo y el inventario ya fue afectado. La cancelación del documento no reabre el pedido.'}
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
                {isMercadoLibreFacturacion
                  ? 'Confirma el número exacto del documento y captura el motivo. No habrá reversa física; el saldo ML ignorará este documento cancelado.'
                  : isMercadoLibreSalida && mlInventarioAfectado
                    ? 'Confirma el número exacto del documento y captura el motivo. En Mercado Libre el inventario se mantendrá afectado porque la salida ya ocurrió en almacén.'
                  : 'Confirma el número exacto del documento y captura el motivo. El inventario se revertirá y el pedido permanecerá en TERMINADO.'}
              </Text>
              <Text style={styles.fieldLabel}>Confirmar {documentFieldLabel}</Text>
              <TextInput
              placeholderTextColor={palette.mutedText}
                value={cancelConfirmInput}
                onChangeText={setCancelConfirmInput}
                style={styles.input}
                placeholder={documentFieldLabel}
                autoCapitalize="characters"
              />
              <Text style={styles.fieldLabel}>Motivo de cancelación</Text>
              <TextInput
              placeholderTextColor={palette.mutedText}
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
    <Modal visible={sellerModalOpen} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Asignar vendedor</Text>
          <TextInput
            value={sellerSearch}
            onChangeText={setSellerSearch}
            style={styles.modalSearchInput}
            placeholder="Buscar por nombre o usuario"
            placeholderTextColor={palette.mutedText}
          />
          <FlatList
            data={filteredMlAssignableSellers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.modalListContent}
            renderItem={({ item }) => (
              <Pressable
                style={styles.modalOption}
                onPress={() => {
                  setSplitSellerId(item.id);
                  setSellerModalOpen(false);
                }}
              >
                <Text style={styles.modalOptionLabel}>{item.label}</Text>
                {item.role_name ? <Text style={styles.modalOptionMeta}>{item.role_name}</Text> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>No se encontraron vendedores.</Text>}
          />
          <Pressable style={styles.modalCloseButton} onPress={() => setSellerModalOpen(false)}>
            <Text style={styles.modalCloseButtonLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
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
  stageBadgeMercadoLibre: {
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
  stageBadgeLabelMercadoLibre: {
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
  mlHint: {
    marginTop: 6,
    color: palette.primaryDark,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  mlAdjustmentWarning: {
    marginTop: 8,
    color: '#8b5e00',
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  mlLineCard: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#f9fbfc',
    padding: 10,
  },
  mlLineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  mlLineTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  mlLineSubtitle: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    marginTop: 2,
  },
  mlSplitOriginBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  mlSplitOriginLabel: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  mlSplitOriginValue: {
    color: palette.primaryDark,
    fontFamily: typography.bold,
    fontSize: 16,
    marginTop: 2,
  },
  mlDeleteButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fde8e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mlDeleteButtonLabel: {
    color: '#a61d24',
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  mlLineInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mlLineInputColumn: {
    flex: 1,
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
  selectorButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectorButtonDisabled: {
    opacity: 0.65,
  },
  selectorButtonLabel: {
    color: palette.text,
    fontFamily: typography.regular,
    fontSize: 14,
  },
  selectorButtonPlaceholder: {
    color: palette.mutedText,
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: palette.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  modalTitle: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 18,
    marginBottom: 10,
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontFamily: typography.regular,
    marginBottom: 10,
  },
  modalListContent: {
    paddingBottom: 12,
  },
  modalOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  modalOptionLabel: {
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  modalOptionMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    marginTop: 2,
  },
  modalEmpty: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 18,
  },
  modalCloseButton: {
    backgroundColor: palette.navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 14,
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
  amountSectionTitle: {
    color: palette.mutedText,
    fontFamily: typography.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  cardError: {
    marginTop: 14,
    color: palette.danger,
    fontFamily: typography.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  warningText: {
    marginTop: 12,
    color: '#9a6200',
    fontFamily: typography.medium,
    fontSize: 12,
  },
});

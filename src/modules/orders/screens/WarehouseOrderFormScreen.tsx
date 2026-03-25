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
import { Pedido, PedidoDetalleLinea } from '../types';

type WarehouseOrderFormScreenProps = {
  orderId: number;
  onDone: (orderId: number) => void;
};

type DraftWarehouseLine = {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importeOriginal: number;
  inventarioDisponible: number | null;
  largo: number | null;
  surtidoInput: string;
  rolloInput: string;
};

function buildLine(line: PedidoDetalleLinea): DraftWarehouseLine {
  return {
    id: line.id,
    codigo: line.codigo || '-',
    descripcion: line.descripcion || '',
    cantidad: Number(line.cantidad || 0),
    precio: Number(line.precio || 0),
    importeOriginal: Number(line.importe || 0),
    inventarioDisponible: line.inventario_disponible,
    largo: line.largo ?? null,
    surtidoInput: String(line.surtido ?? 0),
    rolloInput: String(line.rollo ?? 0),
  };
}

function isAlmacenStatusComplete(value: string | null | undefined) {
  return (value || '').trim().toUpperCase() === 'COMPLETO';
}

function isPostfechadoLocked(order: Pedido | null) {
  if (!order?.postfechado || !order.fecha_entrega) {
    return false;
  }

  const unlockAt = new Date(`${order.fecha_entrega}T00:00:00`);
  unlockAt.setDate(unlockAt.getDate() - 1);
  return Date.now() < unlockAt.getTime();
}

function isValidFechaEntregaInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() >= today.getTime();
}

export function WarehouseOrderFormScreen({ orderId, onDone }: WarehouseOrderFormScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [lines, setLines] = useState<DraftWarehouseLine[]>([]);
  const [fechaEntregaInput, setFechaEntregaInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await ordersApi.detail(token, orderId);
      setOrder(response.item);
      setLines(response.item.detalle.map(buildLine));
      setFechaEntregaInput(response.item.fecha_entrega || '');
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible cargar el pedido para almacén.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const parsedLines = useMemo(
    () =>
      lines.map((line) => {
        const surtido = Number(line.surtidoInput);
        const rollo = Number(line.rolloInput);
        const surtidoNormalizado = Number.isFinite(surtido) ? surtido : NaN;
        const faltante = Math.max(line.cantidad - (Number.isFinite(surtidoNormalizado) ? surtidoNormalizado : 0), 0);
        const sugerenciaSurtido =
          line.largo !== null && line.largo > 0 && Number.isFinite(rollo) && rollo > 0
            ? Number((rollo * line.largo).toFixed(4))
            : null;
        const cantidadFacturable = Number.isFinite(surtidoNormalizado) && surtidoNormalizado > 0 ? surtidoNormalizado : line.cantidad;
        const importeCalculado = Number((cantidadFacturable * line.precio).toFixed(2));
        const extraCantidad = Math.max(cantidadFacturable - line.cantidad, 0);
        const extraMonto = Math.max(importeCalculado - line.importeOriginal, 0);

        return {
          ...line,
          surtido: surtidoNormalizado,
          rollo: Number.isFinite(rollo) ? rollo : NaN,
          faltante,
          sugerenciaSurtido,
          cantidadFacturable,
          importeCalculado,
          extraCantidad,
          extraMonto,
        };
      }),
    [lines],
  );

  const totalSurtido = useMemo(
    () => parsedLines.reduce((acc, line) => acc + (Number.isFinite(line.surtido) ? line.surtido : 0), 0),
    [parsedLines],
  );

  const totalRollos = useMemo(
    () => parsedLines.reduce((acc, line) => acc + (Number.isFinite(line.rollo) ? line.rollo : 0), 0),
    [parsedLines],
  );

  const totalFaltante = useMemo(
    () => parsedLines.reduce((acc, line) => acc + (Number.isFinite(line.faltante) ? line.faltante : 0), 0),
    [parsedLines],
  );

  const allComplete = useMemo(
    () => parsedLines.length > 0 && parsedLines.every((line) => Number.isFinite(line.surtido) && line.surtido >= line.cantidad),
    [parsedLines],
  );
  const isPostdatedLocked = useMemo(() => isPostfechadoLocked(order), [order]);
  const isCompleteByOrder = useMemo(
    () => isAlmacenStatusComplete(order?.almacen_status),
    [order?.almacen_status],
  );

  const updateLineInput = (lineId: number, field: 'surtidoInput' | 'rolloInput', value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: value.replace(',', '.'),
            }
          : line,
      ),
    );
  };

  const validate = () => {
    if (parsedLines.length === 0) {
      return 'El pedido no tiene líneas para captura de almacén.';
    }

    for (const line of parsedLines) {
      if (!Number.isFinite(line.surtido) || !Number.isFinite(line.rollo)) {
        return `Debes capturar surtido y rollos válidos para ${line.codigo}.`;
      }

      if (line.surtido < 0 || line.rollo < 0) {
        return `Surtido y rollos no pueden ser negativos (${line.codigo}).`;
      }

      if (line.inventarioDisponible !== null && line.surtido > line.inventarioDisponible) {
        return `El surtido excede inventario disponible en ${line.codigo}.`;
      }
    }

    return null;
  };

  const saveWarehouseCapture = async () => {
    if (!token || isSaving) {
      return;
    }

    if (isPostdatedLocked) {
      setErrorMessage('El pedido postfechado solo puede capturarse 24 horas antes de la fecha de entrega.');
      return;
    }

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const payload = {
        detalle: parsedLines.map((line) => ({
          id: line.id,
          surtido: Number(line.surtido.toFixed(4)),
          rollo: Number(line.rollo.toFixed(4)),
        })),
      };

      const response = await ordersApi.updateWarehouse(token, orderId, payload);
      setOrder(response.item);
      setLines(response.item.detalle.map(buildLine));

      Alert.alert(
        'Almacén actualizado',
        response.standby
          ? 'Pedido guardado con surtido parcial. Ya puedes enviarlo a FACTURACIÓN si así lo decide almacén.'
          : 'Pedido surtido completo. Ya puedes enviarlo a FACTURACIÓN.',
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible guardar la captura de almacén.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const saveFechaEntrega = async () => {
    if (!token || !order || isSaving) {
      return;
    }

    if (!order.postfechado) {
      setErrorMessage('La fecha de entrega solo puede actualizarse cuando el pedido es postfechado.');
      return;
    }

    const normalizedFechaEntrega = fechaEntregaInput.trim();
    if (!isValidFechaEntregaInput(normalizedFechaEntrega)) {
      setErrorMessage('Captura una fecha de entrega válida en formato YYYY-MM-DD y que no sea pasada.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await ordersApi.updateWarehouse(token, orderId, {
        fecha_entrega: normalizedFechaEntrega,
      });
      setOrder(response.item);
      setLines(response.item.detalle.map(buildLine));
      setFechaEntregaInput(response.item.fecha_entrega || normalizedFechaEntrega);
      Alert.alert('Fecha actualizada', response.message);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible actualizar la fecha de entrega.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const sendToFacturacion = async () => {
    if (!token || !order || isSaving) {
      return;
    }

    if (isPostdatedLocked) {
      Alert.alert('Postfechado bloqueado', 'Este pedido solo puede avanzar 24 horas antes de la fecha de entrega.');
      return;
    }

    setIsSaving(true);
    try {
      await ordersApi.transition(token, order.id, 'facturacion');
      Alert.alert('Flujo actualizado', 'Pedido enviado a FACTURACIÓN.');
      onDone(order.id);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible enviar a FACTURACIÓN.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
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
        <Text style={styles.error}>{errorMessage || 'No hay pedido disponible para captura.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Captura de Almacén</Text>
      <Text style={styles.subtitle}>Pedido #{order.no_pedido || order.id}</Text>
      <Text style={styles.subtitle}>Cliente: {order.cliente_razon_social || '-'}</Text>
      <Text style={styles.subtitle}>Total pedido: {formatMoney(order.total)}</Text>
      {order.postfechado ? (
        <>
          <Text style={styles.subtitle}>
            Postfechado: Sí{order.fecha_entrega ? ` | Fecha entrega: ${order.fecha_entrega}` : ''}
          </Text>
          <View style={styles.deliveryCard}>
            <Text style={styles.deliveryTitle}>Fecha de entrega</Text>
            <Text style={styles.helperInfo}>
              Si el cliente quiere adelantar el pedido, almacén puede actualizar esta fecha sin abrir la edición completa.
            </Text>
            <TextInput
              value={fechaEntregaInput}
              onChangeText={setFechaEntregaInput}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable style={styles.deliveryButton} onPress={saveFechaEntrega} disabled={isSaving}>
              <Text style={styles.deliveryButtonLabel}>{isSaving ? 'Guardando...' : 'Actualizar fecha de entrega'}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {isPostdatedLocked ? (
        <Text style={styles.error}>
          Este pedido postfechado todavía no puede editarse ni avanzar, pero sí puedes ajustar la fecha de entrega desde aquí.
        </Text>
      ) : null}

      {parsedLines.map((line) => (
        <View key={line.id} style={styles.lineCard}>
          <Text style={styles.lineCode}>{line.codigo}</Text>
          <Text style={styles.lineDesc}>{line.descripcion || 'Sin descripción'}</Text>
          <Text style={styles.metaRow}>
            Cantidad solicitada: {line.cantidad} | Inventario: {line.inventarioDisponible ?? '-'}
          </Text>
          <Text style={styles.metaRow}>Precio: {formatMoney(line.precio)} | Importe actual: {formatMoney(line.importeCalculado)}</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Surtido</Text>
              <TextInput
                value={line.surtidoInput}
                onChangeText={(value) => updateLineInput(line.id, 'surtidoInput', value)}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Rollos</Text>
              <TextInput
                value={line.rolloInput}
                onChangeText={(value) => updateLineInput(line.id, 'rolloInput', value)}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.faltanteWrap}>
              <Text style={styles.inputLabel}>Faltante</Text>
              <Text style={styles.faltanteValue}>{line.faltante.toFixed(2)}</Text>
            </View>
          </View>
          {line.sugerenciaSurtido !== null ? (
            <Text style={styles.helperInfo}>
              Sugerencia: {line.rollo.toFixed(2)} rollos x {line.largo?.toFixed(2)} de largo = {line.sugerenciaSurtido.toFixed(2)} de surtido.
            </Text>
          ) : null}
          {line.extraCantidad > 0 ? (
            <Text style={styles.extraInfo}>
              Extra surtido: +{line.extraCantidad.toFixed(2)} | Incremento: +{formatMoney(line.extraMonto)}
            </Text>
          ) : null}
        </View>
      ))}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLine}>Total surtido: {totalSurtido.toFixed(2)}</Text>
        <Text style={styles.summaryLine}>Total rollos: {totalRollos.toFixed(2)}</Text>
        <Text style={styles.summaryLine}>Total faltante: {totalFaltante.toFixed(2)}</Text>
        <Text style={styles.summaryStatus}>
          Estado sugerido: {allComplete ? 'COMPLETO' : 'STANDBY (PARCIAL)'} | Estado actual:{' '}
          {order.almacen_status || '-'}
        </Text>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={styles.saveButton} onPress={saveWarehouseCapture} disabled={isSaving}>
        <Text style={styles.saveLabel}>{isSaving ? 'Guardando...' : 'Guardar captura'}</Text>
      </Pressable>

      {order.almacen_status ? (
        <Pressable style={styles.sendButton} onPress={sendToFacturacion} disabled={isSaving}>
          <Text style={styles.sendLabel}>Enviar a Facturación</Text>
        </Pressable>
      ) : null}

      {!order.almacen_status ? (
        <Text style={styles.helperInfo}>
          Guarda la captura de almacén primero. El pedido puede continuar aunque el surtido quede parcial.
        </Text>
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
  deliveryCard: {
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#d7ece8',
    borderRadius: 12,
    backgroundColor: '#eff8f6',
    padding: 12,
  },
  deliveryTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
    marginBottom: 4,
  },
  lineCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
  },
  lineCode: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  lineDesc: {
    color: palette.text,
    fontFamily: typography.regular,
    marginTop: 2,
    marginBottom: 4,
  },
  metaRow: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  inputWrap: {
    flex: 1,
  },
  inputLabel: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: typography.regular,
    color: palette.text,
  },
  faltanteWrap: {
    minWidth: 72,
    borderWidth: 1,
    borderColor: '#f5d4b2',
    borderRadius: 8,
    backgroundColor: '#fff4ea',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  faltanteValue: {
    color: '#a5621d',
    fontFamily: typography.bold,
    fontSize: 14,
  },
  summaryCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#d7ece8',
    borderRadius: 12,
    backgroundColor: '#eff8f6',
    padding: 12,
  },
  summaryLine: {
    color: palette.text,
    fontFamily: typography.medium,
    marginBottom: 3,
  },
  summaryStatus: {
    color: palette.primaryDark,
    fontFamily: typography.bold,
    marginTop: 4,
  },
  extraInfo: {
    marginTop: 6,
    color: '#a5621d',
    fontFamily: typography.medium,
    fontSize: 12,
  },
  error: {
    marginTop: 10,
    color: palette.danger,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  helperInfo: {
    marginTop: 8,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  deliveryButton: {
    marginTop: 10,
    backgroundColor: palette.warning,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deliveryButtonLabel: {
    color: '#1f2328',
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
  sendButton: {
    marginTop: 10,
    backgroundColor: palette.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
});

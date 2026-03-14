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
  inventarioDisponible: number | null;
  surtidoInput: string;
  rolloInput: string;
};

function buildLine(line: PedidoDetalleLinea): DraftWarehouseLine {
  return {
    id: line.id,
    codigo: line.codigo || '-',
    descripcion: line.descripcion || '',
    cantidad: Number(line.cantidad || 0),
    inventarioDisponible: line.inventario_disponible,
    surtidoInput: String(line.surtido ?? 0),
    rolloInput: String(line.rollo ?? 0),
  };
}

function isAlmacenStatusComplete(value: string | null | undefined) {
  return (value || '').trim().toUpperCase() === 'COMPLETO';
}

export function WarehouseOrderFormScreen({ orderId, onDone }: WarehouseOrderFormScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [lines, setLines] = useState<DraftWarehouseLine[]>([]);
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
        const faltante = Math.max(line.cantidad - (Number.isFinite(surtido) ? surtido : 0), 0);

        return {
          ...line,
          surtido: Number.isFinite(surtido) ? surtido : NaN,
          rollo: Number.isFinite(rollo) ? rollo : NaN,
          faltante,
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

      if (line.surtido > line.cantidad) {
        return `El surtido no puede exceder la cantidad solicitada (${line.codigo}).`;
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
          ? 'Pedido con surtido parcial. Puedes continuar capturando después.'
          : 'Pedido surtido completo. Ya puedes enviarlo a FACTURACIÓN.',
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible guardar la captura de almacén.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const sendToFacturacion = async () => {
    if (!token || !order || isSaving) {
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

      {parsedLines.map((line) => (
        <View key={line.id} style={styles.lineCard}>
          <Text style={styles.lineCode}>{line.codigo}</Text>
          <Text style={styles.lineDesc}>{line.descripcion || 'Sin descripción'}</Text>
          <Text style={styles.metaRow}>
            Cantidad solicitada: {line.cantidad} | Inventario: {line.inventarioDisponible ?? '-'}
          </Text>

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

      {isCompleteByOrder ? (
        <Pressable style={styles.sendButton} onPress={sendToFacturacion} disabled={isSaving}>
          <Text style={styles.sendLabel}>Enviar a Facturación</Text>
        </Pressable>
      ) : null}

      {!isCompleteByOrder ? (
        <Text style={styles.helperInfo}>
          Para enviar a FACTURACIÓN, primero guarda la captura y confirma que el estatus quede en COMPLETO.
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

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../../shared/api/http';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatDateYmd, formatMoney, getTodayYmd } from '../../../shared/utils/formatters';
import { useAuth } from '../../auth/AuthContext';
import { ordersApi } from '../services/ordersApi';
import { Pedido } from '../types';

type WarehouseDeliveryScreenProps = {
  orderId: number;
  onDone: (orderId: number) => void;
};

function normalizeDateInput(value: string) {
  return value.trim();
}

export function WarehouseDeliveryScreen({ orderId, onDone }: WarehouseDeliveryScreenProps) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Pedido | null>(null);
  const [routeValue, setRouteValue] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(getTodayYmd());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await ordersApi.detail(token, orderId);
      const item = response.item;
      setOrder(item);
      setRouteValue(item.ruta || '');
      setDeliveryDate(item.fecha_entrega || getTodayYmd());
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible cargar el pedido para entrega.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const validate = () => {
    const routeTrim = routeValue.trim();
    const dateTrim = normalizeDateInput(deliveryDate);
    const today = getTodayYmd();

    if (!routeTrim) {
      return 'Debes capturar la ruta de entrega.';
    }

    if (!dateTrim) {
      return 'Debes capturar la fecha de entrega.';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrim)) {
      return 'La fecha debe estar en formato YYYY-MM-DD.';
    }

    if (dateTrim < today) {
      return 'La fecha de entrega no puede ser menor a hoy.';
    }

    return null;
  };

  const submit = async () => {
    if (!token || !order || isSubmitting) {
      return;
    }

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await ordersApi.transition(token, order.id, 'terminado', {
        ruta: routeValue.trim(),
        fecha_entrega: normalizeDateInput(deliveryDate),
      });
      Alert.alert('Pedido terminado', response.message || 'Pedido finalizado correctamente.');
      onDone(order.id);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No fue posible terminar el pedido.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
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
        <Text style={styles.error}>{errorMessage || 'No hay pedido disponible para entrega.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Almacén final / Entrega</Text>
      <Text style={styles.subtitle}>Pedido #{order.no_pedido || order.id}</Text>
      <Text style={styles.subtitle}>Cliente: {order.cliente_razon_social || '-'}</Text>
      <Text style={styles.subtitle}>Total pedido: {formatMoney(order.total)}</Text>
      <Text style={styles.subtitle}>Fecha actual: {formatDateYmd(getTodayYmd())}</Text>

      <Text style={styles.label}>Ruta</Text>
      <TextInput
        value={routeValue}
        onChangeText={setRouteValue}
        placeholder="Ej. RUTA NORTE 1"
        style={styles.input}
      />

      <Text style={styles.label}>Fecha de entrega (YYYY-MM-DD)</Text>
      <TextInput
        value={deliveryDate}
        onChangeText={setDeliveryDate}
        placeholder={getTodayYmd()}
        style={styles.input}
        autoCapitalize="none"
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
        <Text style={styles.submitLabel}>{isSubmitting ? 'Procesando...' : 'Terminar pedido'}</Text>
      </Pressable>
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
  label: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: palette.text,
    fontFamily: typography.regular,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
  error: {
    marginTop: 12,
    color: palette.danger,
    fontFamily: typography.medium,
    fontSize: 12,
  },
});

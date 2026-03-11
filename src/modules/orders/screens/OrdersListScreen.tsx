import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { OrderCard } from '../components/OrderCard';
import { ordersApi } from '../services/ordersApi';
import { PedidoListItem } from '../types';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../../shared/api/http';
import { EmptyState } from '../../../shared/components/EmptyState';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';

type OrdersListScreenProps = {
  availableModes: Array<'sales' | 'warehouse'>;
  onOpenDetail: (orderId: number, mode: 'sales' | 'warehouse') => void;
  onCreateSalesOrder?: () => void;
};

const SALES_STATUS = 10;
const WAREHOUSE_VALIDATION_STATUS = 30;
const WAREHOUSE_DELIVERY_STATUS = 45;

export function OrdersListScreen({
  availableModes,
  onOpenDetail,
  onCreateSalesOrder,
}: OrdersListScreenProps) {
  const { token } = useAuth();
  const resolvedModes = useMemo<Array<'sales' | 'warehouse'>>(
    () => (availableModes.length > 0 ? availableModes : ['sales']),
    [availableModes],
  );
  const [mode, setMode] = useState<'sales' | 'warehouse'>(resolvedModes[0]);
  const [orders, setOrders] = useState<PedidoListItem[]>([]);
  const [search, setSearch] = useState('');
  const [warehouseStage, setWarehouseStage] = useState<'validation' | 'delivery'>('validation');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedModes.includes(mode)) {
      setMode(resolvedModes[0]);
    }
  }, [mode, resolvedModes]);

  const statusFilter =
    mode === 'sales'
      ? SALES_STATUS
      : warehouseStage === 'validation'
        ? WAREHOUSE_VALIDATION_STATUS
        : WAREHOUSE_DELIVERY_STATUS;

  const title = useMemo(
    () =>
      mode === 'sales'
        ? 'Pedidos de Ventas'
        : warehouseStage === 'validation'
          ? 'Almacén: Validación'
          : 'Almacén: Ruta y entrega',
    [mode, warehouseStage],
  );

  const fetchOrders = useCallback(
    async (refreshing = false, searchText = '') => {
      if (!token) {
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await ordersApi.list(token, {
          search: searchText,
          status: statusFilter,
        });
        setOrders(response.items);
        setErrorMessage(null);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('No fue posible cargar pedidos.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, token],
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false, '');
    }, [fetchOrders]),
  );

  return (
    <View style={styles.container}>
      {resolvedModes.length > 1 ? (
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, mode === 'sales' && styles.modeButtonActive]}
            onPress={() => setMode('sales')}
          >
            <Text style={[styles.modeButtonLabel, mode === 'sales' && styles.modeButtonLabelActive]}>
              Ventas
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'warehouse' && styles.modeButtonActive]}
            onPress={() => setMode('warehouse')}
          >
            <Text
              style={[styles.modeButtonLabel, mode === 'warehouse' && styles.modeButtonLabelActive]}
            >
              Almacén
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {mode === 'sales' && onCreateSalesOrder ? (
          <Pressable onPress={onCreateSalesOrder} style={styles.createButton}>
            <Text style={styles.createButtonLabel}>+ Nuevo pedido</Text>
          </Pressable>
        ) : null}
      </View>

      {mode === 'warehouse' ? (
        <View style={styles.stageRow}>
          <Pressable
            style={[styles.stageButton, warehouseStage === 'validation' && styles.stageButtonActive]}
            onPress={() => setWarehouseStage('validation')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                warehouseStage === 'validation' && styles.stageButtonLabelActive,
              ]}
            >
              Validación
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stageButton, warehouseStage === 'delivery' && styles.stageButtonActive]}
            onPress={() => setWarehouseStage('delivery')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                warehouseStage === 'delivery' && styles.stageButtonLabelActive,
              ]}
            >
              Ruta / Entrega
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente, pedido o vendedor"
          placeholderTextColor="#8fa0af"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => fetchOrders(false, search.trim())}
        />
        <Pressable style={styles.searchButton} onPress={() => fetchOrders(false, search.trim())}>
          <Text style={styles.searchButtonLabel}>Buscar</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchOrders(true, search.trim())}
              tintColor={palette.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => onOpenDetail(item.id, mode)} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No hay pedidos en esta fase"
              subtitle={
                mode === 'sales'
                  ? 'Ajusta la búsqueda o crea un pedido nuevo desde Ventas.'
                  : warehouseStage === 'validation'
                    ? 'No hay pedidos pendientes de validación de almacén.'
                    : 'No hay pedidos en almacén final para ruta/entrega.'
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  modeButtonLabel: {
    color: palette.navy,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  modeButtonLabelActive: {
    color: '#fff',
    fontFamily: typography.semiBold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  title: {
    flex: 1,
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 22,
  },
  createButton: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  stageRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  stageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  stageButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  stageButtonLabel: {
    color: palette.navy,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  stageButtonLabelActive: {
    color: '#fff',
    fontFamily: typography.semiBold,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontFamily: typography.regular,
  },
  searchButton: {
    backgroundColor: palette.navy,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  searchButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  error: {
    color: palette.danger,
    fontFamily: typography.medium,
    marginBottom: 8,
    fontSize: 12,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
});

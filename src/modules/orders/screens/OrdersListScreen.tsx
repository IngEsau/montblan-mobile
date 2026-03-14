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
import { CxcStage, OrderMode, WarehouseStage } from '../../../navigation/types';

type OrdersListScreenProps = {
  availableModes: OrderMode[];
  onOpenDetail: (orderId: number, mode: OrderMode) => void;
  onCreateSalesOrder?: () => void;
  initialMode?: OrderMode;
  initialWarehouseStage?: WarehouseStage;
  initialCxcStage?: CxcStage;
};

const SALES_STATUS = 10;
const AUTHORIZATION_STATUS = 20;
const WAREHOUSE_STATUS = 30;
const BILLING_STATUS = 45;
const FINISHED_STATUS = 50;
const VISIBLE_STATUSES = [SALES_STATUS, AUTHORIZATION_STATUS, WAREHOUSE_STATUS, BILLING_STATUS, FINISHED_STATUS];

export function OrdersListScreen({
  availableModes,
  onOpenDetail,
  onCreateSalesOrder,
  initialMode,
  initialWarehouseStage,
  initialCxcStage,
}: OrdersListScreenProps) {
  const { token } = useAuth();
  const resolvedModes = useMemo<OrderMode[]>(
    () => (availableModes.length > 0 ? availableModes : ['sales']),
    [availableModes],
  );
  const resolvedInitialMode = useMemo<OrderMode>(
    () => (initialMode && resolvedModes.includes(initialMode) ? initialMode : resolvedModes[0]),
    [initialMode, resolvedModes],
  );
  const [mode, setMode] = useState<OrderMode>(resolvedInitialMode);
  const [orders, setOrders] = useState<PedidoListItem[]>([]);
  const [search, setSearch] = useState('');
  const resolvedInitialWarehouseStage = useMemo<WarehouseStage>(
    () => initialWarehouseStage || 'all',
    [initialWarehouseStage],
  );
  const [warehouseStage, setWarehouseStage] = useState<WarehouseStage>(resolvedInitialWarehouseStage);
  const resolvedInitialCxcStage = useMemo<CxcStage>(() => initialCxcStage || 'all', [initialCxcStage]);
  const [cxcStage, setCxcStage] = useState<CxcStage>(resolvedInitialCxcStage);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedModes.includes(mode)) {
      setMode(resolvedModes[0]);
    }
  }, [mode, resolvedModes]);

  useEffect(() => {
    if (initialMode && resolvedModes.includes(initialMode)) {
      setMode(initialMode);
    }
  }, [initialMode, resolvedModes]);

  useEffect(() => {
    if (initialWarehouseStage) {
      setWarehouseStage(initialWarehouseStage);
    }
  }, [initialWarehouseStage]);

  useEffect(() => {
    if (initialCxcStage) {
      setCxcStage(initialCxcStage);
    }
  }, [initialCxcStage]);

  const statusFilter =
    mode === 'sales'
      ? undefined
      : mode === 'cxc'
        ? cxcStage === 'authorization'
          ? AUTHORIZATION_STATUS
          : cxcStage === 'billing'
            ? BILLING_STATUS
            : undefined
        : warehouseStage === 'processing'
          ? WAREHOUSE_STATUS
          : warehouseStage === 'finished'
            ? FINISHED_STATUS
            : undefined;

  const title = useMemo(
    () =>
      mode === 'sales'
        ? 'Pedidos de Ventas'
        : mode === 'cxc'
          ? cxcStage === 'authorization'
            ? 'CXC: Autorización'
            : cxcStage === 'billing'
              ? 'CXC: Facturación'
              : 'CXC: Todos'
        : warehouseStage === 'finished'
            ? 'Pedidos terminados'
            : warehouseStage === 'processing'
              ? 'Almacén: Surtido'
              : 'Almacén: Todos',
    [cxcStage, mode, warehouseStage],
  );

  const modeButtons = useMemo(
    () =>
      resolvedModes.map((key) => ({
        key,
        label: key === 'sales' ? 'Ventas' : key === 'warehouse' ? 'Almacén' : 'CXC',
      })),
    [resolvedModes],
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
        const visibleItems = response.items.filter((item) => VISIBLE_STATUSES.includes(item.status));
        setOrders(visibleItems);
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

  useEffect(() => {
    fetchOrders(false, '');
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false, '');
    }, [fetchOrders]),
  );

  return (
    <View style={styles.container}>
      {resolvedModes.length > 1 ? (
        <View style={styles.modeRow}>
          {modeButtons.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.modeButton, mode === item.key && styles.modeButtonActive]}
              onPress={() => setMode(item.key)}
            >
              <Text style={[styles.modeButtonLabel, mode === item.key && styles.modeButtonLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
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
            style={[styles.stageButton, warehouseStage === 'all' && styles.stageButtonActive]}
            onPress={() => setWarehouseStage('all')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                warehouseStage === 'all' && styles.stageButtonLabelActive,
              ]}
            >
              Todos
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stageButton, warehouseStage === 'processing' && styles.stageButtonActive]}
            onPress={() => setWarehouseStage('processing')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                warehouseStage === 'processing' && styles.stageButtonLabelActive,
              ]}
            >
              Surtido
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stageButton, warehouseStage === 'finished' && styles.stageButtonActive]}
            onPress={() => setWarehouseStage('finished')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                warehouseStage === 'finished' && styles.stageButtonLabelActive,
              ]}
            >
              Terminado
            </Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'cxc' ? (
        <View style={styles.stageRow}>
          <Pressable
            style={[styles.stageButton, cxcStage === 'all' && styles.stageButtonActive]}
            onPress={() => setCxcStage('all')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                cxcStage === 'all' && styles.stageButtonLabelActive,
              ]}
            >
              Todos
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stageButton, cxcStage === 'authorization' && styles.stageButtonActive]}
            onPress={() => setCxcStage('authorization')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                cxcStage === 'authorization' && styles.stageButtonLabelActive,
              ]}
            >
              Autorización
            </Text>
          </Pressable>
          <Pressable
            style={[styles.stageButton, cxcStage === 'billing' && styles.stageButtonActive]}
            onPress={() => setCxcStage('billing')}
          >
            <Text
              style={[
                styles.stageButtonLabel,
                cxcStage === 'billing' && styles.stageButtonLabelActive,
              ]}
            >
              Facturación
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
                  : mode === 'cxc'
                    ? cxcStage === 'authorization'
                      ? 'No hay pedidos pendientes de autorización.'
                      : cxcStage === 'billing'
                        ? 'No hay pedidos pendientes de facturación.'
                        : 'No hay pedidos visibles para CXC.'
                  : warehouseStage === 'finished'
                    ? 'No hay pedidos en fase Terminado.'
                    : warehouseStage === 'processing'
                      ? 'No hay pedidos pendientes de surtido en almacén.'
                      : 'No hay pedidos visibles para almacén.'
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

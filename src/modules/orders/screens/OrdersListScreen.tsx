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
import { OrderCard } from '../components/OrderCard';
import { ordersApi } from '../services/ordersApi';
import { PedidoListItem } from '../types';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../../shared/api/http';
import { EmptyState } from '../../../shared/components/EmptyState';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';

type OrdersListScreenProps = {
  mode: 'sales' | 'warehouse';
  onOpenDetail: (orderId: number) => void;
  onCreateSalesOrder?: () => void;
};

const SALES_STATUS = 10;
const WAREHOUSE_STATUS = 30;

export function OrdersListScreen({ mode, onOpenDetail, onCreateSalesOrder }: OrdersListScreenProps) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<PedidoListItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusFilter = mode === 'sales' ? SALES_STATUS : WAREHOUSE_STATUS;

  const title = useMemo(
    () => (mode === 'sales' ? 'Pedidos de Ventas' : 'Pedidos de Almacén'),
    [mode],
  );

  const fetchOrders = useCallback(
    async (refreshing = false) => {
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
          search: search.trim(),
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
    [search, statusFilter, token],
  );

  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {mode === 'sales' ? (
          <Pressable onPress={onCreateSalesOrder} style={styles.createButton}>
            <Text style={styles.createButtonLabel}>+ Nuevo pedido</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente, pedido o vendedor"
          placeholderTextColor="#8fa0af"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => fetchOrders(false)}
        />
        <Pressable style={styles.searchButton} onPress={() => fetchOrders(false)}>
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
              onRefresh={() => fetchOrders(true)}
              tintColor={palette.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <OrderCard order={item} onPress={() => onOpenDetail(item.id)} />}
          ListEmptyComponent={
            <EmptyState
              title="No hay pedidos en esta fase"
              subtitle="Ajusta la búsqueda o crea un pedido nuevo desde Ventas."
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

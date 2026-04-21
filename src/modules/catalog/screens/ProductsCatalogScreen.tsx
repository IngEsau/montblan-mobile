import { useCallback, useState } from 'react';
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
import { useAuth } from '../../auth/AuthContext';
import { catalogApi } from '../services/catalogApi';
import { Producto } from '../types';
import { ApiError } from '../../../shared/api/http';
import { EmptyState } from '../../../shared/components/EmptyState';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatMoney } from '../../../shared/utils/formatters';

function normalizeRole(role: string | null | undefined) {
  return String(role ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function formatInventoryValue(value: number | null | undefined) {
  if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) {
    return '0';
  }

  const numericValue = Number(value);
  return Math.abs(numericValue - Math.round(numericValue)) < 0.0001
    ? String(Math.round(numericValue))
    : numericValue.toFixed(2);
}

export function ProductsCatalogScreen() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Producto[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const normalizedRole = normalizeRole(user?.rol);
  const isAdmin = normalizedRole.includes('THECREATOR') || normalizedRole.includes('ADMIN') || normalizedRole.includes('SUPER');

  const fetchProducts = useCallback(
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
        const response = await catalogApi.listProductosAll(token, searchText, {
          onlyWithName: true,
          onlyWithPrice: true,
          includeOutOfLine: false,
          perPage: 100,
        });

        setItems(response.items);
        setErrorMessage(null);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('No fue posible cargar el catálogo de productos.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      fetchProducts(false, '');
    }, [fetchProducts]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Productos</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por clave o nombre"
          placeholderTextColor="#8fa0af"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => fetchProducts(false, search.trim())}
        />
        <Pressable style={styles.searchButton} onPress={() => fetchProducts(false, search.trim())}>
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
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchProducts(true, search.trim())}
              tintColor={palette.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.topRow}>
                <Text style={styles.code}>{item.codigo || '-'}</Text>
                <Text style={styles.price}>{formatMoney(item.precio_venta)}</Text>
              </View>

              <Text style={styles.name}>{item.nombre || 'Sin nombre'}</Text>
              <View style={styles.inventoryGrid}>
                <Text style={styles.stock}>FISICO: {formatInventoryValue(item.inventario_fisico ?? item.inventario_cmb)}</Text>
                <Text style={styles.stock}>SA: {formatInventoryValue(item.inventario_sa)}</Text>
                <Text style={styles.stock}>ML: {formatInventoryValue(item.cantidad_negativa_ml)}</Text>
                <Text style={styles.stock}>SAE: {formatInventoryValue(item.inventario_sae)}</Text>
              </View>
              {isAdmin ? (
                <View style={styles.adminMeta}>
                  <Text style={styles.adminMetaText}>Categoría: {item.categoria || '-'}</Text>
                  <Text style={styles.adminMetaText}>Largo: {item.largo ?? '-'}</Text>
                  <Text style={styles.adminMetaText}>Mín: {item.minimo ?? '-'}</Text>
                  <Text style={styles.adminMetaText}>Máx: {item.maximo ?? '-'}</Text>
                  <Text style={styles.adminMetaText}>
                    Precio especial: {item.precio_venta_especial !== null && typeof item.precio_venta_especial !== 'undefined'
                      ? formatMoney(item.precio_venta_especial)
                      : '-'}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No hay productos"
              subtitle="Ajusta la búsqueda o valida el catálogo en inventario."
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
  title: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 22,
    marginBottom: 10,
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
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  code: {
    flex: 1,
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  price: {
    color: palette.primaryDark,
    fontFamily: typography.bold,
    fontSize: 14,
  },
  name: {
    marginTop: 8,
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
  stock: {
    marginTop: 3,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
  inventoryGrid: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminMeta: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: 4,
  },
  adminMetaText: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
});

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

export function ProductsCatalogScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Producto[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
              <Text style={styles.stock}>
                Inventario SA: {item.inventario_sa ?? 0} | CMB: {item.inventario_cmb ?? 0}
              </Text>
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
});

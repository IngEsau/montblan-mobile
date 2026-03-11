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
import { Cliente } from '../types';
import { ApiError } from '../../../shared/api/http';
import { EmptyState } from '../../../shared/components/EmptyState';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatMoney } from '../../../shared/utils/formatters';

export function ClientsCatalogScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchClients = useCallback(
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
        const response = await catalogApi.listClientesAll(token, searchText, {
          perPage: 100,
        });

        setItems(response.items);
        setErrorMessage(null);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('No fue posible cargar el catálogo de clientes.');
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
      fetchClients(false, '');
    }, [fetchClients]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clientes</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por clave, nombre o teléfono"
          placeholderTextColor="#8fa0af"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => fetchClients(false, search.trim())}
        />
        <Pressable style={styles.searchButton} onPress={() => fetchClients(false, search.trim())}>
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
              onRefresh={() => fetchClients(true, search.trim())}
              tintColor={palette.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.topRow}>
                <Text style={styles.code}>{item.clave || '-'}</Text>
                <Text style={styles.balance}>{formatMoney(item.saldo)}</Text>
              </View>

              <Text style={styles.name}>{item.nombre || '-'}</Text>
              <Text style={styles.detail}>Comercial: {item.nombre_comercial || '-'}</Text>
              <Text style={styles.detail}>Teléfono: {item.telefono || '-'}</Text>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No hay clientes"
              subtitle="Ajusta la búsqueda o valida el catálogo de clientes en el sistema web."
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
  balance: {
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
  detail: {
    marginTop: 3,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
});

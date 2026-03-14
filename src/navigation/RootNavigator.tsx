import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import { useAuth } from '../modules/auth/AuthContext';
import { OrdersListScreen } from '../modules/orders/screens/OrdersListScreen';
import { OrderDetailScreen } from '../modules/orders/screens/OrderDetailScreen';
import { SalesOrderFormScreen } from '../modules/orders/screens/SalesOrderFormScreen';
import { WarehouseOrderFormScreen } from '../modules/orders/screens/WarehouseOrderFormScreen';
import { CxcOrderFormScreen } from '../modules/orders/screens/CxcOrderFormScreen';
import { ProductsCatalogScreen } from '../modules/catalog/screens/ProductsCatalogScreen';
import { ClientsCatalogScreen } from '../modules/catalog/screens/ClientsCatalogScreen';
import { AppTabParamList, OrderMode, RootStackParamList } from './types';
import { palette } from '../shared/theme/palette';
import { typography } from '../shared/theme/typography';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

type TabsNavigatorProps = {
  rootNavigation: NativeStackNavigationProp<RootStackParamList>;
};

function normalizeRole(role: string | null | undefined) {
  return String(role ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function TabsNavigator({ rootNavigation }: TabsNavigatorProps) {
  const { logout, user } = useAuth();
  const insets = useSafeAreaInsets();
  const role = normalizeRole(user?.rol);
  const permissionFlags = user?.permissions;
  const hasPermissionFlags =
    permissionFlags &&
    typeof permissionFlags.can_sales === 'boolean' &&
    typeof permissionFlags.can_warehouse === 'boolean' &&
    typeof permissionFlags.can_cxc === 'boolean';

  const hasRole = role.trim().length > 0;
  const isAdmin = role.includes('THECREATOR') || role.includes('ADMIN') || role.includes('SUPER');
  const canSales = hasPermissionFlags
    ? Boolean(permissionFlags.can_sales)
    : !hasRole || isAdmin || role.includes('VENTAS') || role.includes('VENDEDOR');
  const canWarehouse = hasPermissionFlags
    ? Boolean(permissionFlags.can_warehouse)
    : !hasRole || isAdmin || role.includes('ALMACEN');
  const canCxc = hasPermissionFlags
    ? Boolean(permissionFlags.can_cxc)
    : isAdmin || role.includes('CTAS') || role.includes('COBRAR') || role.includes('CXC');
  const availableModes: OrderMode[] = [];

  if (canSales) {
    availableModes.push('sales');
  }

  if (canWarehouse) {
    availableModes.push('warehouse');
  }

  if (canCxc) {
    availableModes.push('cxc');
  }

  if (availableModes.length === 0) {
    availableModes.push('sales');
  }

  const tabBarBottomPadding = Math.max(insets.bottom, 8);
  const tabBarHeight = 64 + tabBarBottomPadding;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: palette.navy,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontFamily: typography.semiBold,
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#708495',
        tabBarStyle: {
          borderTopColor: '#d5dee7',
          height: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingTop: 8,
          overflow: 'visible',
        },
        tabBarLabelStyle: {
          fontFamily: typography.medium,
          fontSize: 11,
          lineHeight: 16,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          minHeight: 48,
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={
              route.name === 'Pedidos'
                ? 'receipt-outline'
                : route.name === 'Productos'
                  ? 'cube-outline'
                  : 'people-outline'
            }
            color={color}
            size={size}
          />
        ),
        headerRight: () => (
          <Pressable onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={16} color="#fff" />
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        ),
      })}
    >
      <Tab.Screen name="Pedidos" options={{ title: 'Pedidos' }}>
        {({ route }) => (
          <OrdersListScreen
            availableModes={availableModes}
            initialMode={route.params?.mode}
            initialWarehouseStage={route.params?.warehouseStage}
            initialCxcStage={route.params?.cxcStage}
            onOpenDetail={(orderId, mode) =>
              rootNavigation.navigate('PedidoDetalle', {
                orderId,
                mode,
              })
            }
            onCreateSalesOrder={canSales ? () => rootNavigation.navigate('NuevoPedidoVenta') : undefined}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Productos" component={ProductsCatalogScreen} options={{ title: 'Productos' }} />

      <Tab.Screen name="Clientes" component={ClientsCatalogScreen} options={{ title: 'Clientes' }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: palette.navy,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontFamily: typography.semiBold,
        },
      }}
    >
      <RootStack.Screen
        name="Tabs"
        options={{ headerShown: false }}
        children={({ navigation }) => <TabsNavigator rootNavigation={navigation} />}
      />
      <RootStack.Screen
        name="PedidoDetalle"
        options={{ title: 'Detalle de pedido' }}
        children={({ route, navigation }) => (
          <OrderDetailScreen
            orderId={route.params.orderId}
            mode={route.params.mode}
            onOpenWarehouseCapture={(orderId) => navigation.navigate('CapturaAlmacen', { orderId })}
            onEditCaptureOrder={(orderId) => navigation.navigate('EditarPedidoVenta', { orderId })}
            onOpenCxcOperation={(orderId) => navigation.navigate('OperacionCxc', { orderId })}
            onOpenFinishedOrders={() =>
              navigation.navigate('Tabs', {
                screen: 'Pedidos',
                params: { mode: 'warehouse', warehouseStage: 'finished' },
              })
            }
          />
        )}
      />
      <RootStack.Screen
        name="OperacionCxc"
        options={{ title: 'Operación CXC' }}
        children={({ route, navigation }) => (
          <CxcOrderFormScreen
            orderId={route.params.orderId}
            onDone={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }

              navigation.navigate('Tabs');
            }}
          />
        )}
      />
      <RootStack.Screen
        name="NuevoPedidoVenta"
        options={{ title: 'Alta de pedido (Ventas)' }}
        children={({ navigation }) => (
          <SalesOrderFormScreen
            onCreated={(orderId) => {
              navigation.replace('PedidoDetalle', {
                orderId,
                mode: 'sales',
              });
            }}
          />
        )}
      />
      <RootStack.Screen
        name="EditarPedidoVenta"
        options={{ title: 'Editar pedido (Captura)' }}
        children={({ route, navigation }) => (
          <SalesOrderFormScreen
            orderId={route.params.orderId}
            onCreated={(orderId) => {
              navigation.replace('PedidoDetalle', {
                orderId,
                mode: 'sales',
              });
            }}
          />
        )}
      />
      <RootStack.Screen
        name="CapturaAlmacen"
        options={{ title: 'Captura de almacén' }}
        children={({ route, navigation }) => (
          <WarehouseOrderFormScreen
            orderId={route.params.orderId}
            onDone={(orderId) =>
              navigation.replace('PedidoDetalle', {
                orderId,
                mode: 'warehouse',
              })
            }
          />
        )}
      />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const { isLoading, token, user } = useAuth();
  const navigationKey = token ? `app-${user?.id ?? '0'}` : 'auth';
  const linking = {
    enabled: false,
    prefixes: [],
  };
  const documentTitle = {
    enabled: true,
    formatter: (options: { title?: string } | undefined) =>
      options?.title ? `Montblan · ${options.title}` : 'Montblan',
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer key={navigationKey} linking={linking} documentTitle={documentTitle}>
      {token ? <AppNavigator /> : <LoginScreen />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  logoutText: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});

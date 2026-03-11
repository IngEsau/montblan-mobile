import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import { useAuth } from '../modules/auth/AuthContext';
import { OrdersListScreen } from '../modules/orders/screens/OrdersListScreen';
import { OrderDetailScreen } from '../modules/orders/screens/OrderDetailScreen';
import { SalesOrderFormScreen } from '../modules/orders/screens/SalesOrderFormScreen';
import { WarehouseOrderFormScreen } from '../modules/orders/screens/WarehouseOrderFormScreen';
import { WarehouseDeliveryScreen } from '../modules/orders/screens/WarehouseDeliveryScreen';
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
  const role = normalizeRole(user?.rol);
  const hasRole = role.trim().length > 0;
  const isAdmin = role.includes('THECREATOR') || role.includes('ADMIN') || role.includes('SUPER');
  const canSales = !hasRole || isAdmin || role.includes('VENTAS') || role.includes('VENDEDOR');
  const canWarehouse = !hasRole || isAdmin || role.includes('ALMACEN');
  const canCxc = isAdmin || role.includes('CTAS') || role.includes('COBRAR') || role.includes('CXC');
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
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: typography.medium,
          fontSize: 12,
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
          <Pressable onPress={logout}>
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        ),
      })}
    >
      <Tab.Screen name="Pedidos" options={{ title: 'Pedidos' }}>
        {() => (
          <OrdersListScreen
            availableModes={availableModes}
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
        children={({ route, navigation }) =>
          route.params.mode === 'cxc' ? (
            <CxcOrderFormScreen
              orderId={route.params.orderId}
              onDone={(orderId) =>
                navigation.replace('PedidoDetalle', {
                  orderId,
                  mode: 'warehouse',
                })
              }
            />
          ) : (
            <OrderDetailScreen
              orderId={route.params.orderId}
              mode={route.params.mode}
              onOpenWarehouseCapture={(orderId) => navigation.navigate('CapturaAlmacen', { orderId })}
              onOpenWarehouseDelivery={(orderId) => navigation.navigate('CapturaEntregaAlmacen', { orderId })}
              onEditCaptureOrder={(orderId) => navigation.navigate('EditarPedidoVenta', { orderId })}
            />
          )
        }
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
      <RootStack.Screen
        name="CapturaEntregaAlmacen"
        options={{ title: 'Ruta y fecha de entrega' }}
        children={({ route, navigation }) => (
          <WarehouseDeliveryScreen
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
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return <NavigationContainer>{token ? <AppNavigator /> : <LoginScreen />}</NavigationContainer>;
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
});

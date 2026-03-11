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
import { AppTabParamList, RootStackParamList } from './types';
import { palette } from '../shared/theme/palette';
import { typography } from '../shared/theme/typography';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

type TabsNavigatorProps = {
  rootNavigation: NativeStackNavigationProp<RootStackParamList>;
};

function TabsNavigator({ rootNavigation }: TabsNavigatorProps) {
  const { logout } = useAuth();

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
            name={route.name === 'Ventas' ? 'receipt-outline' : 'cube-outline'}
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
      <Tab.Screen name="Ventas" options={{ title: 'Ventas' }}>
        {() => (
          <OrdersListScreen
            mode="sales"
            onOpenDetail={(orderId) =>
              rootNavigation.navigate('PedidoDetalle', {
                orderId,
                mode: 'sales',
              })
            }
            onCreateSalesOrder={() => rootNavigation.navigate('NuevoPedidoVenta')}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Almacen" options={{ title: 'Almacén' }}>
        {() => (
          <OrdersListScreen
            mode="warehouse"
            onOpenDetail={(orderId) =>
              rootNavigation.navigate('PedidoDetalle', {
                orderId,
                mode: 'warehouse',
              })
            }
          />
        )}
      </Tab.Screen>
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

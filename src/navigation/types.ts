import { NavigatorScreenParams } from '@react-navigation/native';

export type OrderMode = 'sales' | 'warehouse' | 'cxc';
export type WarehouseStage = 'validation' | 'delivery' | 'finished';

export type AppTabParamList = {
  Pedidos:
    | {
        mode?: OrderMode;
        warehouseStage?: WarehouseStage;
      }
    | undefined;
  Productos: undefined;
  Clientes: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<AppTabParamList> | undefined;
  PedidoDetalle: { orderId: number; mode: OrderMode };
  NuevoPedidoVenta: undefined;
  EditarPedidoVenta: { orderId: number };
  CapturaAlmacen: { orderId: number };
  CapturaEntregaAlmacen: { orderId: number };
};

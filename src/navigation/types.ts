import { NavigatorScreenParams } from '@react-navigation/native';

export type OrderMode = 'sales' | 'warehouse' | 'cxc';
export type WarehouseStage = 'all' | 'processing' | 'postdated' | 'finished';
export type CxcStage = 'all' | 'authorization' | 'billing';

export type AppTabParamList = {
  Pedidos:
    | {
        mode?: OrderMode;
        warehouseStage?: WarehouseStage;
        cxcStage?: CxcStage;
      }
    | undefined;
  Productos: undefined;
  Clientes: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<AppTabParamList> | undefined;
  PedidoDetalle: { orderId: number; mode: OrderMode };
  OperacionCxc: { orderId: number };
  NuevoPedidoVenta: undefined;
  EditarPedidoVenta: { orderId: number };
  CapturaAlmacen: { orderId: number };
};

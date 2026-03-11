export type OrderMode = 'sales' | 'warehouse' | 'cxc';

export type AppTabParamList = {
  Pedidos: undefined;
  Productos: undefined;
  Clientes: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  PedidoDetalle: { orderId: number; mode: OrderMode };
  NuevoPedidoVenta: undefined;
  EditarPedidoVenta: { orderId: number };
  CapturaAlmacen: { orderId: number };
  CapturaEntregaAlmacen: { orderId: number };
};

export type AppTabParamList = {
  Pedidos: undefined;
  Productos: undefined;
  Clientes: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  PedidoDetalle: { orderId: number; mode: 'sales' | 'warehouse' };
  NuevoPedidoVenta: undefined;
  EditarPedidoVenta: { orderId: number };
  CapturaAlmacen: { orderId: number };
  CapturaEntregaAlmacen: { orderId: number };
};

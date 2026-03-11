export type AppTabParamList = {
  Ventas: undefined;
  Almacen: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  PedidoDetalle: { orderId: number; mode: 'sales' | 'warehouse' };
  NuevoPedidoVenta: undefined;
  CapturaAlmacen: { orderId: number };
};

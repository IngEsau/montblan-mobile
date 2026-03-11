import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../../../shared/api/http';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatMoney } from '../../../shared/utils/formatters';
import { useAuth } from '../../auth/AuthContext';
import { catalogApi } from '../../catalog/services/catalogApi';
import { Cliente, Producto } from '../../catalog/types';
import { ordersApi } from '../services/ordersApi';

type DraftLine = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: string;
  descripcion: string;
};

type SalesOrderFormScreenProps = {
  onCreated: (orderId: number) => void;
  orderId?: number;
};

export function SalesOrderFormScreen({ onCreated, orderId }: SalesOrderFormScreenProps) {
  const { token, user } = useAuth();
  const isEditMode = typeof orderId === 'number';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [productoModalOpen, setProductoModalOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [noPedido, setNoPedido] = useState('');
  const [clienteCondiciones, setClienteCondiciones] = useState('');
  const [clienteCorreo, setClienteCorreo] = useState('');
  const [clienteRfc, setClienteRfc] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [direccion, setDireccion] = useState('');
  const [numInt, setNumInt] = useState('');
  const [numExt, setNumExt] = useState('');
  const [referenciaDireccion, setReferenciaDireccion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState<10 | 20>(10);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFormData = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingCatalogs(true);
    try {
      const [clientesResponse, productosResponse, pedidoResponse] = await Promise.all([
        catalogApi.listClientesAll(token),
        catalogApi.listProductosAll(token, '', {
          includeOutOfLine: false,
          onlyWithName: true,
          onlyWithPrice: true,
          perPage: 100,
        }),
        isEditMode && orderId ? ordersApi.detail(token, orderId) : Promise.resolve(null),
      ]);

      setClientes(clientesResponse.items);
      setProductos(productosResponse.items);

      if (pedidoResponse?.item) {
        const item = pedidoResponse.item;

        setNoPedido(item.no_pedido || '');
        setTipoComprobante(item.tipo_fac_rem === 20 ? 20 : 10);
        setClienteCondiciones(item.cliente_condiciones || '');
        setClienteCorreo(item.cliente_correo || '');
        setClienteRfc(item.cliente_rfc || '');
        setUsoCfdi(item.uso_cfdi || '');
        setObservaciones(item.observaciones || '');
        setCodigoPostal(item.direccion?.codigo_postal || '');
        setDireccion(item.direccion?.direccion || '');
        setNumInt(item.direccion?.num_ext || '');
        setNumExt(item.direccion?.num_int || '');
        setReferenciaDireccion(item.direccion?.referencia || '');

        const selectedFromCatalog = clientesResponse.items.find((cliente) => cliente.clave === item.no_cliente);
        if (selectedFromCatalog) {
          setSelectedCliente(selectedFromCatalog);
          if (!item.direccion?.direccion) {
            setDireccion((selectedFromCatalog.calle || '').trim());
          }
        } else {
          setSelectedCliente({
            id: -item.id,
            clave: item.no_cliente || '',
            nombre: item.cliente_razon_social || 'Cliente',
            nombre_comercial: item.cliente_razon_social || null,
            calle: item.direccion?.direccion || null,
            telefono: item.cliente_telefono || null,
            saldo: 0,
          });
        }

        const nowSeed = Date.now();
        setLines(
          item.detalle.map((line, index) => {
            const code = line.codigo || '';
            const catalogProduct = productosResponse.items.find((producto) => producto.codigo === code);
            const lineName = catalogProduct?.nombre || line.descripcion || code || 'Producto';
            return {
              id: `edit-${line.id}-${nowSeed}-${index}`,
              codigo: code,
              nombre: lineName,
              precio: Number(line.precio || 0),
              cantidad: String(line.cantidad || 0),
              descripcion: line.descripcion || lineName,
            };
          }),
        );
      }

      setErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible cargar catálogos de cliente y producto.');
      }
    } finally {
      setLoadingCatalogs(false);
    }
  }, [isEditMode, orderId, token]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => {
      const qty = Number(line.cantidad);
      if (!qty || qty <= 0) {
        return acc;
      }

      return acc + qty * line.precio;
    }, 0);

    const iva = tipoComprobante === 10 ? subtotal * 0.16 : 0;
    return {
      subtotal,
      iva,
      total: subtotal + iva,
    };
  }, [lines, tipoComprobante]);

  const addProduct = (producto: Producto) => {
    const line: DraftLine = {
      id: `${producto.id}-${Date.now()}`,
      codigo: producto.codigo,
      nombre: producto.nombre || 'Producto sin nombre',
      precio: Number(producto.precio_venta || 0),
      cantidad: '1',
      descripcion: producto.nombre || producto.codigo,
    };

    setLines((prev) => [...prev, line]);
    setProductoModalOpen(false);
  };

  const updateLine = (lineId: string, field: keyof DraftLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        if (field === 'precio') {
          return {
            ...line,
            precio: Number(value || 0),
          };
        }

        return {
          ...line,
          [field]: value,
        };
      }),
    );
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const validateForm = () => {
    if (!selectedCliente) {
      return 'Debes seleccionar un cliente.';
    }

    if (!noPedido.trim()) {
      return 'Debes capturar el número de pedido.';
    }

    if (!direccion.trim()) {
      return 'Debes capturar la dirección del pedido.';
    }

    if (lines.length === 0) {
      return 'Debes agregar al menos un producto.';
    }

    for (const line of lines) {
      const qty = Number(line.cantidad);
      if (!qty || qty <= 0) {
        return `Cantidad inválida en producto ${line.codigo}.`;
      }

      if (line.precio < 0) {
        return `Precio inválido en producto ${line.codigo}.`;
      }
    }

    return null;
  };

  const submit = async () => {
    if (!token || isSubmitting) {
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!selectedCliente) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        pedido: {
          no_cliente: selectedCliente.clave,
          no_pedido: noPedido.trim(),
          cliente_razon_social: selectedCliente.nombre_comercial || selectedCliente.nombre,
          cliente_telefono: selectedCliente.telefono || '',
          cliente_correo: clienteCorreo.trim() || undefined,
          cliente_rfc: clienteRfc.trim() || undefined,
          uso_cfdi: usoCfdi.trim() || undefined,
          cliente_condiciones: clienteCondiciones.trim() || undefined,
          tipo_fac_rem: tipoComprobante,
          observaciones,
          vendedor: user?.username || 'movil',
        },
        direccion: {
          direccion: direccion.trim(),
          num_ext: numInt.trim() || undefined,
          num_int: numExt.trim() || undefined,
          referencia: referenciaDireccion.trim() || undefined,
          codigo_postal: codigoPostal.trim() || undefined,
        },
        detalle: lines.map((line) => {
          const qty = Number(line.cantidad);
          const importe = Number((qty * line.precio).toFixed(2));

          return {
            codigo: line.codigo,
            cantidad: qty,
            precio: Number(line.precio.toFixed(2)),
            descripcion: line.descripcion,
            importe,
          };
        }),
      };

      const response =
        isEditMode && orderId
          ? await ordersApi.update(token, orderId, payload)
          : await ordersApi.create(token, payload);
      Alert.alert(
        isEditMode ? 'Pedido actualizado' : 'Pedido creado',
        response.message || (isEditMode ? 'Pedido actualizado correctamente.' : 'Pedido guardado correctamente.'),
      );
      onCreated(response.item.id);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible crear el pedido.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingCatalogs) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

    return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEditMode ? 'Editar pedido de venta' : 'Nuevo pedido de venta'}</Text>

      <Text style={styles.label}>Cliente</Text>
      <Pressable style={styles.selector} onPress={() => setClienteModalOpen(true)}>
        <Text style={styles.selectorValue}>
          {selectedCliente
            ? `${selectedCliente.clave} - ${selectedCliente.nombre_comercial || selectedCliente.nombre}`
            : 'Seleccionar cliente'}
        </Text>
      </Pressable>

      <Text style={styles.label}>No pedido</Text>
      <TextInput
        value={noPedido}
        onChangeText={setNoPedido}
        placeholder="Ej. 1001"
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Tipo de comprobante</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, tipoComprobante === 10 && styles.toggleButtonActive]}
          onPress={() => setTipoComprobante(10)}
        >
          <Text style={[styles.toggleLabel, tipoComprobante === 10 && styles.toggleLabelActive]}>Factura</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, tipoComprobante === 20 && styles.toggleButtonActive]}
          onPress={() => setTipoComprobante(20)}
        >
          <Text style={[styles.toggleLabel, tipoComprobante === 20 && styles.toggleLabelActive]}>Recibo simple</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Condiciones</Text>
      <TextInput
        value={clienteCondiciones}
        onChangeText={setClienteCondiciones}
        placeholder="Ej. Crédito 15 días / Contado"
        style={styles.input}
      />

      <Text style={styles.label}>Correo cliente (opcional)</Text>
      <TextInput
        value={clienteCorreo}
        onChangeText={setClienteCorreo}
        placeholder="correo@dominio.com"
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>RFC cliente (opcional)</Text>
      <TextInput
        value={clienteRfc}
        onChangeText={setClienteRfc}
        placeholder="XAXX010101000"
        style={styles.input}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Uso CFDI (opcional)</Text>
      <TextInput
        value={usoCfdi}
        onChangeText={setUsoCfdi}
        placeholder="Ej. G03"
        style={styles.input}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>C.P. (opcional)</Text>
      <TextInput
        value={codigoPostal}
        onChangeText={setCodigoPostal}
        placeholder="Ej. 77500"
        style={styles.input}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Dirección</Text>
      <TextInput
        value={direccion}
        onChangeText={setDireccion}
        placeholder="Calle y número"
        style={styles.input}
      />

      <View style={styles.lineRow}>
        <View style={styles.lineInputWrap}>
          <Text style={styles.label}>No int</Text>
          <TextInput
            value={numInt}
            onChangeText={setNumInt}
            placeholder="Ej. 12"
            style={styles.input}
          />
        </View>
        <View style={styles.lineInputWrap}>
          <Text style={styles.label}>No ext</Text>
          <TextInput
            value={numExt}
            onChangeText={setNumExt}
            placeholder="Ej. A"
            style={styles.input}
          />
        </View>
      </View>

      <Text style={styles.label}>Referencia dirección (opcional)</Text>
      <TextInput
        value={referenciaDireccion}
        onChangeText={setReferenciaDireccion}
        placeholder="Entre calles, puntos de referencia, etc."
        style={[styles.input, styles.textarea]}
        multiline
      />

      <Text style={styles.label}>Observaciones</Text>
      <TextInput
        value={observaciones}
        onChangeText={setObservaciones}
        placeholder="Notas del pedido"
        style={[styles.input, styles.textarea]}
        multiline
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Productos</Text>
        <Pressable style={styles.smallButton} onPress={() => setProductoModalOpen(true)}>
          <Text style={styles.smallButtonLabel}>+ Agregar</Text>
        </Pressable>
      </View>

      {lines.length === 0 ? (
        <View style={styles.emptyLines}>
          <Text style={styles.emptyLinesText}>Aún no has agregado productos.</Text>
        </View>
      ) : (
        lines.map((line) => (
          <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineTopRow}>
              <Text style={styles.lineCode}>{line.codigo}</Text>
              <Pressable onPress={() => removeLine(line.id)}>
                <Text style={styles.removeLine}>Eliminar</Text>
              </Pressable>
            </View>
            <Text style={styles.lineName}>{line.nombre}</Text>

            <View style={styles.lineRow}>
              <View style={styles.lineInputWrap}>
                <Text style={styles.lineLabel}>Cantidad</Text>
                <TextInput
                  value={line.cantidad}
                  onChangeText={(value) => updateLine(line.id, 'cantidad', value.replace(',', '.'))}
                  keyboardType="decimal-pad"
                  style={styles.lineInput}
                />
              </View>
              <View style={styles.lineInputWrap}>
                <Text style={styles.lineLabel}>Precio</Text>
                <TextInput
                  value={String(line.precio)}
                  onChangeText={(value) => updateLine(line.id, 'precio', value.replace(',', '.'))}
                  keyboardType="decimal-pad"
                  style={styles.lineInput}
                />
              </View>
            </View>
            <Text style={styles.lineImporte}>
              Importe: {formatMoney(Number(line.cantidad || 0) * Number(line.precio || 0))}
            </Text>
          </View>
        ))
      )}

      <View style={styles.totalsCard}>
        <Text style={styles.totalLine}>Subtotal: {formatMoney(totals.subtotal)}</Text>
        <Text style={styles.totalLine}>IVA: {formatMoney(totals.iva)}</Text>
        <Text style={styles.totalMain}>Total: {formatMoney(totals.total)}</Text>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
        <Text style={styles.submitLabel}>
          {isSubmitting ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear pedido'}
        </Text>
      </Pressable>

      <Modal visible={clienteModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecciona un cliente</Text>
          <ScrollView>
            {clientes.map((cliente) => (
              <Pressable
                key={cliente.id}
                style={styles.modalItem}
                onPress={() => {
                  setSelectedCliente(cliente);
                  setDireccion((cliente.calle || '').trim());
                  setClienteModalOpen(false);
                }}
              >
                <Text style={styles.modalItemTitle}>{cliente.clave}</Text>
                <Text style={styles.modalItemSubtitle}>{cliente.nombre_comercial || cliente.nombre}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setClienteModalOpen(false)}>
            <Text style={styles.modalCloseLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={productoModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecciona un producto</Text>
          <ScrollView>
            {productos.map((producto) => (
              <Pressable key={producto.id} style={styles.modalItem} onPress={() => addProduct(producto)}>
                <Text style={styles.modalItemTitle}>{producto.codigo}</Text>
                <Text style={styles.modalItemSubtitle}>{producto.nombre || 'Sin nombre'}</Text>
                <Text style={styles.modalItemPrice}>{formatMoney(producto.precio_venta)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setProductoModalOpen(false)}>
            <Text style={styles.modalCloseLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  title: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 22,
    marginBottom: 14,
  },
  label: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 12,
    marginBottom: 6,
  },
  selector: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  selectorValue: {
    color: palette.text,
    fontFamily: typography.regular,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: palette.text,
    fontFamily: typography.regular,
    marginBottom: 12,
  },
  textarea: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    backgroundColor: '#def3ee',
    borderColor: '#c1e9e0',
  },
  toggleLabel: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 13,
  },
  toggleLabelActive: {
    color: palette.primaryDark,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 16,
  },
  smallButton: {
    backgroundColor: palette.navy,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  emptyLines: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#bfc9d4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f9fcff',
  },
  emptyLinesText: {
    color: palette.mutedText,
    fontFamily: typography.regular,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
  },
  lineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  lineCode: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  removeLine: {
    color: palette.danger,
    fontFamily: typography.medium,
    fontSize: 12,
  },
  lineName: {
    color: palette.text,
    fontFamily: typography.regular,
    marginBottom: 8,
  },
  lineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  lineInputWrap: {
    flex: 1,
  },
  lineLabel: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
    marginBottom: 4,
  },
  lineInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.text,
    fontFamily: typography.regular,
  },
  lineImporte: {
    marginTop: 8,
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  totalsCard: {
    borderRadius: 12,
    backgroundColor: '#eff8f6',
    borderWidth: 1,
    borderColor: '#d7ece8',
    padding: 12,
    marginBottom: 12,
  },
  totalLine: {
    color: palette.text,
    fontFamily: typography.medium,
    fontSize: 13,
    marginBottom: 2,
  },
  totalMain: {
    marginTop: 4,
    color: palette.primaryDark,
    fontFamily: typography.bold,
    fontSize: 17,
  },
  error: {
    color: palette.danger,
    fontFamily: typography.medium,
    marginBottom: 8,
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 14,
  },
  modalTitle: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 20,
    marginBottom: 12,
  },
  modalItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  modalItemTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
  modalItemSubtitle: {
    color: palette.text,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  modalItemPrice: {
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    marginTop: 4,
  },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: palette.navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 14,
  },
});

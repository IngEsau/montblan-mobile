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
import { Cliente, CodigoPostalColonia, Producto } from '../../catalog/types';
import { ordersApi } from '../services/ordersApi';

type DraftLine = {
  id: string;
  productoId: number | null;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: string;
  descripcion: string;
  inventarioSa: number | null;
  inventarioCmb: number | null;
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
  const [clienteSearch, setClienteSearch] = useState('');
  const [productoSearch, setProductoSearch] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [clienteCondiciones, setClienteCondiciones] = useState('');
  const [clienteCorreo, setClienteCorreo] = useState('');
  const [clienteRfc, setClienteRfc] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [estadoModalOpen, setEstadoModalOpen] = useState(false);
  const [municipioModalOpen, setMunicipioModalOpen] = useState(false);
  const [coloniaModalOpen, setColoniaModalOpen] = useState(false);
  const [codigoPostalRows, setCodigoPostalRows] = useState<CodigoPostalColonia[]>([]);
  const [estadoId, setEstadoId] = useState<number | null>(null);
  const [municipioId, setMunicipioId] = useState<number | null>(null);
  const [coloniaId, setColoniaId] = useState<number | null>(null);
  const [direccion, setDireccion] = useState('');
  const [numInt, setNumInt] = useState('');
  const [numExt, setNumExt] = useState('');
  const [referenciaDireccion, setReferenciaDireccion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [instruccionesCredito, setInstruccionesCredito] = useState('');
  const [instruccionesAlmacen, setInstruccionesAlmacen] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState<10 | 20>(10);
  const [postfechado, setPostfechado] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showAllLines, setShowAllLines] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [isLookingUpPostalCode, setIsLookingUpPostalCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyClienteSelection = useCallback(
    (cliente: Cliente, options?: { preserveManualFields?: boolean }) => {
      const preserveManualFields = options?.preserveManualFields === true;

      setSelectedCliente(cliente);
      setDireccion((cliente.calle || '').trim());

      // El catálogo de clientes actual no expone ubicación completa,
      // así que limpiamos residuos de C.P./estado/municipio/colonia al cambiar de cliente.
      setCodigoPostal('');
      setCodigoPostalRows([]);
      setEstadoId(null);
      setMunicipioId(null);
      setColoniaId(null);
      setNumInt('');
      setNumExt('');
      setReferenciaDireccion('');

      if (!preserveManualFields) {
        setClienteCondiciones('');
        setClienteCorreo('');
        setClienteRfc('');
        setUsoCfdi('');
      }
    },
    [],
  );

  const getInventarioDisponible = useCallback((inventarioSa: number | null, inventarioCmb: number | null, tipo: 10 | 20) => {
    const sa = inventarioSa !== null ? Number(inventarioSa) : 0;
    const cmb = inventarioCmb !== null ? Number(inventarioCmb) : 0;
    return Number((tipo === 10 ? cmb : sa).toFixed(4));
  }, []);

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

        setTipoComprobante(item.tipo_fac_rem === 20 ? 20 : 10);
        setPostfechado(Boolean(item.postfechado));
        setFechaEntrega(item.postfechado ? item.fecha_entrega || '' : '');
        setClienteCondiciones(item.cliente_condiciones || '');
        setClienteCorreo(item.cliente_correo || '');
        setClienteRfc(item.cliente_rfc || '');
        setUsoCfdi(item.uso_cfdi || '');
        setObservaciones(item.observaciones || '');
        setInstruccionesCredito(item.instrucciones_credito || '');
        setInstruccionesAlmacen(item.instrucciones_almacen || '');
        setShowOptionalFields(Boolean(item.cliente_correo || item.cliente_rfc || item.uso_cfdi));
        setCodigoPostal(item.direccion?.codigo_postal || '');
        setDireccion(item.direccion?.direccion || '');
        setNumInt(item.direccion?.num_int || '');
        setNumExt(item.direccion?.num_ext || '');
        setReferenciaDireccion(item.direccion?.referencia || '');
        setEstadoId(item.direccion?.estado_id || null);
        setMunicipioId(item.direccion?.municipio_id || null);
        setColoniaId(item.direccion?.codigo_postal_id || null);

        const cpFromPedido = (item.direccion?.codigo_postal || '').trim();
        if (/^\d{4,6}$/.test(cpFromPedido)) {
          const cpResponse = await catalogApi.lookupCodigoPostal(token, cpFromPedido);
          const rows = cpResponse.colonias || [];
          setCodigoPostalRows(rows);
        } else {
          setCodigoPostalRows([]);
        }

        const selectedFromCatalog = clientesResponse.items.find((cliente) => cliente.clave === item.no_cliente);
        if (selectedFromCatalog) {
          applyClienteSelection(selectedFromCatalog, { preserveManualFields: true });
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
            asignado_a_nombre: item.vendedor || null,
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
              productoId: catalogProduct?.id ?? null,
              codigo: code,
              nombre: lineName,
              precio: Number(line.precio || 0),
              cantidad: String(line.cantidad || 0),
              descripcion: line.descripcion || lineName,
              inventarioSa: line.inventario_sa ?? catalogProduct?.inventario_sa ?? null,
              inventarioCmb: line.inventario_cmb ?? catalogProduct?.inventario_cmb ?? null,
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
  }, [applyClienteSelection, isEditMode, orderId, token]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const estadosDisponibles = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string }>();
    codigoPostalRows.forEach((row) => {
      if (!map.has(row.estado_id)) {
        map.set(row.estado_id, { id: row.estado_id, nombre: row.estado });
      }
    });
    return Array.from(map.values());
  }, [codigoPostalRows]);

  const municipiosDisponibles = useMemo(() => {
    const map = new Map<number, { id: number; estado_id: number; nombre: string }>();
    codigoPostalRows.forEach((row) => {
      if (estadoId !== null && row.estado_id !== estadoId) {
        return;
      }

      if (!map.has(row.municipio_id)) {
        map.set(row.municipio_id, {
          id: row.municipio_id,
          estado_id: row.estado_id,
          nombre: row.municipio,
        });
      }
    });
    return Array.from(map.values());
  }, [codigoPostalRows, estadoId]);

  const coloniasDisponibles = useMemo(
    () =>
      codigoPostalRows.filter(
        (row) =>
          (estadoId === null || row.estado_id === estadoId) &&
          (municipioId === null || row.municipio_id === municipioId),
      ),
    [codigoPostalRows, estadoId, municipioId],
  );

  const estadoSeleccionado = useMemo(
    () => estadosDisponibles.find((item) => item.id === estadoId) || null,
    [estadosDisponibles, estadoId],
  );

  const municipioSeleccionado = useMemo(
    () => municipiosDisponibles.find((item) => item.id === municipioId) || null,
    [municipiosDisponibles, municipioId],
  );

  const coloniaSeleccionada = useMemo(
    () => coloniasDisponibles.find((item) => item.id === coloniaId) || null,
    [coloniasDisponibles, coloniaId],
  );

  const lookupCodigoPostal = useCallback(
    async (codigo: string, preferred?: { estadoId?: number | null; municipioId?: number | null; coloniaId?: number | null }) => {
      if (!token) {
        return;
      }

      const normalized = codigo.trim();
      if (!/^\d{4,6}$/.test(normalized)) {
        setCodigoPostalRows([]);
        setEstadoId(null);
        setMunicipioId(null);
        setColoniaId(null);
        return;
      }

      setIsLookingUpPostalCode(true);
      try {
        const response = await catalogApi.lookupCodigoPostal(token, normalized);
        const rows = response.colonias || [];
        setCodigoPostalRows(rows);

        if (rows.length === 0) {
          setEstadoId(null);
          setMunicipioId(null);
          setColoniaId(null);
          return;
        }

        const fallback = rows[0];
        const preferredEstadoId = preferred?.estadoId ?? null;
        const preferredMunicipioId = preferred?.municipioId ?? null;
        const preferredColoniaId = preferred?.coloniaId ?? null;

        const selectedEstado =
          preferredEstadoId !== null && rows.some((item) => item.estado_id === preferredEstadoId)
            ? preferredEstadoId
            : fallback.estado_id;

        const selectedMunicipio =
          preferredMunicipioId !== null &&
          rows.some((item) => item.estado_id === selectedEstado && item.municipio_id === preferredMunicipioId)
            ? preferredMunicipioId
            : rows.find((item) => item.estado_id === selectedEstado)?.municipio_id ?? fallback.municipio_id;

        const selectedColonia =
          preferredColoniaId !== null &&
          rows.some(
            (item) =>
              item.estado_id === selectedEstado &&
              item.municipio_id === selectedMunicipio &&
              item.id === preferredColoniaId,
          )
            ? preferredColoniaId
            : rows.find(
                (item) =>
                  item.estado_id === selectedEstado &&
                  item.municipio_id === selectedMunicipio,
              )?.id ?? fallback.id;

        setEstadoId(selectedEstado);
        setMunicipioId(selectedMunicipio);
        setColoniaId(selectedColonia);
      } catch (error) {
        setCodigoPostalRows([]);
        setEstadoId(null);
        setMunicipioId(null);
        setColoniaId(null);
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('No fue posible obtener datos del código postal.');
        }
      } finally {
        setIsLookingUpPostalCode(false);
      }
    },
    [token],
  );

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

  const clientesFiltrados = useMemo(() => {
    const needle = clienteSearch.trim().toLowerCase();
    if (!needle) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const nombre = (cliente.nombre_comercial || cliente.nombre || '').toLowerCase();
      const clave = (cliente.clave || '').toLowerCase();
      return clave.includes(needle) || nombre.includes(needle);
    });
  }, [clienteSearch, clientes]);

  const productosFiltrados = useMemo(() => {
    const needle = productoSearch.trim().toLowerCase();
    if (!needle) {
      return productos;
    }

    return productos.filter((producto) => {
      const codigo = (producto.codigo || '').toLowerCase();
      const nombre = (producto.nombre || '').toLowerCase();
      return codigo.includes(needle) || nombre.includes(needle);
    });
  }, [productoSearch, productos]);

  const addProduct = (producto: Producto) => {
    const line: DraftLine = {
      id: `${producto.id}-${Date.now()}`,
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre || 'Producto sin nombre',
      precio: Number(producto.precio_venta || 0),
      cantidad: '1',
      descripcion: producto.nombre || producto.codigo,
      inventarioSa: producto.inventario_sa ?? null,
      inventarioCmb: producto.inventario_cmb ?? null,
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

  const vendedorResolvido = useMemo(() => {
    const assignedName = selectedCliente?.asignado_a_nombre?.trim();
    if (assignedName) {
      return assignedName;
    }

    const assignedUsername = selectedCliente?.asignado_a_username?.trim();
    if (assignedUsername) {
      return assignedUsername;
    }

    if (isEditMode) {
      return '';
    }

    return user?.username || 'movil';
  }, [isEditMode, selectedCliente?.asignado_a_nombre, selectedCliente?.asignado_a_username, user?.username]);

  const linesWithAvailability = useMemo(
    () =>
      lines.map((line) => {
        const cantidad = Number(line.cantidad || 0);
        const inventarioDisponible = getInventarioDisponible(line.inventarioSa, line.inventarioCmb, tipoComprobante);
        const disponibilidadInsuficiente =
          inventarioDisponible !== null &&
          Number.isFinite(cantidad) &&
          cantidad > 0 &&
          cantidad > inventarioDisponible;

        return {
          ...line,
          inventarioDisponible,
          disponibilidadInsuficiente,
        };
      }),
    [getInventarioDisponible, lines, tipoComprobante],
  );

  const visibleLines = useMemo(() => {
    if (showAllLines) {
      return linesWithAvailability;
    }

    return linesWithAvailability.slice(0, 4);
  }, [linesWithAvailability, showAllLines]);

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const handleCodigoPostalChange = (value: string) => {
    const normalized = value.replace(/\D/g, '').slice(0, 6);
    setCodigoPostal(normalized);
    if (normalized.length < 4) {
      setCodigoPostalRows([]);
      setEstadoId(null);
      setMunicipioId(null);
      setColoniaId(null);
    }
  };

  const handleCodigoPostalBlur = () => {
    lookupCodigoPostal(codigoPostal, {
      estadoId,
      municipioId,
      coloniaId,
    });
  };

  const selectEstado = (id: number) => {
    setEstadoId(id);
    const municipioFallback = codigoPostalRows.find((item) => item.estado_id === id)?.municipio_id ?? null;
    setMunicipioId(municipioFallback);
    const coloniaFallback =
      codigoPostalRows.find((item) => item.estado_id === id && item.municipio_id === municipioFallback)?.id ?? null;
    setColoniaId(coloniaFallback);
    setEstadoModalOpen(false);
  };

  const selectMunicipio = (id: number) => {
    setMunicipioId(id);
    const coloniaFallback =
      codigoPostalRows.find((item) => item.estado_id === estadoId && item.municipio_id === id)?.id ?? null;
    setColoniaId(coloniaFallback);
    setMunicipioModalOpen(false);
  };

  const selectColonia = (id: number) => {
    setColoniaId(id);
    setColoniaModalOpen(false);
  };

  const validateForm = () => {
    if (!selectedCliente) {
      return 'Debes seleccionar un cliente.';
    }

    if (postfechado && !fechaEntrega.trim()) {
      return 'Debes capturar la fecha de entrega cuando el pedido es postfechado.';
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
          cliente_razon_social: selectedCliente.nombre_comercial || selectedCliente.nombre,
          cliente_telefono: selectedCliente.telefono || '',
          cliente_correo: clienteCorreo.trim() || undefined,
          cliente_rfc: clienteRfc.trim() || undefined,
          uso_cfdi: usoCfdi.trim() || undefined,
          cliente_condiciones: clienteCondiciones.trim() || undefined,
          tipo_fac_rem: tipoComprobante,
          postfechado: postfechado ? 1 : 0,
          fecha_entrega: postfechado && fechaEntrega.trim() ? fechaEntrega.trim() : undefined,
          observaciones,
          instrucciones_credito: instruccionesCredito.trim() || undefined,
          instrucciones_almacen: instruccionesAlmacen.trim() || undefined,
          vendedor: vendedorResolvido || undefined,
        },
        direccion: {
          direccion: direccion.trim(),
          num_ext: numExt.trim() || undefined,
          num_int: numInt.trim() || undefined,
          referencia: referenciaDireccion.trim() || undefined,
          codigo_postal: codigoPostal.trim() || undefined,
          estado_id: estadoId || undefined,
          municipio_id: municipioId || undefined,
          codigo_postal_id: coloniaId || undefined,
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

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Datos principales</Text>
        <Text style={styles.label}>Cliente</Text>
        <Pressable
          style={styles.selector}
          onPress={() => {
            setClienteSearch('');
            setClienteModalOpen(true);
          }}
        >
          <Text style={styles.selectorValue}>
            {selectedCliente
              ? `${selectedCliente.clave} - ${selectedCliente.nombre_comercial || selectedCliente.nombre}`
              : 'Seleccionar cliente'}
          </Text>
        </Pressable>

        <View style={styles.lineRow}>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>Tipo global</Text>
            <View style={[styles.toggleRow, styles.toggleRowCompact]}>
              <Pressable
                style={[styles.toggleButton, tipoComprobante === 10 && styles.toggleButtonActive]}
                onPress={() => setTipoComprobante(10)}
              >
                <Text style={[styles.toggleLabel, tipoComprobante === 10 && styles.toggleLabelActive]}>Facturación</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, tipoComprobante === 20 && styles.toggleButtonActive]}
                onPress={() => setTipoComprobante(20)}
              >
                <Text style={[styles.toggleLabel, tipoComprobante === 20 && styles.toggleLabelActive]}>
                  SA
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        <Text style={styles.helper}>
          El número de pedido se asigna en autorización por CXC, por eso no se captura en esta fase.
        </Text>

        <Text style={styles.label}>Postfechado</Text>
        <View style={[styles.toggleRow, styles.toggleRowCompact]}>
          <Pressable
            style={[styles.toggleButton, !postfechado && styles.toggleButtonActive]}
            onPress={() => setPostfechado(false)}
          >
            <Text style={[styles.toggleLabel, !postfechado && styles.toggleLabelActive]}>No</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, postfechado && styles.toggleButtonActive]}
            onPress={() => setPostfechado(true)}
          >
            <Text style={[styles.toggleLabel, postfechado && styles.toggleLabelActive]}>Sí</Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          Solo los pedidos postfechados capturan fecha de entrega. Los pedidos normales ya no usan ese dato.
        </Text>

        {postfechado ? (
          <>
            <Text style={styles.label}>Fecha de entrega</Text>
            <TextInput
              value={fechaEntrega}
              onChangeText={setFechaEntrega}
              placeholder="YYYY-MM-DD"
              style={styles.input}
              autoCapitalize="none"
            />
          </>
        ) : null}

        <Text style={styles.label}>Condiciones</Text>
        <TextInput
          value={clienteCondiciones}
          onChangeText={setClienteCondiciones}
          placeholder="Ej. Crédito 15 días / Contado"
          style={styles.input}
        />

        <View style={styles.inlineInfoCard}>
          <View style={styles.inlineInfoBlock}>
            <Text style={styles.infoTitle}>Vendedor</Text>
            <Text style={styles.infoValue}>
              {vendedorResolvido || 'Se asignará desde el catálogo del cliente al guardar'}
            </Text>
          </View>
          <Pressable style={styles.inlineToggleButton} onPress={() => setShowOptionalFields((prev) => !prev)}>
            <Text style={styles.inlineToggleLabel}>
              {showOptionalFields ? 'Ocultar datos fiscales' : 'Ver datos fiscales'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          {selectedCliente?.asignado_a_id
            ? 'El vendedor se toma del cliente asignado en catálogo.'
            : 'Si el cliente no tiene vendedor asignado, se usará el usuario actual.'}
        </Text>

        {showOptionalFields ? (
          <>
            <View style={styles.lineRow}>
              <View style={styles.lineInputWrap}>
                <Text style={styles.label}>Correo cliente</Text>
                <TextInput
                  value={clienteCorreo}
                  onChangeText={setClienteCorreo}
                  placeholder="correo@dominio.com"
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.lineInputWrap}>
                <Text style={styles.label}>Uso CFDI</Text>
                <TextInput
                  value={usoCfdi}
                  onChangeText={setUsoCfdi}
                  placeholder="Ej. G03"
                  style={styles.input}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <Text style={styles.label}>RFC cliente</Text>
            <TextInput
              value={clienteRfc}
              onChangeText={setClienteRfc}
              placeholder="XAXX010101000"
              style={styles.input}
              autoCapitalize="characters"
            />
          </>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        <View style={styles.lineRow}>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>C.P.</Text>
            <TextInput
              value={codigoPostal}
              onChangeText={handleCodigoPostalChange}
              onBlur={handleCodigoPostalBlur}
              placeholder="Ej. 77500"
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>Colonia</Text>
            <Pressable
              style={styles.selector}
              onPress={() => setColoniaModalOpen(true)}
              disabled={coloniasDisponibles.length === 0}
            >
              <Text style={styles.selectorValue}>
                {coloniaSeleccionada?.nombre || (codigoPostalRows.length > 0 ? 'Seleccionar colonia' : 'Sin datos')}
              </Text>
            </Pressable>
          </View>
        </View>
        {isLookingUpPostalCode ? <Text style={styles.helper}>Buscando datos de C.P...</Text> : null}

        <View style={styles.lineRow}>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>Estado</Text>
            <Pressable
              style={styles.selector}
              onPress={() => setEstadoModalOpen(true)}
              disabled={estadosDisponibles.length === 0}
            >
              <Text style={styles.selectorValue}>
                {estadoSeleccionado?.nombre || (codigoPostalRows.length > 0 ? 'Seleccionar estado' : 'Sin datos')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>Deleg./Mpio.</Text>
            <Pressable
              style={styles.selector}
              onPress={() => setMunicipioModalOpen(true)}
              disabled={municipiosDisponibles.length === 0}
            >
              <Text style={styles.selectorValue}>
                {municipioSeleccionado?.nombre ||
                  (codigoPostalRows.length > 0 ? 'Seleccionar municipio' : 'Sin datos')}
              </Text>
            </Pressable>
          </View>
        </View>

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
            <TextInput value={numInt} onChangeText={setNumInt} placeholder="Ej. 12" style={styles.input} />
          </View>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>No ext</Text>
            <TextInput value={numExt} onChangeText={setNumExt} placeholder="Ej. A" style={styles.input} />
          </View>
        </View>

        <Text style={styles.label}>Referencia dirección</Text>
        <TextInput
          value={referenciaDireccion}
          onChangeText={setReferenciaDireccion}
          placeholder="Entre calles, puntos de referencia, etc."
          style={[styles.input, styles.textareaCompact]}
          multiline
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Indicaciones</Text>
        <Text style={styles.label}>Observaciones</Text>
        <TextInput
          value={observaciones}
          onChangeText={setObservaciones}
          placeholder="Notas del pedido"
          style={[styles.input, styles.textareaCompact]}
          multiline
        />

        <View style={styles.lineRow}>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>Instrucciones para Crédito</Text>
            <TextInput
              value={instruccionesCredito}
              onChangeText={setInstruccionesCredito}
              placeholder="Ej. no facturar arriba de cierto monto"
              style={[styles.input, styles.textareaCompact]}
              multiline
            />
          </View>
          <View style={styles.lineInputWrap}>
            <Text style={styles.label}>Instrucciones para Almacén</Text>
            <TextInput
              value={instruccionesAlmacen}
              onChangeText={setInstruccionesAlmacen}
              placeholder="Ej. material con corte / cliente foráneo"
              style={[styles.input, styles.textareaCompact]}
              multiline
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Detalle de producto(s)</Text>
          {lines.length > 0 ? (
            <Text style={styles.sectionMeta}>
              Mostrando {visibleLines.length} de {lines.length} productos
            </Text>
          ) : null}
        </View>
        <View style={styles.sectionActions}>
          <Pressable
            style={styles.smallButton}
            onPress={() => {
              setProductoSearch('');
              setProductoModalOpen(true);
            }}
          >
            <Text style={styles.smallButtonLabel}>+ Agregar</Text>
          </Pressable>
        </View>
      </View>

      {lines.length === 0 ? (
        <View style={styles.emptyLines}>
          <Text style={styles.emptyLinesText}>Aún no has agregado productos.</Text>
        </View>
      ) : (
        visibleLines.map((line) => (
          <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineTopRow}>
              <Text style={styles.lineCode}>{line.codigo}</Text>
              <View style={styles.lineActions}>
                <Text style={styles.lineImporteCompact}>{formatMoney(Number(line.cantidad || 0) * Number(line.precio || 0))}</Text>
                <Pressable onPress={() => removeLine(line.id)}>
                  <Text style={styles.removeLine}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.lineName}>{line.nombre}</Text>
            <Text style={[styles.inventorySummary, line.disponibilidadInsuficiente && styles.inventoryWarning]}>
              Inv. disponible: {line.inventarioDisponible ?? 0} | SA: {line.inventarioSa ?? 0} | CMB: {line.inventarioCmb ?? 0}
            </Text>

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
            {line.disponibilidadInsuficiente ? (
              <Text style={styles.inventoryWarning}>
                Inventario insuficiente para {line.codigo} - {line.nombre} usando {tipoComprobante === 10 ? 'Inv. CMB' : 'Inv. SA'}. Puedes agregarlo al pedido, pero queda advertido.
              </Text>
            ) : null}
          </View>
        ))
      )}

      {lines.length > 4 ? (
        <Pressable style={styles.expandLinesButton} onPress={() => setShowAllLines((prev) => !prev)}>
          <Text style={styles.expandLinesLabel}>{showAllLines ? 'Ver menos productos' : 'Ver más productos'}</Text>
        </Pressable>
      ) : null}

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
          <TextInput
            value={clienteSearch}
            onChangeText={setClienteSearch}
            style={styles.input}
            placeholder="Buscar por clave o nombre"
          />
          <ScrollView>
            {clientesFiltrados.map((cliente) => (
              <Pressable
                key={cliente.id}
                style={styles.modalItem}
                onPress={() => {
                  applyClienteSelection(cliente);
                  setClienteModalOpen(false);
                }}
              >
                <Text style={styles.modalItemTitle}>{cliente.clave}</Text>
                <Text style={styles.modalItemSubtitle}>{cliente.nombre_comercial || cliente.nombre}</Text>
                {cliente.calle ? <Text style={styles.modalItemMeta}>{cliente.calle}</Text> : null}
                <Text style={styles.modalItemMeta}>Saldo: {formatMoney(cliente.saldo)}</Text>
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
          <TextInput
            value={productoSearch}
            onChangeText={setProductoSearch}
            style={styles.input}
            placeholder="Buscar por código o nombre"
          />
          <ScrollView>
            {productosFiltrados.map((producto) => (
              <Pressable key={producto.id} style={styles.modalItem} onPress={() => addProduct(producto)}>
                <Text style={styles.modalItemTitle}>{producto.codigo}</Text>
                <Text style={styles.modalItemSubtitle}>{producto.nombre || 'Sin nombre'}</Text>
                <Text style={styles.modalItemPrice}>{formatMoney(producto.precio_venta)}</Text>
                <Text style={styles.modalItemMeta}>
                  Inv. disponible: {getInventarioDisponible(producto.inventario_sa ?? null, producto.inventario_cmb ?? null, tipoComprobante)} | SA: {producto.inventario_sa ?? 0} | CMB: {producto.inventario_cmb ?? 0}
                </Text>
                {getInventarioDisponible(producto.inventario_sa ?? null, producto.inventario_cmb ?? null, tipoComprobante) <= 0 ? (
                  <Text style={styles.inventoryWarning}>
                    Inventario insuficiente para {producto.codigo} - {producto.nombre || 'Sin nombre'} usando {tipoComprobante === 10 ? 'Inv. CMB' : 'Inv. SA'}.
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setProductoModalOpen(false)}>
            <Text style={styles.modalCloseLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={estadoModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecciona estado</Text>
          <ScrollView>
            {estadosDisponibles.map((estadoItem) => (
              <Pressable
                key={estadoItem.id}
                style={styles.modalItem}
                onPress={() => selectEstado(estadoItem.id)}
              >
                <Text style={styles.modalItemTitle}>{estadoItem.nombre}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setEstadoModalOpen(false)}>
            <Text style={styles.modalCloseLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={municipioModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecciona municipio</Text>
          <ScrollView>
            {municipiosDisponibles.map((municipioItem) => (
              <Pressable
                key={municipioItem.id}
                style={styles.modalItem}
                onPress={() => selectMunicipio(municipioItem.id)}
              >
                <Text style={styles.modalItemTitle}>{municipioItem.nombre}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setMunicipioModalOpen(false)}>
            <Text style={styles.modalCloseLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={coloniaModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecciona colonia</Text>
          <ScrollView>
            {coloniasDisponibles.map((coloniaItem) => (
              <Pressable
                key={coloniaItem.id}
                style={styles.modalItem}
                onPress={() => selectColonia(coloniaItem.id)}
              >
                <Text style={styles.modalItemTitle}>{coloniaItem.nombre}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setColoniaModalOpen(false)}>
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
  helper: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
    marginTop: 0,
    marginBottom: 10,
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
  sectionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 16,
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  secondarySmallButton: {
    backgroundColor: '#eef5fb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondarySmallButtonLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 11,
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
  lineActions: {
    alignItems: 'flex-end',
    gap: 2,
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
  inventorySummary: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
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
  lineTextarea: {
    minHeight: 64,
    marginTop: 6,
    textAlignVertical: 'top',
  },
  lineImporteCompact: {
    color: palette.primaryDark,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  inlineInfoCard: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  inlineInfoBlock: {
    flex: 1,
  },
  infoTitle: {
    color: palette.mutedText,
    fontFamily: typography.medium,
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  inlineToggleButton: {
    justifyContent: 'center',
  },
  inlineToggleLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  textareaCompact: {
    minHeight: 58,
    textAlignVertical: 'top',
  },
  toggleRowCompact: {
    marginBottom: 0,
  },
  expandLinesButton: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expandLinesLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  inventoryWarning: {
    color: palette.danger,
    fontFamily: typography.medium,
    fontSize: 12,
    marginTop: 6,
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
  modalItemMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
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

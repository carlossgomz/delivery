"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  nombre: string;
  precioUsd: number;
  categoria: string;
  activo: boolean;
  imagenUrl?: string | null;
  porPeso: boolean;
};

export default function AdminHomePage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [nuevaTasa, setNuevaTasa] = useState<string>("");
  const [telefonoTienda, setTelefonoTienda] = useState<string>("");
  const [nuevoTelefono, setNuevoTelefono] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pedidosHabilitados, setPedidosHabilitados] = useState<boolean>(true);
  const [cambiandoPedidos, setCambiandoPedidos] = useState(false);

  // Estados para productos
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingValues, setEditingValues] = useState<
    Record<string, { nombre: string; precioUsd: string; porPeso: boolean; categoria: string }>
  >({});
  const [guardandoProductoId, setGuardandoProductoId] = useState<string | null>(null);
  const [cambiandoDisponibilidadId, setCambiandoDisponibilidadId] = useState<string | null>(null);
  const [subiendoImagenId, setSubiendoImagenId] = useState<string | null>(null);

  // Estados para agregar un producto nuevo
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    precioUsd: "",
    categoria: "",
    porPeso: false,
  });
  // Imagen elegida para el producto nuevo: se sube recién cuando se
  // confirma "Agregar" (junto con el resto de los datos), no apenas se
  // selecciona el archivo.
  const [nuevaImagenFile, setNuevaImagenFile] = useState<File | null>(null);
  const [nuevaImagenPreview, setNuevaImagenPreview] = useState<string | null>(null);
  const [agregandoProducto, setAgregandoProducto] = useState(false);
  const [mensajeNuevoProducto, setMensajeNuevoProducto] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setTasaCambio(d.tasaCambio);
        setTelefonoTienda(d.telefonoTienda ?? "");
        setPedidosHabilitados(d.pedidosHabilitados ?? true);
      });

    cargarProductos();
  }, []);

  async function cargarProductos() {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      const lista = Array.isArray(data.products) ? data.products : Array.isArray(data) ? data : [];
      setProducts(lista);

      const iniciales: Record<string, { nombre: string; precioUsd: string; porPeso: boolean; categoria: string }> = {};
      lista.forEach((p: Product) => {
        iniciales[p.id] = {
          nombre: p.nombre,
          precioUsd: p.precioUsd?.toString() ?? "",
          porPeso: Boolean(p.porPeso),
          categoria: p.categoria,
        };
      });
      setEditingValues(iniciales);
    } catch (e) {
      console.error("Error al cargar productos:", e);
    }
  }

  async function actualizarTasa() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasaCambio: Number(nuevaTasa) })
    });
    if (res.ok) {
      const data = await res.json();
      setTasaCambio(data.tasaCambio);
      setNuevaTasa("");
      setMensaje("Tasa actualizada.");
    } else {
      setMensaje("No se pudo actualizar la tasa.");
    }
    setGuardando(false);
  }

  async function actualizarTelefono() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefonoTienda: nuevoTelefono })
    });
    if (res.ok) {
      const data = await res.json();
      setTelefonoTienda(data.telefonoTienda ?? "");
      setNuevoTelefono("");
      setMensaje("Teléfono actualizado.");
    } else {
      setMensaje("No se pudo actualizar el teléfono.");
    }
    setGuardando(false);
  }

  async function alternarPedidos() {
    const nuevoValor = !pedidosHabilitados;
    setCambiandoPedidos(true);
    setMensaje("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidosHabilitados: nuevoValor })
      });
      if (res.ok) {
        const data = await res.json();
        setPedidosHabilitados(data.pedidosHabilitados);
        setMensaje(
          data.pedidosHabilitados
            ? "Pedidos habilitados: los clientes ya pueden pedir."
            : "Pedidos deshabilitados: los clientes verán el aviso de horario y no podrán pedir."
        );
      } else {
        setMensaje("No se pudo actualizar el interruptor de pedidos.");
      }
    } catch (e) {
      console.error("Error al actualizar pedidosHabilitados:", e);
      setMensaje("No se pudo actualizar el interruptor de pedidos.");
    } finally {
      setCambiandoPedidos(false);
    }
  }

  // El precio final ya viene cargado directamente, sin costo ni margen.
  function calcularPrecioBs(precioUsdStr: string): string {
    const precioUsd = parseFloat(precioUsdStr);
    if (isNaN(precioUsd) || precioUsd <= 0) return "0.00";
    return (precioUsd * tasaCambio).toFixed(2);
  }

  function handleProductChange(
    id: string,
    field: "nombre" | "precioUsd" | "porPeso" | "categoria",
    value: string | boolean
  ) {
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      } as { nombre: string; precioUsd: string; porPeso: boolean; categoria: string },
    }));
  }

  async function guardarProducto(id: string) {
    const val = editingValues[id];
    if (!val) return;

    setGuardandoProductoId(id);

    try {
      const precioUsd = parseFloat(val.precioUsd) || 0;

      const bodyPayload = {
        nombre: val.nombre,
        precioUsd,
        porPeso: val.porPeso,
        categoria: val.categoria,
      };

      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        const prodActualizado = data.product || data;
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...prodActualizado } : p)));
      } else {
        alert("No se pudo actualizar el producto.");
      }
    } catch (e) {
      console.error("Error al guardar producto:", e);
    } finally {
      setGuardandoProductoId(null);
    }
  }

  // Marca un producto como "sin stock" (o lo reactiva). Sigue apareciendo
  // en el catálogo del cliente, pero como no disponible y sin poder
  // agregarlo al carrito, en vez de desaparecer por completo.
  async function toggleDisponibilidad(product: Product) {
    setCambiandoDisponibilidadId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !product.activo }),
      });

      if (res.ok) {
        const data = await res.json();
        const prodActualizado = data.product || data;
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...prodActualizado } : p)));
      } else {
        alert("No se pudo cambiar la disponibilidad del producto.");
      }
    } catch (e) {
      console.error("Error al cambiar disponibilidad:", e);
    } finally {
      setCambiandoDisponibilidadId(null);
    }
  }

  // Sube (o reemplaza) la imagen de un producto YA EXISTENTE, sin tener
  // que borrarlo y crearlo de nuevo.
  async function subirImagenProducto(product: Product, file: File) {
    setSubiendoImagenId(product.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carpeta", "productos");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        alert("No se pudo subir la imagen.");
        return;
      }
      const { url } = await uploadRes.json();

      const patchRes = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenUrl: url }),
      });

      if (patchRes.ok) {
        const data = await patchRes.json();
        const prodActualizado = data.product || data;
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...prodActualizado } : p)));
      } else {
        alert("La imagen se subió pero no se pudo asociar al producto.");
      }
    } catch (e) {
      console.error("Error al subir imagen de producto:", e);
      alert("Ocurrió un error al subir la imagen.");
    } finally {
      setSubiendoImagenId(null);
    }
  }

  async function agregarProducto() {
    const nombre = nuevoProducto.nombre.trim();
    const categoria = nuevoProducto.categoria.trim();
    const precioUsd = parseFloat(nuevoProducto.precioUsd);

    if (!nombre || !categoria) {
      setMensajeNuevoProducto("Completa el nombre y la categoría.");
      return;
    }
    if (isNaN(precioUsd) || precioUsd <= 0) {
      setMensajeNuevoProducto("Escribe un precio válido en dólares.");
      return;
    }

    setAgregandoProducto(true);
    setMensajeNuevoProducto("");

    try {
      // Si el admin eligió una imagen, se sube primero: así el producto
      // ya se crea con su foto en vez de tener que ir a buscarlo después
      // para asociársela.
      let imagenUrl: string | null = null;
      if (nuevaImagenFile) {
        const formData = new FormData();
        formData.append("file", nuevaImagenFile);
        formData.append("carpeta", "productos");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          setMensajeNuevoProducto("No se pudo subir la imagen. Intenta agregar el producto de nuevo.");
          setAgregandoProducto(false);
          return;
        }
        const uploadData = await uploadRes.json();
        imagenUrl = uploadData.url;
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, precioUsd, categoria, porPeso: nuevoProducto.porPeso, imagenUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        const producto: Product = data.product;
        setProducts((prev) => [...prev, producto]);
        setEditingValues((prev) => ({
          ...prev,
          [producto.id]: {
            nombre: producto.nombre,
            precioUsd: producto.precioUsd.toString(),
            porPeso: Boolean(producto.porPeso),
            categoria: producto.categoria,
          },
        }));
        setNuevoProducto({ nombre: "", precioUsd: "", categoria: "", porPeso: false });
        setNuevaImagenFile(null);
        setNuevaImagenPreview(null);
        setMensajeNuevoProducto(`"${producto.nombre}" agregado al catálogo.`);
      } else {
        setMensajeNuevoProducto("No se pudo agregar el producto.");
      }
    } catch (e) {
      console.error("Error al agregar producto:", e);
      setMensajeNuevoProducto("No se pudo agregar el producto.");
    } finally {
      setAgregandoProducto(false);
    }
  }

  const categoriasExistentes = useMemo(
    () => Array.from(new Set(products.map((p) => p.categoria).filter(Boolean))),
    [products]
  );

  const productosFiltrados = products.filter((p) => {
    const edit = editingValues[p.id];
    const nombreBuscar = edit?.nombre ?? p.nombre;
    return nombreBuscar.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div>
      {/* INTERRUPTOR: ABRIR/CERRAR PEDIDOS */}
      <h1 className="font-display text-xl text-leaf-800 mb-4">Estado de la tienda</h1>
      <div
        className={`flex items-center justify-between gap-4 rounded-lg border p-4 mb-8 ${pedidosHabilitados
            ? "bg-leaf-50 border-leaf-100"
            : "bg-alert-50 border-alert-200"
          }`}
      >
        <div>
          <p className={`font-medium ${pedidosHabilitados ? "text-leaf-800" : "text-alert-700"}`}>
            {pedidosHabilitados ? "Recibiendo pedidos" : "Pedidos deshabilitados"}
          </p>
          <p className="text-xs text-ink/60 mt-0.5">
            {pedidosHabilitados
              ? "Los clientes pueden agregar productos y completar el pago."
              : "Los clientes verán el aviso de horario y no podrán completar un pedido. El catálogo y el registro de cuentas nuevas siguen funcionando."}
          </p>
        </div>
        <button
          onClick={alternarPedidos}
          disabled={cambiandoPedidos}
          role="switch"
          aria-checked={pedidosHabilitados}
          className={`shrink-0 relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${pedidosHabilitados ? "bg-leaf-600" : "bg-ink/20"
            }`}
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${pedidosHabilitados ? "translate-x-6" : "translate-x-0"
              }`}
          />
        </button>
      </div>

      <h1 className="font-display text-xl text-leaf-800 mb-4">Tasa de Cambio</h1>

      <div className="bg-white border border-leaf-100 rounded-lg p-6 mb-4">
        <p className="text-sm text-ink/60">Tasa actual</p>
        <p className="font-display text-3xl text-leaf-800">{tasaCambio} Bs/USD</p>
      </div>
      <div className="flex gap-3 mb-8">
        <input
          type="number"
          step="0.01"
          value={nuevaTasa}
          onChange={(e) => setNuevaTasa(e.target.value)}
          placeholder="Nueva tasa, ej: 42.50"
          className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
        />
        <button
          disabled={!nuevaTasa || guardando}
          onClick={actualizarTasa}
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          Actualizar
        </button>
      </div>

      {mensaje && <p className="text-sm mt-3 text-leaf-600">{mensaje}</p>}

      {/* TELÉFONO DE LA TIENDA (llamadas y chat del cliente) */}
      <hr className="border-leaf-100 my-6" />
      <h2 className="font-display text-lg text-leaf-800 mb-3">Teléfono de la tienda</h2>
      <p className="text-xs text-ink/50 mb-3">
        Este es el número que usa el botón de "Llamar a la tienda" en la página del cliente.
      </p>
      <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-4">
        <p className="text-sm text-ink/60">Número actual</p>
        <p className="font-display text-xl text-leaf-800">{telefonoTienda || "Sin definir"}</p>
      </div>
      <div className="flex gap-3">
        <input
          type="tel"
          value={nuevoTelefono}
          onChange={(e) => setNuevoTelefono(e.target.value)}
          placeholder="Ej: 04266215863"
          className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
        />
        <button
          disabled={!nuevoTelefono || guardando}
          onClick={actualizarTelefono}
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          Actualizar
        </button>
      </div>

      {/* SECCIÓN DE PRODUCTOS */}
      <hr className="border-leaf-100 my-8" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display text-xl text-leaf-800">Productos</h2>
          <p className="text-xs text-ink/50">
            Edita el nombre y el precio final ($), marca lo que no tengas en stock, o agrega
            productos nuevos.
          </p>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-leaf-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-xs text-ink/40 hover:text-ink/80"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* AGREGAR PRODUCTO NUEVO */}
      <div className="bg-leaf-50/60 border border-leaf-100 rounded-lg p-4 mb-4">
        <p className="text-sm font-medium text-leaf-800 mb-3">➕ Agregar producto nuevo</p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Imagen del producto nuevo (opcional): se sube junto con el
              resto de los datos al tocar "Agregar". */}
          <label className="relative shrink-0 w-16 h-16 sm:w-[42px] sm:h-[42px] rounded-lg border border-dashed border-leaf-300 bg-white overflow-hidden cursor-pointer flex items-center justify-center mx-auto sm:mx-0">
            {nuevaImagenPreview ? (
              <img src={nuevaImagenPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-leaf-400 text-lg" title="Agregar imagen (opcional)">
                📷
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (nuevaImagenPreview) URL.revokeObjectURL(nuevaImagenPreview);
                setNuevaImagenFile(file);
                setNuevaImagenPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_140px_180px_auto] gap-2.5">
            <input
              type="text"
              placeholder="Nombre del producto"
              value={nuevoProducto.nombre}
              onChange={(e) => setNuevoProducto((prev) => ({ ...prev, nombre: e.target.value }))}
              className="border border-leaf-100 rounded-lg px-3 py-2.5 bg-white"
            />
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs text-ink/40">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="Precio"
                value={nuevoProducto.precioUsd}
                onChange={(e) => setNuevoProducto((prev) => ({ ...prev, precioUsd: e.target.value }))}
                className="w-full pl-6 pr-3 py-2.5 border border-leaf-100 rounded-lg bg-white"
              />
            </div>
            <input
              type="text"
              list="categorias-existentes"
              placeholder="Categoría (ej: Lácteos)"
              value={nuevoProducto.categoria}
              onChange={(e) => setNuevoProducto((prev) => ({ ...prev, categoria: e.target.value }))}
              className="border border-leaf-100 rounded-lg px-3 py-2.5 bg-white"
            />
            <datalist id="categorias-existentes">
              {categoriasExistentes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              onClick={agregarProducto}
              disabled={agregandoProducto}
              className="px-4 py-2.5 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors whitespace-nowrap"
            >
              {agregandoProducto ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-2.5 text-xs text-ink/70 select-none">
          <input
            type="checkbox"
            checked={nuevoProducto.porPeso}
            onChange={(e) => setNuevoProducto((prev) => ({ ...prev, porPeso: e.target.checked }))}
            className="w-4 h-4 accent-leaf-600 cursor-pointer"
          />
          Se vende por peso (kg) — el precio de arriba es por kilogramo, no por unidad
        </label>
        {mensajeNuevoProducto && (
          <p className="text-xs mt-2.5 text-leaf-700">{mensajeNuevoProducto}</p>
        )}
      </div>

      {/* LISTA DE PRODUCTOS: una tarjeta por producto, con el nombre en su
          propia línea completa y el precio debajo, para que se pueda leer
          bien sin que el nombre se corte (antes iba en una tabla angosta). */}
      <div className="bg-white border border-leaf-100 rounded-lg divide-y divide-leaf-100/70 overflow-hidden">
        {productosFiltrados.map((product) => {
          const edit = editingValues[product.id] || {
            nombre: product.nombre,
            precioUsd: product.precioUsd?.toString() ?? "",
            porPeso: Boolean(product.porPeso),
          };

          const precioBs = calcularPrecioBs(edit.precioUsd);
          const estaGuardando = guardandoProductoId === product.id;
          const cambiandoDisponibilidad = cambiandoDisponibilidadId === product.id;

          return (
            <div key={product.id} className={`p-4 ${!product.activo ? "bg-alert-50/30" : ""}`}>
              <div className="flex items-start gap-3">
                {/* Imagen del producto: tocar la miniatura para subir o
                    cambiar la foto sin tener que borrar y recrear el
                    producto. */}
                <label
                  className="relative shrink-0 w-14 h-14 rounded-lg border border-leaf-100 bg-leaf-50 overflow-hidden cursor-pointer group"
                  title="Cambiar imagen del producto"
                >
                  {product.imagenUrl ? (
                    <img
                      src={product.imagenUrl}
                      alt={product.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-leaf-300 text-xl">
                      🛒
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[9px] font-medium opacity-0 group-hover:opacity-100">
                    {subiendoImagenId === product.id ? "..." : "Cambiar"}
                  </span>
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-leaf-600 text-white flex items-center justify-center text-[8px] shadow-sm border border-white"
                    aria-hidden="true"
                  >
                    📷
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={subiendoImagenId === product.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) subirImagenProducto(product, file);
                      e.target.value = "";
                    }}
                  />
                </label>

                <div className="flex-1 min-w-0">
                  {/* Línea 1: nombre completo, sin cortar */}
                  <input
                    type="text"
                    value={edit.nombre}
                    onChange={(e) => handleProductChange(product.id, "nombre", e.target.value)}
                    className="w-full font-medium text-ink border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-2 py-1.5 focus:bg-leaf-50/40 focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center gap-2 mt-1.5 px-2">
                    {/* Categoría editable: escribe una existente (sugerida
                        por el datalist) o una nueva, y toca "Guardar". */}
                    <input
                      type="text"
                      list="categorias-existentes"
                      value={edit.categoria}
                      onChange={(e) => handleProductChange(product.id, "categoria", e.target.value)}
                      title="Escribe una categoría existente o una nueva, y toca Guardar"
                      className="text-xs text-ink/70 bg-leaf-50 hover:bg-leaf-100/70 focus:bg-white border border-transparent focus:border-leaf-500 px-2 py-0.5 rounded-full focus:outline-none w-32"
                    />
                    {!product.activo && (
                      <span className="text-xs font-medium text-alert-600 bg-alert-100 px-2 py-0.5 rounded-full">
                        Sin stock — el cliente lo ve como no disponible
                      </span>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-ink/60 select-none ml-auto">
                      <input
                        type="checkbox"
                        checked={edit.porPeso}
                        onChange={(e) => handleProductChange(product.id, "porPeso", e.target.checked)}
                        className="w-3.5 h-3.5 accent-leaf-600 cursor-pointer"
                      />
                      Se vende por kilo
                    </label>
                  </div>
                </div>
              </div>

              {/* Línea 2: precio y acciones */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-xs text-ink/40">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={edit.precioUsd}
                      onChange={(e) => handleProductChange(product.id, "precioUsd", e.target.value)}
                      className="w-28 pl-6 pr-2 py-1.5 border border-leaf-100 rounded-lg focus:border-leaf-500 focus:outline-none"
                    />
                    {edit.porPeso && (
                      <span className="absolute right-2 text-[10px] text-ink/40">/kg</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-leaf-800 whitespace-nowrap">
                    = Bs {precioBs}
                    {edit.porPeso && <span className="text-ink/40 font-normal">/kg</span>}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => guardarProducto(product.id)}
                    disabled={estaGuardando}
                    className="px-3.5 py-2 rounded-lg bg-leaf-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors"
                  >
                    {estaGuardando ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => toggleDisponibilidad(product)}
                    disabled={cambiandoDisponibilidad}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium disabled:opacity-40 border transition-colors ${product.activo
                        ? "border-alert-600 text-alert-600 hover:bg-alert-50"
                        : "border-leaf-600 text-leaf-600 hover:bg-leaf-50"
                      }`}
                  >
                    {cambiandoDisponibilidad
                      ? "..."
                      : product.activo
                        ? "Marcar sin stock"
                        : "Marcar disponible"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {productosFiltrados.length === 0 && (
          <p className="py-6 text-center text-xs text-ink/50">
            {searchTerm ? "No se encontraron productos." : "No hay productos disponibles."}
          </p>
        )}
      </div>
    </div>
  );
}
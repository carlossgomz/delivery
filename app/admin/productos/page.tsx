"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  nombre: string;
  costoUsd?: number | null;
  precioUsd: number;
  margenPorcentaje?: number | null;
  imagenUrl?: string | null;
  categoria: string;
  activo: boolean;
  porPeso: boolean;
  orden: number;
  createdAt?: string;
};

type EditingValue = { nombre: string; precioUsd: string; porPeso: boolean; categoria: string };

export default function AdminProductosPage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);

  // Estados para gestión de productos
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingValues, setEditingValues] = useState<Record<string, EditingValue>>({});
  const [guardandoProductoId, setGuardandoProductoId] = useState<string | null>(null);
  const [cambiandoDisponibilidadId, setCambiandoDisponibilidadId] = useState<string | null>(null);
  const [subiendoImagenId, setSubiendoImagenId] = useState<string | null>(null);
  const [reordenandoId, setReordenandoId] = useState<string | null>(null);

  // Estados para el panel de "Categorías" (renombrar en bloque + imagen)
  const [renombrando, setRenombrando] = useState<Record<string, string>>({});
  const [guardandoCategoria, setGuardandoCategoria] = useState<string | null>(null);
  const [categoriaImagenes, setCategoriaImagenes] = useState<Record<string, string | null>>({});
  const [subiendoImagenCategoriaId, setSubiendoImagenCategoriaId] = useState<string | null>(null);

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

  async function subirImagen(product: Product, file: File) {
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

  // Sube (o reemplaza) la imagen representativa de una categoría entera —
  // la que se ve en los círculos del catálogo del cliente.
  async function subirImagenCategoria(nombreCategoria: string, file: File) {
    setSubiendoImagenCategoriaId(nombreCategoria);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carpeta", "categorias");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        alert("No se pudo subir la imagen.");
        return;
      }
      const { url } = await uploadRes.json();

      const res = await fetch("/api/categorias/imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreCategoria, imagenUrl: url }),
      });

      if (res.ok) {
        setCategoriaImagenes((prev) => ({ ...prev, [nombreCategoria]: url }));
      } else {
        alert("La imagen se subió pero no se pudo asociar a la categoría.");
      }
    } catch (e) {
      console.error("Error al subir imagen de categoría:", e);
      alert("Ocurrió un error al subir la imagen.");
    } finally {
      setSubiendoImagenCategoriaId(null);
    }
  }

  useEffect(() => {
    // Tasa del día: solo se muestra acá para calcular el precio en Bs de
    // cada producto. Para cambiarla, ahora se usa la pestaña Configuración.
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setTasaCambio(d.tasaCambio);
      });

    cargarProductos();
    cargarCategorias();
  }, []);

  async function cargarProductos() {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      const lista = Array.isArray(data.products) ? data.products : Array.isArray(data) ? data : [];
      setProducts(lista);

      const iniciales: Record<string, EditingValue> = {};
      lista.forEach((p: Product) => {
        iniciales[p.id] = {
          nombre: p.nombre,
          precioUsd: p.precioUsd?.toString() ?? "0",
          porPeso: Boolean(p.porPeso),
          categoria: p.categoria,
        };
      });
      setEditingValues(iniciales);
    } catch (e) {
      console.error("Error al cargar productos:", e);
    }
  }

  async function cargarCategorias() {
    try {
      const res = await fetch("/api/categorias", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const mapa: Record<string, string | null> = {};
      for (const c of data.categorias ?? []) {
        mapa[c.nombre] = c.imagenUrl;
      }
      setCategoriaImagenes(mapa);
    } catch (e) {
      console.error("Error al cargar categorías:", e);
    }
  }

  // El precio lo carga el admin directamente en dólares; el precio en Bs
  // que ve el cliente se calcula con la tasa del día.
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
      } as EditingValue,
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
        // Si cambió de categoría, el agrupamiento de la tabla cambia:
        // recargamos todo en vez de parchear en memoria para no desordenar
        // los grupos. También puede haber una categoría nueva, así que
        // refrescamos la lista de categorías (para el panel y el datalist).
        await cargarProductos();
        await cargarCategorias();
      } else {
        alert("No se pudo actualizar el producto.");
      }
    } catch (e) {
      console.error("Error al guardar producto:", e);
    } finally {
      setGuardandoProductoId(null);
    }
  }

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

  // Mueve un producto un lugar arriba/abajo DENTRO de su categoría. Usa la
  // lista completa (no la filtrada por búsqueda) para no desordenar
  // productos que en ese momento están ocultos por el buscador.
  async function moverProducto(product: Product, direccion: "arriba" | "abajo") {
    const grupo = products
      .filter((p) => p.categoria === product.categoria)
      .sort((a, b) => a.orden - b.orden || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

    const idx = grupo.findIndex((p) => p.id === product.id);
    const nuevoIdx = direccion === "arriba" ? idx - 1 : idx + 1;
    if (idx === -1 || nuevoIdx < 0 || nuevoIdx >= grupo.length) return;

    const reordenado = [...grupo];
    const [item] = reordenado.splice(idx, 1);
    reordenado.splice(nuevoIdx, 0, item);

    setReordenandoId(product.id);
    try {
      // Reasigna un orden secuencial (0, 1, 2...) a todo el grupo según el
      // nuevo arreglo, para que quede determinístico de ahí en adelante
      // (antes de la primera vez que se reordena, todos están en 0 y se
      // desempatan por fecha de creación).
      await Promise.all(
        reordenado.map((p, i) =>
          fetch(`/api/products/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orden: i }),
          })
        )
      );
      await cargarProductos();
    } catch (e) {
      console.error("Error al reordenar productos:", e);
      alert("No se pudo reordenar. Intenta de nuevo.");
    } finally {
      setReordenandoId(null);
    }
  }

  async function renombrarCategoria(nombreActual: string) {
    const nuevoNombre = (renombrando[nombreActual] ?? nombreActual).trim();
    if (!nuevoNombre || nuevoNombre === nombreActual) return;

    setGuardandoCategoria(nombreActual);
    try {
      const res = await fetch("/api/categorias/renombrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anterior: nombreActual, nueva: nuevoNombre }),
      });
      if (res.ok) {
        await cargarProductos();
        await cargarCategorias();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo renombrar la categoría.");
      }
    } catch (e) {
      console.error("Error al renombrar categoría:", e);
      alert("Ocurrió un error al renombrar la categoría.");
    } finally {
      setGuardandoCategoria(null);
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
      // Si el admin eligió una imagen, se sube primero: así el producto ya
      // se crea con su foto en vez de tener que ir a buscarlo después para
      // asociársela.
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

  const productosFiltrados = products.filter((p) => {
    const edit = editingValues[p.id];
    const nombreBuscar = edit?.nombre ?? p.nombre;
    return nombreBuscar.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Nombres de categoría únicos, ordenados alfabéticamente.
  const categoriasUnicas = useMemo(
    () => Array.from(new Set(products.map((p) => p.categoria))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const categoriasEnOrden = useMemo(() => {
    const vistas = new Set<string>();
    const cats: string[] = [];
    productosFiltrados.forEach((p) => {
      if (!vistas.has(p.categoria)) {
        vistas.add(p.categoria);
        cats.push(p.categoria);
      }
    });
    return cats;
  }, [productosFiltrados]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-leaf-800">Productos</h1>
        <p className="text-xs text-ink/50 mt-1">
          Agrega productos nuevos, súbeles imagen, organiza sus categorías y edita lo que ya tienes
          cargado — todo desde acá.
        </p>
      </div>

      {/* AGREGAR PRODUCTO NUEVO */}
      <div className="bg-leaf-50/60 border border-leaf-100 rounded-lg p-4">
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

      <hr className="border-leaf-100" />

      {/* CATEGORÍAS: imagen representativa (círculo del catálogo) y
          renombrado en bloque */}
      <div>
        <h2 className="font-display text-xl text-leaf-800 mb-1">Categorías</h2>
        <p className="text-xs text-ink/50 mb-4">
          La foto de cada categoría es la que ve el cliente en el círculo, arriba del catálogo.
          Cambiar el nombre acá lo aplica a todos los productos de esa categoría a la vez.
        </p>
        <div className="flex flex-wrap gap-2">
          {categoriasUnicas.map((cat) => (
            <div
              key={cat}
              className="flex items-center gap-2 bg-white border border-leaf-100 rounded-lg px-2.5 py-2"
            >
              <label
                className="relative shrink-0 w-9 h-9 rounded-full border border-leaf-100 bg-leaf-50 overflow-hidden cursor-pointer group"
                title="Cambiar imagen de la categoría"
              >
                {categoriaImagenes[cat] ? (
                  <img src={categoriaImagenes[cat] as string} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-leaf-300 text-sm">
                    🛒
                  </span>
                )}
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[8px] font-medium opacity-0 group-hover:opacity-100">
                  {subiendoImagenCategoriaId === cat ? "..." : "Cambiar"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={subiendoImagenCategoriaId === cat}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) subirImagenCategoria(cat, file);
                    e.target.value = "";
                  }}
                />
              </label>
              <input
                type="text"
                value={renombrando[cat] ?? cat}
                onChange={(e) => setRenombrando((prev) => ({ ...prev, [cat]: e.target.value }))}
                className="text-sm border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-1.5 py-1 focus:bg-leaf-50/40 focus:outline-none w-32"
              />
              <button
                onClick={() => renombrarCategoria(cat)}
                disabled={guardandoCategoria === cat || (renombrando[cat] ?? cat).trim() === cat}
                className="px-2.5 py-1 rounded-md bg-leaf-600 text-white text-xs font-medium disabled:opacity-30 hover:bg-leaf-700 transition-colors shrink-0"
              >
                {guardandoCategoria === cat ? "..." : "Guardar"}
              </button>
            </div>
          ))}
          {categoriasUnicas.length === 0 && (
            <p className="text-xs text-ink/40">Todavía no hay categorías (agrega un producto primero).</p>
          )}
        </div>
      </div>

      <hr className="border-leaf-100" />

      {/* CATÁLOGO DE PRODUCTOS EDITABLES CON BÚSQUEDA */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl text-leaf-800">Editar productos</h2>
            <p className="text-xs text-ink/50">Carga el precio en dólares ($) de cada producto; el precio en Bs se calcula con la tasa del día</p>
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

        {searchTerm && (
          <p className="text-xs text-clay-600 mb-2">
            Para reordenar productos dentro de una categoría, borra la búsqueda primero.
          </p>
        )}

        {/* Datalist compartido para sugerir categorías existentes al crear o mover un producto */}
        <datalist id="categorias-existentes">
          {categoriasUnicas.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        {/* TABLA DE PRODUCTOS, AGRUPADA POR CATEGORÍA */}
        <div className="bg-white border border-leaf-100 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-leaf-100 bg-leaf-50/50 text-xs font-semibold text-leaf-800">
                  <th className="py-3 px-3 w-16 text-center">Imagen</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-3 w-40">Categoría</th>
                  <th className="py-3 px-3 w-24 text-center">Por peso</th>
                  <th className="py-3 px-3 w-28">Precio ($)</th>
                  <th className="py-3 px-3 w-36 text-right">Precio Cliente (Bs)</th>
                  <th className="py-3 px-3 w-28 text-center">Estado</th>
                  <th className="py-3 px-4 w-28 text-right">Acción</th>
                </tr>
              </thead>

              {categoriasEnOrden.map((cat) => {
                const productosCategoria = productosFiltrados.filter((p) => p.categoria === cat);

                return (
                  <tbody key={cat} className="divide-y divide-leaf-100/50">
                    <tr className="bg-leaf-50/70">
                      <td colSpan={8} className="py-1.5 px-4 text-[11px] font-semibold text-leaf-700 uppercase tracking-wide">
                        {cat} <span className="font-normal text-ink/40 normal-case">({productosCategoria.length})</span>
                      </td>
                    </tr>
                    {productosCategoria.map((product, idxEnCategoria) => {
                      const edit = editingValues[product.id] || {
                        nombre: product.nombre,
                        precioUsd: product.precioUsd?.toString() ?? "0",
                        porPeso: Boolean(product.porPeso),
                        categoria: product.categoria,
                      };

                      const precioBs = calcularPrecioBs(edit.precioUsd);
                      const estaGuardando = guardandoProductoId === product.id;
                      const puedeReordenar = !searchTerm;

                      return (
                        <tr key={product.id} className={`hover:bg-leaf-50/20 ${!product.activo ? "opacity-50" : ""}`}>
                          {/* IMAGEN */}
                          <td className="py-2 px-3">
                            <label
                              className="relative block w-11 h-11 rounded-lg border border-leaf-100 bg-leaf-50 overflow-hidden cursor-pointer group mx-auto"
                              title="Cambiar imagen del producto"
                            >
                              {product.imagenUrl ? (
                                <img
                                  src={product.imagenUrl}
                                  alt={product.nombre}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="w-full h-full flex items-center justify-center text-leaf-300 text-lg">
                                  🛒
                                </span>
                              )}
                              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[9px] font-medium opacity-0 group-hover:opacity-100">
                                {subiendoImagenId === product.id ? "..." : "Cambiar"}
                              </span>
                              {/* Insignia de cámara siempre visible (no solo
                                  con hover), para que en móvil/táctil quede
                                  claro que la miniatura se puede tocar para
                                  cambiar la imagen. */}
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
                                  if (file) subirImagen(product, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </td>
                          {/* NOMBRE */}
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1.5">
                              {puedeReordenar && (
                                <div className="flex flex-col shrink-0">
                                  <button
                                    onClick={() => moverProducto(product, "arriba")}
                                    disabled={idxEnCategoria === 0 || reordenandoId !== null}
                                    className="text-ink/40 hover:text-leaf-700 disabled:opacity-20 disabled:hover:text-ink/40 leading-none text-xs px-1"
                                    aria-label={`Mover ${product.nombre} hacia arriba en su categoría`}
                                    title="Mover arriba"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => moverProducto(product, "abajo")}
                                    disabled={idxEnCategoria === productosCategoria.length - 1 || reordenandoId !== null}
                                    className="text-ink/40 hover:text-leaf-700 disabled:opacity-20 disabled:hover:text-ink/40 leading-none text-xs px-1"
                                    aria-label={`Mover ${product.nombre} hacia abajo en su categoría`}
                                    title="Mover abajo"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}
                              <input
                                type="text"
                                value={edit.nombre}
                                onChange={(e) => handleProductChange(product.id, "nombre", e.target.value)}
                                className="w-full border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-2 py-1 focus:bg-white focus:outline-none"
                              />
                            </div>
                          </td>

                          {/* CATEGORÍA */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              list="categorias-existentes"
                              value={edit.categoria}
                              onChange={(e) => handleProductChange(product.id, "categoria", e.target.value)}
                              className="w-full border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-2 py-1 focus:bg-white focus:outline-none text-xs"
                              title="Escribí una categoría existente o una nueva, y tocá Guardar"
                            />
                          </td>

                          {/* POR PESO (KG) */}
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={edit.porPeso}
                              onChange={(e) => handleProductChange(product.id, "porPeso", e.target.checked)}
                              className="w-4 h-4 accent-leaf-600 cursor-pointer"
                              title="Se vende por kilogramo (el precio es por kg)"
                            />
                          </td>

                          {/* PRECIO ($) */}
                          <td className="py-2 px-3">
                            <div className="relative flex items-center">
                              <span className="absolute left-2 text-xs text-ink/40">$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={edit.precioUsd}
                                onChange={(e) => handleProductChange(product.id, "precioUsd", e.target.value)}
                                className="w-full pl-5 pr-1 py-1 border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded focus:bg-white focus:outline-none"
                              />
                              {edit.porPeso && (
                                <span className="absolute right-1 text-[10px] text-ink/40">/kg</span>
                              )}
                            </div>
                          </td>

                          {/* PRECIO CLIENTE EN BS */}
                          <td className="py-2 px-3 text-right">
                            <span className="font-semibold text-leaf-800">
                              {precioBs} Bs{edit.porPeso && <span className="text-ink/40 font-normal">/kg</span>}
                            </span>
                          </td>

                          {/* ESTADO / DISPONIBILIDAD */}
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${product.activo
                                  ? "bg-leaf-100 text-leaf-800"
                                  : "bg-alert-100 text-alert-600"
                                }`}
                            >
                              {product.activo ? "Disponible" : "Sin stock"}
                            </span>
                          </td>

                          {/* BOTÓN GUARDAR */}
                          <td className="py-2 px-4 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => guardarProducto(product.id)}
                                disabled={estaGuardando}
                                className="px-3 py-1.5 rounded-lg bg-leaf-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors"
                              >
                                {estaGuardando ? "..." : "Guardar"}
                              </button>
                              <button
                                onClick={() => toggleDisponibilidad(product)}
                                disabled={cambiandoDisponibilidadId === product.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors border ${product.activo
                                    ? "border-alert-600 text-alert-600 hover:bg-alert-50"
                                    : "border-leaf-600 text-leaf-600 hover:bg-leaf-50"
                                  }`}
                              >
                                {cambiandoDisponibilidadId === product.id
                                  ? "..."
                                  : product.activo
                                    ? "Desactivar"
                                    : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}

              {productosFiltrados.length === 0 && (
                <tbody>
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs text-ink/50">
                      {searchTerm ? "No se encontraron productos." : "No hay productos disponibles."}
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

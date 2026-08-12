"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { precioBs as calcPrecioBsConGanancia } from "@/lib/precio";
import { normalizarTexto } from "@/lib/texto";

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
  // Solo aplica si porPeso = true: además de pedirse por peso (kg), se
  // puede pedir por unidades sueltas (ej. "3 tomates"). El precio SIEMPRE
  // es por peso (precioUsd) — pesoEstimadoUnidadGramos es el peso promedio
  // de una unidad, usado solo para mostrarle un precio estimado al cliente.
  permiteUnidad?: boolean;
  pesoEstimadoUnidadGramos?: number | null;
  // Solo tiene sentido si porPeso = false: permite vender también MEDIA
  // unidad (0.5), ej. medio cartón de huevos — descuenta del mismo
  // producto, no crea uno aparte.
  permiteMedia?: boolean;
  orden: number;
  createdAt?: string;
};

type EditingValue = {
  nombre: string;
  precioUsd: string;
  porPeso: boolean;
  categoria: string;
  permiteUnidad: boolean;
  pesoEstimadoUnidadGramos: string;
  permiteMedia: boolean;
};

export default function AdminProductosPage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [ganancia, setGanancia] = useState<number>(0);

  // Estados para gestión de productos
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Filtro de disponibilidad: "TODOS", "ACTIVOS" (con stock) o "INACTIVOS"
  // (desactivados / sin stock), para ubicar rápido los productos apagados.
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("TODOS");
  const [editingValues, setEditingValues] = useState<Record<string, EditingValue>>({});
  const [guardandoProductoId, setGuardandoProductoId] = useState<string | null>(null);
  const [cambiandoDisponibilidadId, setCambiandoDisponibilidadId] = useState<string | null>(null);
  const [subiendoImagenId, setSubiendoImagenId] = useState<string | null>(null);
  const [reordenandoId, setReordenandoId] = useState<string | null>(null);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  // Estados para el panel de "Categorías" (renombrar en bloque + imagen)
  const [renombrando, setRenombrando] = useState<Record<string, string>>({});
  const [guardandoCategoria, setGuardandoCategoria] = useState<string | null>(null);
  const [eliminandoCategoria, setEliminandoCategoria] = useState<string | null>(null);
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
        setGanancia(d.ganancia ?? 0);
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
          permiteUnidad: Boolean(p.permiteUnidad),
          pesoEstimadoUnidadGramos: p.pesoEstimadoUnidadGramos?.toString() ?? "",
          permiteMedia: Boolean(p.permiteMedia),
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
  // que ve el cliente se calcula con la tasa del día MÁS la ganancia por
  // producto configurada en Configuración: (precio + ganancia) x tasa.
  function calcularPrecioBs(precioUsdStr: string): string {
    const precioUsd = parseFloat(precioUsdStr);
    if (isNaN(precioUsd) || precioUsd <= 0) return "0.00";

    return calcPrecioBsConGanancia(precioUsd, ganancia, tasaCambio).toFixed(2);
  }

  function handleProductChange(
    id: string,
    field: "nombre" | "precioUsd" | "porPeso" | "categoria" | "permiteUnidad" | "pesoEstimadoUnidadGramos" | "permiteMedia",
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
        permiteUnidad: val.porPeso ? val.permiteUnidad : false,
        pesoEstimadoUnidadGramos: val.porPeso && val.permiteUnidad ? (parseFloat(val.pesoEstimadoUnidadGramos) || 0) : null,
        permiteMedia: !val.porPeso && val.permiteMedia,
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

  // Reordenar arrastrando: el agarre (⠿) de cada producto usa Pointer Events
  // (en vez del drag&drop nativo del navegador) para que funcione igual con
  // mouse y con el dedo en celular/tablet. Se suelta sobre otra fila de la
  // MISMA categoría. Usa la lista completa (no la filtrada por búsqueda)
  // para no desordenar productos que en ese momento están ocultos por el
  // buscador.
  function handlePointerDown(e: PointerEvent<HTMLButtonElement>, product: Product) {
    if (searchTerm || filtroDisponibilidad !== "TODOS" || reordenandoId || draggedProductId) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedProductId(product.id);
    setDragOverProductId(null);
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!draggedProductId) return;
    e.preventDefault();

    // Auto-scroll de la página cuando se arrastra cerca del borde superior
    // o inferior de la pantalla, para listas largas en celular.
    const margen = 60;
    if (e.clientY < margen) {
      window.scrollBy({ top: -14 });
    } else if (e.clientY > window.innerHeight - margen) {
      window.scrollBy({ top: 14 });
    }

    const draggedProduct = products.find((p) => p.id === draggedProductId);
    if (!draggedProduct) return;

    const elemento = document.elementFromPoint(e.clientX, e.clientY);
    const fila = elemento?.closest("[data-product-row]") as HTMLElement | null;
    const targetId = fila?.getAttribute("data-product-id") ?? null;

    if (!targetId || targetId === draggedProductId) {
      setDragOverProductId(null);
      return;
    }
    const targetProduct = products.find((p) => p.id === targetId);
    if (!targetProduct || targetProduct.categoria !== draggedProduct.categoria) {
      setDragOverProductId(null);
      return;
    }
    setDragOverProductId(targetId);
  }

  async function handlePointerUp() {
    const draggedId = draggedProductId;
    const targetId = dragOverProductId;
    setDraggedProductId(null);
    setDragOverProductId(null);
    if (!draggedId || !targetId || draggedId === targetId) return;
    await reordenarPorArrastre(draggedId, targetId);
  }

  function handlePointerCancel() {
    setDraggedProductId(null);
    setDragOverProductId(null);
  }

  async function reordenarPorArrastre(draggedId: string, targetId: string) {
    const draggedProduct = products.find((p) => p.id === draggedId);
    const targetProduct = products.find((p) => p.id === targetId);
    if (!draggedProduct || !targetProduct || draggedProduct.categoria !== targetProduct.categoria) return;

    const grupo = products
      .filter((p) => p.categoria === targetProduct.categoria)
      .sort((a, b) => a.orden - b.orden || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

    const fromIdx = grupo.findIndex((p) => p.id === draggedId);
    const toIdx = grupo.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const reordenado = [...grupo];
    const [item] = reordenado.splice(fromIdx, 1);
    reordenado.splice(toIdx, 0, item);

    // Actualización optimista: el nuevo orden se ve al instante en pantalla,
    // sin esperar la respuesta del servidor.
    const ordenPorId = new Map(reordenado.map((p, i) => [p.id, i]));
    setProducts((prev) =>
      prev.map((p) => (ordenPorId.has(p.id) ? { ...p, orden: ordenPorId.get(p.id)! } : p))
    );

    setReordenandoId(draggedId);
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
      await cargarProductos();
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

  async function eliminarCategoria(nombre: string) {
    const cantidad = products.filter((p) => p.categoria === nombre).length;
    const confirmado = window.confirm(
      cantidad > 0
        ? `"${nombre}" tiene ${cantidad} producto(s). Los que nunca se pidieron se van a borrar; los que ya tienen pedidos asociados se van a marcar "Sin stock" en vez de borrarse, para no perder ese historial. ¿Continuar?`
        : `¿Eliminar la categoría "${nombre}"?`
    );
    if (!confirmado) return;

    setEliminandoCategoria(nombre);
    try {
      const res = await fetch("/api/categorias/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (res.ok) {
        const data = await res.json();
        await cargarProductos();
        await cargarCategorias();
        if (data.desactivados > 0) {
          alert(
            `Se borraron ${data.eliminados} producto(s) y se marcaron "Sin stock" ${data.desactivados} que ya tenían pedidos.`
          );
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo eliminar la categoría.");
      }
    } catch (e) {
      console.error("Error al eliminar categoría:", e);
      alert("Ocurrió un error al eliminar la categoría.");
    } finally {
      setEliminandoCategoria(null);
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
            permiteUnidad: Boolean(producto.permiteUnidad),
            pesoEstimadoUnidadGramos: producto.pesoEstimadoUnidadGramos?.toString() ?? "",
            permiteMedia: Boolean(producto.permiteMedia),
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

  // El buscador matchea tanto el nombre del producto como el nombre de su
  // categoría: escribir "Lácteos" filtra a todos los productos de esa
  // categoría, aunque su nombre no contenga esa palabra. Se normaliza
  // (sin acentos, minúsculas) para que buscar "maiz" encuentre "Maíz".
  const productosFiltrados = products.filter((p) => {
    const edit = editingValues[p.id];
    const nombreBuscar = edit?.nombre ?? p.nombre;
    const categoriaBuscar = edit?.categoria ?? p.categoria;
    const q = normalizarTexto(searchTerm);
    const coincideBusqueda =
      normalizarTexto(nombreBuscar).includes(q) || normalizarTexto(categoriaBuscar).includes(q);
    const coincideDisponibilidad =
      filtroDisponibilidad === "TODOS" ||
      (filtroDisponibilidad === "ACTIVOS" && p.activo) ||
      (filtroDisponibilidad === "INACTIVOS" && !p.activo);
    return coincideBusqueda && coincideDisponibilidad;
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

      {/* CATEGORÍAS: imagen representativa (círculo del catálogo) y
          renombrado en bloque */}
      <div>
        <h2 className="font-display text-xl text-leaf-800 mb-1">Categorías</h2>
        <p className="text-xs text-ink/50 mb-4">
          La foto de cada categoría es la que ve el cliente en el círculo, arriba del catálogo.
          Cambiar el nombre acá lo aplica a todos los productos de esa categoría a la vez.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {categoriasUnicas.map((cat) => (
            <div
              key={cat}
              className="flex items-center gap-2 bg-white border border-leaf-100 rounded-lg px-2.5 py-2 min-w-0"
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
                className="text-sm border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-1.5 py-1 focus:bg-leaf-50/40 focus:outline-none min-w-0 flex-1"
              />
              <button
                onClick={() => renombrarCategoria(cat)}
                disabled={guardandoCategoria === cat || (renombrando[cat] ?? cat).trim() === cat}
                className="px-2.5 py-1 rounded-md bg-leaf-600 text-white text-xs font-medium disabled:opacity-30 hover:bg-leaf-700 transition-colors shrink-0"
              >
                {guardandoCategoria === cat ? "..." : "Guardar"}
              </button>
              <button
                onClick={() => eliminarCategoria(cat)}
                disabled={eliminandoCategoria === cat}
                title="Eliminar categoría"
                className="px-2 py-1 rounded-md border border-alert-600 text-alert-600 text-xs font-medium disabled:opacity-30 hover:bg-alert-50 transition-colors shrink-0"
              >
                {eliminandoCategoria === cat ? "..." : "🗑"}
              </button>
            </div>
          ))}
          {categoriasUnicas.length === 0 && (
            <p className="text-xs text-ink/40">Todavía no hay categorías (agrega un producto primero).</p>
          )}
        </div>
      </div>

      <hr className="border-leaf-100" />

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

      {/* CATÁLOGO DE PRODUCTOS EDITABLES CON BÚSQUEDA */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl text-leaf-800">Editar productos</h2>
            <p className="text-xs text-ink/50">Carga el precio en dólares ($) de cada producto; el precio en Bs se calcula con la tasa del día</p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
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

            {/* FILTRO POR DISPONIBILIDAD */}
            <div className="flex gap-1.5">
              {(
                [
                  { valor: "TODOS", etiqueta: "Todos" },
                  { valor: "ACTIVOS", etiqueta: "Disponibles" },
                  { valor: "INACTIVOS", etiqueta: "Sin stock" },
                ] as const
              ).map((op) => {
                const activo = filtroDisponibilidad === op.valor;
                const cantidad =
                  op.valor === "TODOS"
                    ? products.length
                    : op.valor === "ACTIVOS"
                      ? products.filter((p) => p.activo).length
                      : products.filter((p) => !p.activo).length;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => setFiltroDisponibilidad(op.valor)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${activo
                      ? "bg-leaf-600 text-white border-leaf-600"
                      : "bg-white text-ink/70 border-leaf-100 hover:border-leaf-300"
                      }`}
                  >
                    {op.etiqueta} ({cantidad})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(searchTerm || filtroDisponibilidad !== "TODOS") && (
          <p className="text-xs text-clay-600 mb-2">
            Para reordenar productos dentro de una categoría, borra la búsqueda y el filtro primero.
          </p>
        )}

        {/* Datalist compartido para sugerir categorías existentes al crear o mover un producto */}
        <datalist id="categorias-existentes">
          {categoriasUnicas.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        {/* LISTADO DE PRODUCTOS, AGRUPADO POR CATEGORÍA. Se usan tarjetas
            apiladas (nombre arriba, el resto de los campos abajo en una
            cuadrícula) en vez de una tabla ancha, para que no haga falta
            escrollear horizontalmente y los campos editables sean más
            grandes y legibles. */}
        <div className="bg-white border border-leaf-100 rounded-lg overflow-hidden shadow-sm">
          {categoriasEnOrden.map((cat) => {
            const productosCategoria = productosFiltrados.filter((p) => p.categoria === cat);

            return (
              <div key={cat}>
                <div className="py-1.5 px-4 text-[11px] font-semibold text-leaf-700 uppercase tracking-wide bg-leaf-50/70 border-b border-leaf-100">
                  {cat} <span className="font-normal text-ink/40 normal-case">({productosCategoria.length})</span>
                </div>

                <div className="divide-y divide-leaf-100/50">
                  {productosCategoria.map((product) => {
                    const edit = editingValues[product.id] || {
                      nombre: product.nombre,
                      precioUsd: product.precioUsd?.toString() ?? "0",
                      porPeso: Boolean(product.porPeso),
                      categoria: product.categoria,
                      permiteUnidad: Boolean(product.permiteUnidad),
                      pesoEstimadoUnidadGramos: product.pesoEstimadoUnidadGramos?.toString() ?? "",
                      permiteMedia: Boolean(product.permiteMedia),
                    };

                    const precioBs = calcularPrecioBs(edit.precioUsd);
                    const estaGuardando = guardandoProductoId === product.id;
                    const puedeReordenar = !searchTerm && filtroDisponibilidad === "TODOS";

                    return (
                      <div
                        key={product.id}
                        data-product-row
                        data-product-id={product.id}
                        className={`p-3 sm:p-4 transition-colors ${!product.activo ? "opacity-50" : ""} ${draggedProductId === product.id ? "opacity-40" : "hover:bg-leaf-50/20"
                          } ${dragOverProductId === product.id ? "bg-leaf-100/70 ring-2 ring-inset ring-leaf-400" : ""}`}
                      >
                        {/* FILA SUPERIOR: imagen + nombre (ocupa todo el ancho) + estado */}
                        <div className="flex items-center gap-3 mb-3">
                          <label
                            className="relative shrink-0 block w-12 h-12 rounded-lg border border-leaf-100 bg-leaf-50 overflow-hidden cursor-pointer group"
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

                          {puedeReordenar && (
                            <button
                              type="button"
                              onPointerDown={(e) => handlePointerDown(e, product)}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerCancel}
                              disabled={reordenandoId !== null}
                              style={{ touchAction: "none" }}
                              className="shrink-0 cursor-grab active:cursor-grabbing text-ink/30 hover:text-leaf-700 disabled:opacity-20 text-lg leading-none px-1 touch-none select-none"
                              aria-label={`Arrastrar ${product.nombre} para reordenar dentro de su categoría`}
                              title="Arrastrar para reordenar"
                            >
                              ⠿
                            </button>
                          )}

                          <input
                            type="text"
                            value={edit.nombre}
                            onChange={(e) => handleProductChange(product.id, "nombre", e.target.value)}
                            className="flex-1 min-w-0 text-base font-medium border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded-lg px-3 py-2 focus:bg-white focus:outline-none"
                          />

                          <span
                            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${product.activo
                              ? "bg-leaf-100 text-leaf-800"
                              : "bg-alert-100 text-alert-600"
                              }`}
                          >
                            {product.activo ? "Disponible" : "Sin stock"}
                          </span>
                        </div>

                        {/* FILA INFERIOR: categoría, precio, precio en Bs y "por peso" —
                            en cuadrícula que se acomoda al ancho de pantalla, sin scroll horizontal */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-ink/50 mb-1">Categoría</label>
                            <input
                              type="text"
                              list="categorias-existentes"
                              value={edit.categoria}
                              onChange={(e) => handleProductChange(product.id, "categoria", e.target.value)}
                              className="w-full text-sm border border-leaf-100 hover:border-leaf-300 focus:border-leaf-500 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-none"
                              title="Escribí una categoría existente o una nueva, y tocá Guardar"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-ink/50 mb-1">Precio ($)</label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-sm text-ink/40">$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={edit.precioUsd}
                                onChange={(e) => handleProductChange(product.id, "precioUsd", e.target.value)}
                                className="w-full text-sm pl-7 pr-2 py-2.5 border border-leaf-100 hover:border-leaf-300 focus:border-leaf-500 rounded-lg focus:bg-white focus:outline-none"
                              />
                              {edit.porPeso && (
                                <span className="absolute right-2 text-[10px] text-ink/40">/kg</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-ink/50 mb-1">Precio cliente (Bs)</label>
                            <div className="text-sm font-semibold text-leaf-800 px-3 py-2.5 bg-leaf-50 rounded-lg">
                              {precioBs} Bs{edit.porPeso && <span className="text-ink/40 font-normal"> /kg</span>}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-ink/50 mb-1">Por peso</label>
                            <label className="flex items-center gap-2 text-sm text-ink/70 border border-leaf-100 rounded-lg px-3 py-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={edit.porPeso}
                                onChange={(e) => handleProductChange(product.id, "porPeso", e.target.checked)}
                                className="w-4 h-4 accent-leaf-600 cursor-pointer"
                                title="Se vende por kilogramo (el precio es por kg)"
                              />
                              Se vende por kg
                            </label>
                          </div>
                        </div>

                        {/* Venta híbrida: solo tiene sentido si el producto ya
                            se vende por peso. Permite ADEMÁS pedirlo por
                            unidades sueltas (ej. "3 tomates") como forma más
                            cómoda de pedir — el precio SIEMPRE se cobra por
                            peso (el de arriba), nunca hay un precio fijo por
                            unidad. El peso estimado por unidad solo sirve
                            para mostrarle al cliente un precio aproximado;
                            la tienda confirma el peso real al recibir el
                            pedido. */}
                        {edit.porPeso && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                            <div>
                              <label className="block text-[11px] font-medium text-ink/50 mb-1">También por unidad</label>
                              <label className="flex items-center gap-2 text-sm text-ink/70 border border-clay-200 rounded-lg px-3 py-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={edit.permiteUnidad}
                                  onChange={(e) => handleProductChange(product.id, "permiteUnidad", e.target.checked)}
                                  className="w-4 h-4 accent-clay-600 cursor-pointer"
                                  title='Además de por kg, el cliente puede pedir "N unidades" (ej. 3 tomates) — el precio se sigue cobrando por peso'
                                />
                                Ej: "3 tomates"
                              </label>
                            </div>

                            {edit.permiteUnidad && (
                              <div>
                                <label className="block text-[11px] font-medium text-ink/50 mb-1">Peso aprox. por unidad (g)</label>
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    step="1"
                                    placeholder="Ej: 150"
                                    value={edit.pesoEstimadoUnidadGramos}
                                    onChange={(e) => handleProductChange(product.id, "pesoEstimadoUnidadGramos", e.target.value)}
                                    className="w-full text-sm pl-3 pr-2 py-2.5 border border-clay-200 hover:border-clay-400 focus:border-clay-600 rounded-lg focus:bg-white focus:outline-none"
                                    title="Peso promedio de UNA unidad, para calcular el precio estimado que ve el cliente"
                                  />
                                  <span className="absolute right-2 text-[10px] text-ink/40">g/unidad</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Venta por media unidad: solo tiene sentido para un
                            producto normal por unidad (no por peso). Permite
                            que, además de la unidad completa, el cliente
                            pueda pedir MEDIA (0.5) — ej. medio cartón de
                            huevos. El precio de arriba sigue siendo el de la
                            unidad completa; medio cobra la mitad. Ambas
                            opciones descuentan del mismo producto. */}
                        {!edit.porPeso && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                            <div>
                              <label className="block text-[11px] font-medium text-ink/50 mb-1">También por media</label>
                              <label className="flex items-center gap-2 text-sm text-ink/70 border border-clay-200 rounded-lg px-3 py-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={edit.permiteMedia}
                                  onChange={(e) => handleProductChange(product.id, "permiteMedia", e.target.checked)}
                                  className="w-4 h-4 accent-clay-600 cursor-pointer"
                                  title='Además de la unidad completa, el cliente puede pedir media (0.5) — ej. "medio cartón" — al mismo precio por unidad, cobrado a la mitad'
                                />
                                Ej: "medio cartón"
                              </label>
                            </div>
                          </div>
                        )}

                        {/* BOTONES DE ACCIÓN */}
                        <div className="flex justify-end gap-2 mt-3">
                          <button
                            onClick={() => guardarProducto(product.id)}
                            disabled={estaGuardando}
                            className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors"
                          >
                            {estaGuardando ? "..." : "Guardar"}
                          </button>
                          <button
                            onClick={() => toggleDisponibilidad(product)}
                            disabled={cambiandoDisponibilidadId === product.id}
                            className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors border ${product.activo
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
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {productosFiltrados.length === 0 && (
            <div className="py-6 text-center text-xs text-ink/50">
              {searchTerm || filtroDisponibilidad !== "TODOS"
                ? "No se encontraron productos con ese filtro."
                : "No hay productos disponibles."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
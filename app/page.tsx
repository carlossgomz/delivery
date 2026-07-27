"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HORARIO_ATENCION } from "@/lib/horario";
import { formatCantidad } from "@/lib/peso";

type Product = {
  id: string;
  nombre: string;
  precioUsd: number;
  categoria: string;
  activo: boolean;
  imagenUrl?: string | null;
  // Si es true, precioUsd es el precio POR KILO y "cantidad" en el carrito
  // se interpreta como kilogramos (puede traer decimales) en vez de
  // unidades.
  porPeso: boolean;
};

type Cliente = { id: string; nombre: string };

type CartLine = { productId: string; cantidad: number };

const CART_KEY = "delivery_cart";
const ACTIVE_ORDER_KEY = "active_order_id";
// Misma clave que usa ContactoTienda.tsx para identificar al cliente
// invitado (sin cuenta) en este navegador.
const CLIENTE_ID_KEY = "delivery_cliente_id";

function obtenerClienteIdInvitado(): string {
  let id = localStorage.getItem(CLIENTE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENTE_ID_KEY, id);
  }
  return id;
}

export default function CatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [pedidosHabilitados, setPedidosHabilitados] = useState<boolean>(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  // Peso que el cliente está escribiendo para un producto por kilo, pero
  // que todavía no confirmó (no se agrega al carrito hasta que confirme).
  const [pesoDrafts, setPesoDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cartCargado, setCartCargado] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pedidoActivoId, setPedidoActivoId] = useState<string | null>(null);
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  // Id (de cuenta si hay sesión, o invitado guardado en este navegador)
  // usado para consultar la burbuja de mensajes nuevos del botón Contacto.
  const [clienteIdChat, setClienteIdChat] = useState<string | null>(null);

  async function cargarMensajesNoLeidos(id: string) {
    try {
      const res = await fetch(`/api/chat/no-leidos?clienteId=${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMensajesNoLeidos(data.noLeidos || 0);
    } catch (e) {
      console.error("Error al cargar mensajes no leídos:", e);
    }
  }

  // Estados que cuentan como "pedido pendiente" para la burbuja del botón
  // Pedidos: cualquier cosa que todavía no llegó a un estado final.
  const ESTADOS_FINALES = ["ENTREGADO", "CANCELADO"];

  // Estados para búsqueda y categoría
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // Resumen del carrito: lista editable (sumar/restar/quitar) que se
  // despliega junto a la barra inferior, para no tener que scrollear el
  // catálogo buscando lo que ya se seleccionó.
  const [mostrarResumen, setMostrarResumen] = useState(false);

  // --- Feedback visual de "producto agregado" ---
  // recienAgregadoId: id del producto cuya tarjeta debe mostrar el aro que
  // "late" (se limpia solo con un timeout, por eso siempre se guarda el
  // id del timeout anterior para poder cancelarlo si se agrega rápido dos
  // veces el mismo producto).
  const [recienAgregadoId, setRecienAgregadoId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const toastIdRef = useRef(0);
  const pulsoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notificarAgregado(productId: string, texto: string) {
    setRecienAgregadoId(productId);
    if (pulsoTimeoutRef.current) clearTimeout(pulsoTimeoutRef.current);
    pulsoTimeoutRef.current = setTimeout(() => {
      setRecienAgregadoId((prev) => (prev === productId ? null : prev));
    }, 900);

    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1700);
  }

  async function cargarPedidosPendientes() {
    try {
      const res = await fetch("/api/clientes/pedidos", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const orders = Array.isArray(data.orders) ? data.orders : [];
      const pendientes = orders.filter(
        (o: { estado: string }) => !ESTADOS_FINALES.includes(o.estado)
      ).length;
      setPedidosPendientes(pendientes);
    } catch (e) {
      console.error("Error al cargar pedidos pendientes:", e);
    }
  }

  // Refresca el conteo cada pocos segundos para que la burbuja del botón
  // Pedidos se actualice sola (ej. cuando la tienda confirma un pago).
  useEffect(() => {
    if (!cliente) return;
    const interval = setInterval(cargarPedidosPendientes, 8000);
    return () => clearInterval(interval);
  }, [cliente]);

  // Igual, pero para la burbuja de mensajes nuevos del botón Contacto;
  // aplica también a invitados sin cuenta, por eso depende de
  // clienteIdChat en vez de cliente.
  useEffect(() => {
    if (!clienteIdChat) return;
    const interval = setInterval(() => cargarMensajesNoLeidos(clienteIdChat), 8000);
    return () => clearInterval(interval);
  }, [clienteIdChat]);

  useEffect(() => {
    async function load() {
      const [pRes, cRes, meRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/config"),
        fetch("/api/clientes/me")
      ]);
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
      setProducts(pData.products);
      setTasaCambio(cData.tasaCambio);
      setPedidosHabilitados(cData.pedidosHabilitados ?? true);
      if (meRes.ok) {
        const meData = await meRes.json();
        setCliente(meData.cliente);
        if (meData.cliente) {
          cargarPedidosPendientes();
        }
        const idParaChat = meData.cliente?.id ?? obtenerClienteIdInvitado();
        setClienteIdChat(idParaChat);
        cargarMensajesNoLeidos(idParaChat);
      }
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
      setPedidoActivoId(localStorage.getItem(ACTIVE_ORDER_KEY));
      setLoading(false);
      // Recién ahora es seguro dejar que el próximo efecto empiece a
      // guardar el carrito: si lo activamos antes, ese efecto escribe el
      // estado inicial (carrito vacío) en localStorage ANTES de que esta
      // función termine de leer y restaurar lo que ya había guardado
      // (por ejemplo, el carrito que se restaura al volver del checkout).
      setCartCargado(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!cartCargado) return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, cartCargado]);

  const categorias = useMemo(() => Array.from(new Set(products.map((p) => p.categoria))), [products]);

  // Filtrado de productos basado en búsqueda y categoría seleccionada.
  // La búsqueda matchea tanto el nombre del producto como el nombre de su
  // categoría: buscar "Refresco" trae los productos que se llaman así Y
  // los que pertenecen a la categoría "Refrescos", aunque su nombre no
  // contenga esa palabra.
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        q === "" ||
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Categorías que tienen productos visibles tras el filtrado
  const activeCategories = useMemo(() => {
    if (selectedCategory !== "Todas") {
      return [selectedCategory];
    }
    return Array.from(new Set(filteredProducts.map((p) => p.categoria)));
  }, [filteredProducts, selectedCategory]);

  function addToCart(productId: string) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) => (l.productId === productId ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [...prev, { productId, cantidad: 1 }];
    });
    // Al agregar el primer artículo, se muestra el resumen automáticamente
    // para que quede a la vista sin tener que buscarlo.
    setMostrarResumen(true);
    const nombre = products.find((p) => p.id === productId)?.nombre ?? "Producto";
    notificarAgregado(productId, `✓ Agregado: ${nombre}`);
  }

  function removeFromCart(productId: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, cantidad: l.cantidad - 1 } : l))
        .filter((l) => l.cantidad > 0)
    );
  }

  function quitarLineaCompleta(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  // --- Carrito para productos por peso (kg) ---
  // fijarPeso deja la cantidad en un valor exacto (usado por los botones de
  // peso sugerido y por el input manual). ajustarPeso suma/resta un delta
  // (usado por los botones +/- del resumen del carrito).
  function fijarPeso(productId: string, kilos: number) {
    setCart((prev) => {
      const limpio = Math.round(kilos * 100) / 100;
      if (limpio <= 0) return prev.filter((l) => l.productId !== productId);
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) => (l.productId === productId ? { ...l, cantidad: limpio } : l));
      }
      return [...prev, { productId, cantidad: limpio }];
    });
    setMostrarResumen(true);
  }

  function ajustarPeso(productId: string, delta: number) {
    const actual = cart.find((l) => l.productId === productId)?.cantidad ?? 0;
    fijarPeso(productId, actual + delta);
    if (delta > 0) {
      const nombre = products.find((p) => p.id === productId)?.nombre ?? "Producto";
      notificarAgregado(productId, `✓ Agregado: ${nombre}`);
    }
  }

  // Total para el badge "N producto(s)": suma unidades normalmente, pero
  // un producto por peso cuenta como 1 (no se suman kilos como si fueran
  // unidades, "0.5 producto(s)" no tendría sentido).
  const totalItems = cart.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p?.porPeso ? 1 : l.cantidad);
  }, 0);
  const totalUsd = cart.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p ? p.precioUsd * l.cantidad : 0);
  }, 0);

  if (loading) {
    return <div className="p-8 text-leaf-600">Cargando catálogo…</div>;
  }

  return (
    <main className="max-w-6xl mx-auto pb-36">
      {/* --- CABECERA + BUSCADOR + CATEGORÍAS: todo fijo mientras se
          scrollea el catálogo, agrupado en un solo bloque sticky. --- */}
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b border-leaf-100 shadow-[0_1px_0_rgba(38,68,35,0.04)]">
        <header className="px-4 pt-3 sm:pt-4 pb-2 flex items-center justify-between gap-2">
          <img
            src="/branding/logo-day-express.png"
            alt="Day Express Supermarket"
            className="h-11 sm:h-14 w-auto shrink-0 object-contain"
          />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Link
              href="/mensajes"
              className="relative shrink-0 flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white border border-leaf-100 text-leaf-700 text-xs sm:text-sm font-medium hover:bg-leaf-50 active:scale-95 transition-all whitespace-nowrap"
              aria-label="Escribir o llamar a la tienda"
            >
              💬 Contacto
              {mensajesNoLeidos > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-alert-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {mensajesNoLeidos > 9 ? "9+" : mensajesNoLeidos}
                </span>
              )}
            </Link>
            {cliente && (
              <Link
                href="/cliente/pedidos"
                className="relative shrink-0 flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white border border-leaf-100 text-leaf-700 text-xs sm:text-sm font-medium hover:bg-leaf-50 active:scale-95 transition-all whitespace-nowrap"
              >
                🛍️ Pedidos
                {pedidosPendientes > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-alert-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {pedidosPendientes > 9 ? "9+" : pedidosPendientes}
                  </span>
                )}
              </Link>
            )}
            <Link
              href={cliente ? "/cliente" : "/cliente/login"}
              className="shrink-0 flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-leaf-600 text-white text-xs sm:text-sm font-medium hover:bg-leaf-800 active:scale-95 transition-all whitespace-nowrap max-w-[9rem] sm:max-w-none truncate"
            >
              {cliente ? (
                <>
                  <span className="sm:hidden">👋 {cliente.nombre.split(" ")[0]}</span>
                  <span className="hidden sm:inline">👋 Hola, {cliente.nombre.split(" ")[0]}</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Entrar</span>
                  <span className="hidden sm:inline">Iniciar sesión</span>
                </>
              )}
            </Link>
          </div>
        </header>

        {/* Input de Búsqueda */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-leaf-600/60 pointer-events-none"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="6.5" />
              <path d="M17.5 17.5 13.5 13.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-16 py-2.5 sm:py-3 rounded-full border border-leaf-100 bg-white text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-leaf-600 transition-all text-sm shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-leaf-700 font-medium hover:text-leaf-800"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Chips de Categorías */}
          <div className="flex gap-2 overflow-x-auto pt-3 pb-0.5 scrollbar-none">
            {["Todas", ...categorias].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === cat
                  ? "bg-leaf-600 text-white shadow-sm"
                  : "bg-white text-ink/70 border border-leaf-100 hover:bg-leaf-100/50"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* --------------------------------------- */}

      <div className="px-4">
        {!pedidosHabilitados && (
          <div className="mt-4 bg-alert-50 border border-alert-200 rounded-lg px-4 py-3">
            <p className="text-sm text-alert-700 font-medium">
              🌙 En este momento no estamos atendiendo pedidos.
            </p>
            <p className="text-xs text-alert-700/80 mt-1">
              Puedes seguir mirando el catálogo. Horario: {HORARIO_ATENCION.linea1} · {HORARIO_ATENCION.linea2}
            </p>
          </div>
        )}

        {pedidoActivoId && (
          <div className="mt-4 flex items-center justify-between gap-3 bg-clay-100 border border-clay-200 rounded-lg px-4 py-3">
            <p className="text-sm text-ink/80">Tienes un pedido en curso.</p>
            <button
              onClick={() => router.push("/checkout")}
              className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-800 transition-colors shrink-0"
            >
              Continuar pedido
            </button>
          </div>
        )}
      </div>

      {/* Catálogo en tarjetas: cuadrícula responsive agrupada por
          categoría (imagen arriba, botón de agregar flotante sobre la
          imagen, nombre y precio abajo). */}
      <div className="px-4">
        {activeCategories.length > 0 ? (
          activeCategories.map((cat) => {
            const categoryProducts = filteredProducts.filter((p) => p.categoria === cat);
            if (categoryProducts.length === 0) return null;

            return (
              <section key={cat} className="mt-6 mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-leaf-700 mb-3">
                  {cat}
                </h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {categoryProducts.map((p) => {
                    const line = cart.find((l) => l.productId === p.id);
                    const precioBs = (p.precioUsd * tasaCambio).toFixed(2);
                    return (
                      <li
                        key={p.id}
                        className={`relative flex flex-col bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${p.activo ? "border-leaf-100" : "border-leaf-100 opacity-60"
                          } ${recienAgregadoId === p.id ? "animate-agregado" : ""}`}
                      >
                        {recienAgregadoId === p.id && (
                          <span
                            className="animate-agregado-badge pointer-events-none absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-leaf-600 text-white text-[10px] font-bold shadow-sm"
                            aria-hidden="true"
                          >
                            ✓ Agregado
                          </span>
                        )}

                        {/* Imagen del producto */}
                        <div className="relative aspect-square bg-leaf-50 overflow-hidden">
                          {p.imagenUrl ? (
                            <img
                              src={p.imagenUrl}
                              alt={p.nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span
                              className="w-full h-full flex items-center justify-center text-leaf-300 text-3xl sm:text-4xl"
                              aria-hidden="true"
                            >
                              🛒
                            </span>
                          )}

                          {!p.activo && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center px-2 text-center">
                              <p className="text-xs font-semibold text-alert-600">No disponible</p>
                            </div>
                          )}

                          {/* Botón flotante de agregar rápido, solo para
                              productos por unidad (los que son por peso
                              usan el selector de kg de abajo). */}
                          {p.activo && !p.porPeso && (
                            line ? (
                              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white rounded-full shadow-md px-1 py-1">
                                <button
                                  onClick={() => removeFromCart(p.id)}
                                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-leaf-400 text-leaf-600 flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                                  aria-label={`Quitar una unidad de ${p.nombre}`}
                                >
                                  −
                                </button>
                                <span className="w-4 sm:w-5 text-center text-xs sm:text-sm font-medium">
                                  {line.cantidad}
                                </span>
                                <button
                                  onClick={() => addToCart(p.id)}
                                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-leaf-600 text-white flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                                  aria-label={`Agregar una unidad de ${p.nombre}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(p.id)}
                                className="absolute bottom-2 right-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-leaf-600 text-white shadow-md flex items-center justify-center text-lg font-bold hover:bg-leaf-800 active:scale-90 transition-all"
                                aria-label={`Agregar ${p.nombre} al carrito`}
                              >
                                +
                              </button>
                            )
                          )}
                        </div>

                        {/* Nombre y precio */}
                        <div className="flex flex-col flex-1 gap-1 px-2.5 sm:px-3 pt-2 pb-2.5 sm:pb-3">
                          <p className="text-xs sm:text-sm font-medium leading-snug line-clamp-2 min-h-[2.2em]">
                            {p.nombre}
                          </p>

                          {p.activo ? (
                            <p className="text-sm sm:text-base font-semibold text-ink">
                              Bs {precioBs}
                              {p.porPeso && <span className="text-ink/40 font-normal text-xs"> /kg</span>}
                            </p>
                          ) : (
                            <p className="text-xs sm:text-sm font-medium text-alert-600">No disponible</p>
                          )}

                          {/* Selector de peso: reemplaza el botón de
                              agregar en productos que se venden por kilo
                              (ej. carnes, quesos). El cliente escribe el
                              peso, ve el precio calculado, y recién se
                              agrega al carrito cuando confirma con el
                              botón (antes se agregaba solo mientras
                              escribía). */}
                          {p.activo && p.porPeso && (() => {
                            const draftRaw = pesoDrafts[p.id];
                            const draftValue =
                              draftRaw !== undefined ? draftRaw : line ? String(line.cantidad) : "";
                            const kilosDraft = parseFloat(draftValue) || 0;
                            const precioEstimadoBs = (kilosDraft * p.precioUsd * tasaCambio).toFixed(2);

                            function limpiarDraft() {
                              setPesoDrafts((prev) => {
                                const next = { ...prev };
                                delete next[p.id];
                                return next;
                              });
                            }

                            function confirmarPeso() {
                              if (kilosDraft > 0) {
                                fijarPeso(p.id, kilosDraft);
                                notificarAgregado(
                                  p.id,
                                  `✓ ${line ? "Actualizado" : "Agregado"}: ${formatCantidad(kilosDraft, true)} de ${p.nombre}`
                                );
                              } else if (line) {
                                quitarLineaCompleta(p.id);
                              }
                              limpiarDraft();
                            }

                            return (
                              <div className="flex flex-col gap-1 mt-0.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0.05}
                                    step={0.05}
                                    placeholder="kg"
                                    value={draftValue}
                                    onChange={(e) =>
                                      setPesoDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                                    }
                                    className="w-full min-w-0 text-xs sm:text-sm border border-leaf-100 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:border-leaf-500"
                                    aria-label={`Peso en kilos de ${p.nombre}`}
                                  />
                                  <span className="shrink-0 text-[10px] sm:text-xs text-ink/50">kg</span>
                                </div>
                                <div className="flex items-center justify-between gap-1.5">
                                  {line ? (
                                    <button
                                      onClick={() => {
                                        quitarLineaCompleta(p.id);
                                        limpiarDraft();
                                      }}
                                      className="text-[10px] sm:text-xs text-alert-600 underline"
                                    >
                                      Quitar
                                    </button>
                                  ) : (
                                    <span />
                                  )}
                                  <button
                                    onClick={confirmarPeso}
                                    disabled={kilosDraft <= 0 && !line}
                                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-leaf-600 text-white text-[11px] sm:text-xs hover:bg-leaf-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {line ? "Actualizar" : "Agregar"}
                                  </button>
                                </div>
                                {kilosDraft > 0 && (
                                  <p className="text-[10px] sm:text-xs text-ink/50">≈ Bs {precioEstimadoBs}</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        ) : (
          <div className="text-center py-12 text-ink/60 text-sm">
            No se encontraron productos que coincidan con la búsqueda.
          </div>
        )}
      </div>

      {/* Toasts de confirmación: uno por cada producto agregado/editado,
          apilados justo encima de la barra del carrito para que se note
          incluso si el resumen de abajo está colapsado. */}
      {toasts.length > 0 && (
        <div
          className={`fixed inset-x-0 z-30 flex flex-col items-center gap-1.5 px-4 pointer-events-none ${totalItems > 0 ? "bottom-24 sm:bottom-28" : "bottom-4"
            }`}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="animate-toast-entrada max-w-full px-3.5 py-2 rounded-full bg-leaf-800 text-white text-xs sm:text-sm font-medium shadow-lg"
            >
              {t.texto}
            </div>
          ))}
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20">
          {/* Lista editable del carrito: sumar, restar o quitar sin tener
              que scrollear el catálogo para encontrar lo seleccionado. */}
          {mostrarResumen && (
            <div className="bg-white border-t border-leaf-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] max-h-64 overflow-y-auto overscroll-contain">
              <div className="max-w-3xl mx-auto px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Tu selección</p>
                <ul className="divide-y divide-leaf-50">
                  {cart.map((line) => {
                    const p = products.find((pr) => pr.id === line.productId);
                    if (!p) return null;
                    return (
                      <li key={line.productId} className="flex items-center justify-between gap-2 py-2">
                        <span className="text-sm text-ink flex-1 min-w-0 truncate">{p.nombre}</span>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <button
                            onClick={() =>
                              p.porPeso ? ajustarPeso(p.id, -0.25) : removeFromCart(p.id)
                            }
                            className="w-8 h-8 rounded-full border border-leaf-400 text-leaf-600 flex items-center justify-center font-bold active:scale-95 transition-transform"
                            aria-label={`Quitar ${p.porPeso ? "250g" : "una unidad"} de ${p.nombre}`}
                          >
                            −
                          </button>
                          <span className="min-w-[3rem] text-center text-sm">
                            {p.porPeso ? `${line.cantidad}kg` : line.cantidad}
                          </span>
                          <button
                            onClick={() =>
                              p.porPeso ? ajustarPeso(p.id, 0.25) : addToCart(p.id)
                            }
                            className="w-8 h-8 rounded-full bg-leaf-600 text-white flex items-center justify-center font-bold active:scale-95 transition-transform"
                            aria-label={`Agregar ${p.porPeso ? "250g" : "una unidad"} de ${p.nombre}`}
                          >
                            +
                          </button>
                          <button
                            onClick={() => quitarLineaCompleta(p.id)}
                            className="ml-0.5 px-2.5 py-1.5 rounded-md text-alert-600 text-xs font-medium hover:bg-alert-50 active:scale-95 transition-all"
                            aria-label={`Quitar ${p.nombre} del carrito`}
                          >
                            Quitar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          <div className="bg-leaf-800 text-white px-4 py-3.5 sm:py-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
              <button
                onClick={() => setMostrarResumen((v) => !v)}
                className="text-left min-w-0"
                aria-expanded={mostrarResumen}
              >
                <p className="text-xs sm:text-sm text-leaf-100 underline decoration-dotted">
                  {totalItems} producto(s) {mostrarResumen ? "▲ ocultar" : "▼ editar"}
                </p>
                <p className="font-medium truncate">Bs {(totalUsd * tasaCambio).toFixed(2)}</p>
              </button>
              <button
                onClick={() => router.push("/checkout")}
                className="shrink-0 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-clay-400 text-ink text-sm sm:text-base font-medium hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
              >
                Proceder con el pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
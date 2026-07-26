"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCantidad } from "@/lib/peso";

type OrderItem = {
  id: string;
  cantidad: number;
  precioUsd: number;
  product: { nombre: string; porPeso?: boolean };
};

type Order = {
  id: string;
  estado: string;
  totalUsd: number | null;
  totalBs: number | null;
  createdAt: string;
  items: OrderItem[];
};

const ETIQUETAS: Record<string, string> = {
  PENDIENTE_VERIFICACION: "Por verificar stock",
  ESPERANDO_PAGO: "Esperando pago",
  PAGO_RECIBIDO: "Pago en revisión",
  PAGO_EN_REVISION: "Pago en revisión",
  CONFIRMADO: "Pago confirmado",
  EN_PREPARACION: "En preparación",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado"
};

const COLORES: Record<string, string> = {
  PENDIENTE_VERIFICACION: "bg-clay-100 text-clay-600",
  ESPERANDO_PAGO: "bg-clay-100 text-clay-600",
  PAGO_RECIBIDO: "bg-amber-100 text-amber-800",
  PAGO_EN_REVISION: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-emerald-100 text-emerald-800",
  EN_PREPARACION: "bg-sky-100 text-sky-800",
  EN_CAMINO: "bg-indigo-100 text-indigo-800",
  ENTREGADO: "bg-leaf-100 text-leaf-800",
  CANCELADO: "bg-alert-100 text-alert-600"
};

export default function MisPedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const meRes = await fetch("/api/clientes/me");
      const meData = await meRes.json();
      if (!meData.cliente) {
        router.push("/cliente/login");
        return;
      }
      const res = await fetch("/api/clientes/pedidos", { cache: "no-store" });
      const data = await res.json();
      if (activo) setOrders(data.orders || []);
    }

    cargar();
    // Refresca solo el estado de los pedidos cada pocos segundos, para que
    // el cliente vea "en preparación" / "en camino" / "entregado" sin tener
    // que recargar la página manualmente.
    const interval = setInterval(cargar, 5000);

    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, [router]);

  if (orders === null) {
    return <div className="p-8 text-leaf-600">Cargando…</div>;
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl text-leaf-800">Mis pedidos</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-leaf-600 underline">
            Volver al catálogo
          </Link>
          <Link href="/cliente" className="text-sm text-leaf-600 underline">
            Mi cuenta
          </Link>
        </div>
      </div>

      {orders.length === 0 && (
        <p className="text-ink/60 text-sm">Todavía no has hecho ningún pedido.</p>
      )}

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border border-leaf-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-ink/60">
                {new Date(order.createdAt).toLocaleDateString("es-VE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </p>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${COLORES[order.estado] ?? "bg-clay-100 text-clay-600"}`}
              >
                {ETIQUETAS[order.estado] ?? order.estado}
              </span>
            </div>
            <ul className="text-sm text-ink/80 space-y-1 mb-2">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.product?.porPeso
                    ? formatCantidad(item.cantidad, true)
                    : `${item.cantidad}×`}{" "}
                  {item.product.nombre}
                </li>
              ))}
            </ul>
            {order.totalUsd != null && (
              <p className="text-sm font-medium text-leaf-800">
                Total: ${order.totalUsd.toFixed(2)} · Bs {order.totalBs?.toFixed(2)}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
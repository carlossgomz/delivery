"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type OrderItem = {
  id: string;
  cantidad: number;
  precioUsd: number;
  product: { nombre: string };
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
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado"
};

export default function MisPedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/clientes/me");
      const meData = await meRes.json();
      if (!meData.cliente) {
        router.push("/cliente/login");
        return;
      }
      const res = await fetch("/api/clientes/pedidos");
      const data = await res.json();
      setOrders(data.orders || []);
    }
    load();
  }, [router]);

  if (orders === null) {
    return <div className="p-8 text-leaf-600">Cargando…</div>;
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl text-leaf-800">Mis pedidos</h1>
        <Link href="/cliente" className="text-sm text-leaf-600 underline">
          Mi cuenta
        </Link>
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
              <span className="text-xs px-2 py-1 rounded-full bg-clay-100 text-clay-600">
                {ETIQUETAS[order.estado] ?? order.estado}
              </span>
            </div>
            <ul className="text-sm text-ink/80 space-y-1 mb-2">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.cantidad}× {item.product.nombre}
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

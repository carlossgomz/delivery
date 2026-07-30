"use client";

import { useEffect, useState } from "react";

type TierItem = { productId: string; nombre: string; unidades: number; tier: string };
type ClienteFrecuente = { nombre: string; telefono: string; pedidos: number; ultimoPedido: string };
type RecordEntrega = { orderId: string; clienteNombre: string; ms: number } | null;

type Estadisticas = {
  totalUnidadesVendidas: number;
  gananciaTotalUsd: number;
  ganancia: number;
  recordEntrega: RecordEntrega;
  promedioEntregaMs: number | null;
  tierList: TierItem[];
  clientesFrecuentes: ClienteFrecuente[];
};

const COLOR_TIER: Record<string, string> = {
  S: "bg-amber-100 text-amber-700 border-amber-400",
  A: "bg-leaf-100 text-leaf-800 border-leaf-400",
  B: "bg-blue-100 text-blue-700 border-blue-400",
  C: "bg-clay-100 text-clay-600 border-clay-400",
  D: "bg-ink/5 text-ink/50 border-ink/10"
};

function formatDuracion(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export default function EstadisticasPage() {
  const [data, setData] = useState<Estadisticas | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/estadisticas")
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudieron cargar las estadísticas.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-sm text-alert-600">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-ink/50">Cargando estadísticas…</p>;
  }

  const maxUnidades = data.tierList.length > 0 ? data.tierList[0].unidades : 0;

  return (
    <div>
      <h1 className="font-display text-xl text-leaf-800 mb-4">Estadísticas de ventas</h1>

      {/* VENTAS TOTALES + GANANCIA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-leaf-100 rounded-lg p-5">
          <p className="text-sm text-ink/60">Productos vendidos en total</p>
          <p className="font-display text-3xl text-leaf-800">
            {data.totalUnidadesVendidas % 1 === 0 ? data.totalUnidadesVendidas : data.totalUnidadesVendidas.toFixed(2)}
          </p>
          <p className="text-xs text-ink/50 mt-1">Solo pedidos ya entregados</p>
        </div>
        <div className="bg-white border border-leaf-100 rounded-lg p-5">
          <p className="text-sm text-ink/60">Ganancia total</p>
          <p className="font-display text-3xl text-leaf-800">${data.gananciaTotalUsd.toFixed(2)}</p>
          <p className="text-xs text-ink/50 mt-1">
            {data.totalUnidadesVendidas % 1 === 0 ? data.totalUnidadesVendidas : data.totalUnidadesVendidas.toFixed(2)} x ${data.ganancia.toFixed(2)}
          </p>
        </div>
      </div>

      {/* RÉCORD DE TIEMPO DE ENTREGA */}
      <div className="bg-white border border-leaf-100 rounded-lg p-5 mb-6">
        <p className="text-sm text-ink/60 mb-1">🏆 Récord de tiempo de entrega</p>
        {data.recordEntrega ? (
          <>
            <p className="font-display text-2xl text-leaf-800">{formatDuracion(data.recordEntrega.ms)}</p>
            <p className="text-xs text-ink/50 mt-1">
              Pedido de {data.recordEntrega.clienteNombre} (#{data.recordEntrega.orderId.slice(0, 8)})
            </p>
          </>
        ) : (
          <p className="text-sm text-ink/50">Todavía no hay pedidos entregados con tiempo registrado.</p>
        )}
        {data.promedioEntregaMs != null && (
          <p className="text-xs text-ink/50 mt-2">Promedio general: {formatDuracion(data.promedioEntregaMs)}</p>
        )}
      </div>

      {/* TIER LIST DE PRODUCTOS */}
      <h2 className="font-display text-lg text-leaf-800 mb-3">Tier list de productos</h2>
      {data.tierList.length === 0 ? (
        <p className="text-sm text-ink/50 mb-6">Todavía no hay ventas registradas.</p>
      ) : (
        <div className="bg-white border border-leaf-100 rounded-lg divide-y divide-leaf-50 mb-8">
          {data.tierList.map((p, idx) => (
            <div key={p.productId} className="flex items-center gap-3 p-3">
              <span className="text-xs text-ink/40 w-6 text-right shrink-0">{idx + 1}</span>
              <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center font-display font-bold ${COLOR_TIER[p.tier]}`}>
                {p.tier}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink/80 truncate">{p.nombre}</p>
                <div className="h-1.5 bg-leaf-50 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-leaf-600 rounded-full"
                    style={{ width: `${maxUnidades > 0 ? (p.unidades / maxUnidades) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-leaf-800 shrink-0">
                {p.unidades % 1 === 0 ? p.unidades : p.unidades.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CLIENTES FRECUENTES */}
      <h2 className="font-display text-lg text-leaf-800 mb-3">Clientes frecuentes</h2>
      {data.clientesFrecuentes.length === 0 ? (
        <p className="text-sm text-ink/50">Todavía no hay pedidos registrados.</p>
      ) : (
        <div className="bg-white border border-leaf-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-leaf-50 text-ink/60 text-left">
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium">Teléfono</th>
                <th className="p-3 font-medium text-right">Pedidos</th>
                <th className="p-3 font-medium text-right">Último pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-leaf-50">
              {data.clientesFrecuentes.map((c, idx) => (
                <tr key={c.telefono}>
                  <td className="p-3 text-ink/40">{idx + 1}</td>
                  <td className="p-3 text-ink/80">{c.nombre}</td>
                  <td className="p-3 text-ink/60">{c.telefono}</td>
                  <td className="p-3 text-right font-medium text-leaf-800">{c.pedidos}</td>
                  <td className="p-3 text-right text-ink/50 text-xs">
                    {new Date(c.ultimoPedido).toLocaleDateString("es-VE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

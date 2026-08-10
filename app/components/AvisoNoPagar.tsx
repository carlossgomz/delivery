"use client";

// Modal de advertencia reutilizado en dos momentos del flujo de compra
// (catálogo → checkout, y datos de entrega → envío del pedido): recuerda
// al cliente que todavía NO debe pagar hasta que la tienda confirme la
// disponibilidad real de los productos. Se muestra las dos veces porque
// son los dos puntos donde el cliente podría adelantarse a pagar sin
// haber visto el aviso.
export default function AvisoNoPagar({
  open,
  onContinuar,
  onCancelar,
}: {
  open: boolean;
  onContinuar: () => void;
  onCancelar: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50 px-4 py-6">
      <div className="w-full sm:max-w-sm bg-white rounded-2xl shadow-xl p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl shrink-0" aria-hidden="true">
            ⚠️
          </span>
          <h2 className="font-display text-lg text-leaf-800 pt-0.5">Todavía no realices el pago</h2>
        </div>
        <p className="text-sm text-ink/70 mb-5">
          Primero debemos confirmar que los productos de tu pedido estén disponibles. Una vez la
          tienda los verifique, te lo indicaremos claramente en pantalla y ahí sí podrás pagar.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onContinuar}
            className="w-full px-4 py-2.5 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-800 active:scale-95 transition-all"
          >
            Entendido, continuar
          </button>
          <button
            onClick={onCancelar}
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-leaf-200 text-leaf-700 text-sm font-medium hover:bg-leaf-50 active:scale-95 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

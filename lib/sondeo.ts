// Sondeo (polling) que respeta la visibilidad de la pestaña: cada consulta es
// una invocación de función en Vercel, y una pestaña olvidada en segundo plano
// consultando cada pocos segundos gasta la cuota mensual sin que nadie mire.
//
// Con la pestaña oculta consulta cada `msOculta` (null = no consulta). Al volver
// a estar visible consulta enseguida, sin esperar al próximo intervalo.
export function iniciarSondeo(
  consultar: () => void,
  msVisible: number,
  msOculta: number | null = null
): () => void {
  let intervalo: ReturnType<typeof setInterval> | null = null;

  function programar() {
    if (intervalo) clearInterval(intervalo);
    intervalo = null;
    const ms = document.visibilityState === "visible" ? msVisible : msOculta;
    if (ms !== null) intervalo = setInterval(consultar, ms);
  }

  function alCambiarVisibilidad() {
    if (document.visibilityState === "visible") consultar();
    programar();
  }

  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  programar();

  return () => {
    if (intervalo) clearInterval(intervalo);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  };
}

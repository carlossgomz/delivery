// Sonido de alerta para el panel de admin: se usa cuando llega un pedido
// nuevo o cuando un cliente manda su comprobante de pago. Antes era un solo
// "bip" y a veces pasaba desapercibido si el admin estaba en otra pestaña o
// concentrado en otro pedido — ahora son 3 bips más fuertes y agudos,
// pensado para que se note incluso sin estar mirando la pantalla.
export function reproducirAlerta() {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const NOTAS = [1046.5, 1318.5, 1568.0]; // C6, E6, G6: un "ding-ding-ding" claro y agudo
    const inicio = ctx.currentTime;
    const duracionNota = 0.22;
    const separacion = 0.26;

    NOTAS.forEach((frecuencia, i) => {
      const t = inicio + i * separacion;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frecuencia, t);

      // Más fuerte que antes (0.3 -> 0.5) para que resalte sobre el
      // sonido normal del sistema operativo o de otras pestañas.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duracionNota);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + duracionNota + 0.02);
    });

    // Cierra el contexto de audio después de sonar para no acumular
    // contextos abiertos si esto se llama muchas veces seguidas.
    setTimeout(() => ctx.close().catch(() => {}), (inicio + NOTAS.length * separacion + 0.3 - ctx.currentTime) * 1000);
  } catch {
    // Silencia fallos en reproducción automática (ej. el navegador todavía
    // no detectó ninguna interacción del usuario en la página).
  }
}

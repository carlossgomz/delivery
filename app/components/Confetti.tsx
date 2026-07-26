"use client";

import { useMemo } from "react";

// Paleta alegre para la celebración (no se limita a los colores de marca,
// para que se sienta como una fiesta de verdad).
const COLORES = ["#3C6B37", "#F5B942", "#E2725B", "#4F86C6", "#B8E986", "#FFD166", "#EF476F", "#06D6A0"];

type PiezaCaida = {
  id: string;
  left: number;
  delay: number;
  duracion: number;
  rotacionFinal: number;
  color: string;
  ancho: number;
  alto: number;
  redonda: boolean;
};

type PiezaEstallido = {
  id: string;
  dx: number;
  dy: number;
  delay: number;
  color: string;
  tamano: number;
};

// Animación de una sola vez: un estallido de partículas desde el centro
// (la "explosión") combinado con confeti cayendo desde arriba. No requiere
// ninguna librería externa, solo CSS (ver .confetti-* en globals.css).
export default function Confetti({ piezas = 70 }: { piezas?: number }) {
  const confeti = useMemo<PiezaCaida[]>(() => {
    return Array.from({ length: piezas }).map((_, i) => ({
      id: `c-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duracion: 2.2 + Math.random() * 1.6,
      rotacionFinal: 360 + Math.random() * 360,
      color: COLORES[i % COLORES.length],
      ancho: 6 + Math.random() * 6,
      alto: 8 + Math.random() * 8,
      redonda: Math.random() > 0.6,
    }));
  }, [piezas]);

  const estallido = useMemo<PiezaEstallido[]>(() => {
    return Array.from({ length: 26 }).map((_, i) => {
      const angulo = (Math.PI * 2 * i) / 26 + Math.random() * 0.3;
      const distancia = 90 + Math.random() * 140;
      return {
        id: `e-${i}`,
        dx: Math.cos(angulo) * distancia,
        dy: Math.sin(angulo) * distancia,
        delay: Math.random() * 0.15,
        color: COLORES[i % COLORES.length],
        tamano: 7 + Math.random() * 6,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {estallido.map((p) => (
        <span
          key={p.id}
          className="confetti-estallido"
          style={
            {
              width: p.tamano,
              height: p.tamano,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
      {confeti.map((p) => (
        <span
          key={p.id}
          className="confetti-caida"
          style={
            {
              left: `${p.left}%`,
              width: p.ancho,
              height: p.redonda ? p.ancho : p.alto,
              backgroundColor: p.color,
              borderRadius: p.redonda ? "50%" : "2px",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duracion}s`,
              "--rot-final": `${p.rotacionFinal}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

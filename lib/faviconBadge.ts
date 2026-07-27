// Dibuja una "burbuja" roja con un número sobre el ícono normal de la app
// y lo pone como favicon, igual que hacen Gmail o WhatsApp Web para avisar
// que hay algo pendiente sin que el admin tenga que tener la pestaña
// abierta y mirando. Si count es 0, se restaura el ícono original.

let imagenBaseCache: HTMLImageElement | null = null;
let ultimoCount = -1;

function obtenerLinkFavicon(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-dynamic-favicon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-dynamic-favicon", "true");
    document.head.appendChild(link);
  }
  return link;
}

function cargarImagenBase(): Promise<HTMLImageElement> {
  if (imagenBaseCache) return Promise.resolve(imagenBaseCache);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imagenBaseCache = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = "/icon.png";
  });
}

export async function actualizarBadgeFavicon(count: number) {
  if (typeof window === "undefined") return;
  if (count === ultimoCount) return;
  ultimoCount = count;

  try {
    const img = await cargarImagenBase();
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    if (count > 0) {
      const texto = count > 9 ? "9+" : String(count);
      const radio = 20;
      const cx = size - radio + 4;
      const cy = radio - 4;

      ctx.beginPath();
      ctx.arc(cx, cy, radio, 0, Math.PI * 2);
      ctx.fillStyle = "#B4392F"; // alert-600, mismo rojo que el resto de la app
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(texto, cx, cy + 1);
    }

    const link = obtenerLinkFavicon();
    link.href = canvas.toDataURL("image/png");
  } catch {
    // Si algo falla (ej. no se pudo cargar /icon.png), no pasa nada grave:
    // simplemente no se ve la burbuja en el ícono de la pestaña.
  }
}

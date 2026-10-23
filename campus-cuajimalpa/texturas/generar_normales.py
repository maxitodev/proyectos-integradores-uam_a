"""Genera mapas de normales (OpenGL, +Y arriba) a partir de las texturas de color del repo.
Sin descargas: la altura sale de la luminancia de cada textura (filtro paso alto periodico, asi que el mapa
resultante tambien se repite sin costuras y coincide pixel a pixel con la textura de color).

Uso:  python -I generar_normales.py <carpeta con pasto.jpg, asfalto.jpg, ...> <carpeta de salida>
Salida: <nombre>_n.jpg (512x512, JPEG q85, sin submuestreo de croma).
"""
import os
import sys

import numpy as np
from PIL import Image

# nombre: (pendiente RMS objetivo, radio del paso alto en px, suavizado en px)
TRABAJOS = {
    'pasto': (0.60, 10, 1.2),
    'asfalto': (0.55, 8, 1.2),
    'asfalto2': (0.55, 8, 1.2),
    'concreto': (0.35, 10, 1.2),
    'muro': (0.45, 10, 1.2),
    'ladrillo': (0.70, 14, 1.2),
}


def gauss(shape, sigma):
    fy = np.fft.fftfreq(shape[0])[:, None]
    fx = np.fft.fftfreq(shape[1])[None, :]
    return np.exp(-2 * (np.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))


def normal_de(ruta, rms, paso_alto, suave):
    im = Image.open(ruta).convert('RGB').resize((512, 512), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255.0
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    F = np.fft.fft2(lum)
    h = np.fft.ifft2(F * (1 - gauss(lum.shape, paso_alto)) * gauss(lum.shape, suave)).real  # paso alto + suavizado
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5   # d/dcolumna
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5   # d/dfila (hacia abajo)
    k = rms / max(1e-6, float(np.sqrt((dx ** 2 + dy ** 2).mean())))
    n = np.stack([-dx * k, dy * k, np.ones_like(h)], -1)  # R = -dh/du ; G = +dh/dfila (v hacia arriba)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8))


def main():
    origen, salida = sys.argv[1], sys.argv[2]
    os.makedirs(salida, exist_ok=True)
    for nombre, (rms, pa, su) in TRABAJOS.items():
        destino = os.path.join(salida, nombre + '_n.jpg')
        normal_de(os.path.join(origen, nombre + '.jpg'), rms, pa, su).save(destino, quality=85, subsampling=0)
        print(nombre + '_n.jpg', os.path.getsize(destino), 'bytes')


if __name__ == '__main__':
    main()

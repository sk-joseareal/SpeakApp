from pathlib import Path
from PIL import Image

# =========================
# CONFIG
# =========================
INPUT = "nena-v5-emociones.png"
OUT_DIR = "frames_exportados"

COLS = 4
ROWS = 4

OUT_W = 220
OUT_H = 220

PADDING_TOP = 8
PADDING_BOTTOM = 8
PADDING_X = 8

# línea base dentro del lienzo final
BASE_Y_RATIO = 0.78

# alpha mínimo para considerar un pixel visible
ALPHA_THRESHOLD = 10


def alpha_bbox(img: Image.Image, alpha_threshold: int = 10):
    """
    Devuelve bbox visible según alpha: (min_x, min_y, max_x, max_y)
    o None si no encuentra nada visible.
    """
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > alpha_threshold else 0).getbbox()
    if bbox is None:
        return None
    # PIL bbox = (left, upper, right, lower), right/lower exclusivos
    l, t, r, b = bbox
    return (l, t, r - 1, b - 1)


def main():
    src = Image.open(INPUT).convert("RGBA")
    sheet_w, sheet_h = src.size

    frame_w = sheet_w // COLS
    frame_h = sheet_h // ROWS

    frames = []
    meta = []

    # 1) cortar y analizar cada frame
    for i in range(COLS * ROWS):
        col = i % COLS
        row = i // COLS

        x0 = col * frame_w
        y0 = row * frame_h
        x1 = x0 + frame_w
        y1 = y0 + frame_h

        frame = src.crop((x0, y0, x1, y1)).convert("RGBA")
        bbox = alpha_bbox(frame, ALPHA_THRESHOLD)

        if bbox is None:
            # fallback improbable
            bbox = (0, 0, frame_w - 1, frame_h - 1)

        min_x, min_y, max_x, max_y = bbox

        frames.append(frame)
        meta.append({
            "index": i,
            "min_x": min_x,
            "min_y": min_y,
            "max_x": max_x,
            "max_y": max_y,
            "anchor_y": max_y,  # base visual
        })

    # 2) métricas globales para un escalado seguro común
    global_top = min(m["min_y"] for m in meta)
    global_bottom = max(m["max_y"] for m in meta)
    global_left = min(m["min_x"] for m in meta)
    global_right = max(m["max_x"] for m in meta)

    visible_top_to_anchor = global_bottom - global_top
    visible_bottom_to_anchor = (frame_h - 1) - global_bottom
    visible_width = global_right - global_left + 1

    base_y = OUT_H * BASE_Y_RATIO

    # evitar divisiones por cero
    max_scale_by_top = (base_y - PADDING_TOP) / max(1, visible_top_to_anchor)
    max_scale_by_bottom = (OUT_H - PADDING_BOTTOM - base_y) / max(1, visible_bottom_to_anchor)
    max_scale_by_width = (OUT_W - 2 * PADDING_X) / max(1, visible_width)

    scale = min(max_scale_by_top, max_scale_by_bottom, max_scale_by_width)

    out_dir = Path(OUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 3) exportar cada frame ya centrado/alineado
    for i, frame in enumerate(frames):
        canvas = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))

        scaled_w = round(frame_w * scale)
        scaled_h = round(frame_h * scale)

        resized = frame.resize((scaled_w, scaled_h), Image.LANCZOS)

        dx = round((OUT_W / 2) - (scaled_w / 2))
        dy = round(base_y - meta[i]["anchor_y"] * scale)

        canvas.alpha_composite(resized, (dx, dy))
        canvas.save(out_dir / f"frame_{i:02d}.png")

    print(f"Exportados {len(frames)} PNGs en: {out_dir.resolve()}")
    print(f"Escala usada: {scale:.4f}")


if __name__ == "__main__":
    main()

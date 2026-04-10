from pathlib import Path
from PIL import Image

# Configuración
INPUT_IMAGE = "imagen.png"   # cambia esto por tu archivo
ROWS = 4
COLS = 4
OUTPUT_DIR = "salida"


def trim_transparent(img: Image.Image) -> Image.Image | None:
    """
    Recorta el espacio transparente alrededor de la imagen.
    Devuelve None si la imagen está completamente vacía.
    """
    bbox = img.getbbox()
    if bbox is None:
        return None
    return img.crop(bbox)


def main() -> None:
    input_path = Path(INPUT_IMAGE)
    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"No existe el archivo: {input_path}")

    img = Image.open(input_path).convert("RGBA")
    width, height = img.size

    tile_width = width // COLS
    tile_height = height // ROWS

    print(f"Imagen cargada: {input_path}")
    print(f"Tamaño total: {width}x{height}")
    print(f"Cada celda: {tile_width}x{tile_height}")
    print()

    saved = 0
    skipped = 0

    for row in range(ROWS):
        for col in range(COLS):
            left = col * tile_width
            top = row * tile_height

            # la última fila/columna absorbe cualquier resto por si no divide exacto
            right = (col + 1) * tile_width if col < COLS - 1 else width
            bottom = (row + 1) * tile_height if row < ROWS - 1 else height

            tile = img.crop((left, top, right, bottom))
            trimmed = trim_transparent(tile)

            if trimmed is None:
                print(f"Saltando vacía: fila {row+1}, columna {col+1}")
                skipped += 1
                continue

            filename = output_path / f"fila_{row+1}_col_{col+1}.png"
            trimmed.save(filename)
            print(f"Guardada: {filename}")
            saved += 1

    print()
    print(f"Proceso terminado. Guardadas: {saved}, vacías: {skipped}")


if __name__ == "__main__":
    main()

import os
import cairosvg
from PIL import Image

def convert_icons():
    """
    Automates the conversion of the project's vector logo to raster formats.
    
    Generates:
    - icon.png: High-resolution raster (256x256) for UI usage and desktop entries.
    - icon.ico: Multi-size icon bundle for Windows executable integration.
    """
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_svg = os.path.join(root_dir, 'app', 'static', 'img', 'symbol.svg')
    
    if not os.path.exists(source_svg):
        print(f"FAILED: Source SVG not found at {source_svg}")
        return

    output_dir = os.path.join(root_dir, 'app', 'static')
    png_path = os.path.join(output_dir, 'icon.png')
    ico_path = os.path.join(output_dir, 'icon.ico')

    # 1. Vector to Raster (PNG)
    try:
        cairosvg.svg2png(url=source_svg, write_to=png_path, output_width=256, output_height=256)
        print(f"SUCCESS: Generated PNG -> {png_path}")
    except Exception as e:
        print(f"CRITICAL: SVG conversion failed: {e}")
        return

    # 2. Raster to Windows Icon Bundle (ICO)
    try:
        img = Image.open(png_path)
        # Bundle multiple resolutions for standard Windows scaling
        icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
        img.save(ico_path, format='ICO', sizes=icon_sizes)
        print(f"SUCCESS: Generated ICO -> {ico_path}")
    except Exception as e:
        print(f"ERROR: ICO generation failed: {e}")

if __name__ == "__main__":
    convert_icons()

import os
import cairosvg
from PIL import Image

def convert_icons():
    """Converts symbol.svg to icon.png and icon.ico"""
    # Root dir is one level up from this script
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_svg = os.path.join(root_dir, 'app', 'static', 'img', 'symbol.svg')
    
    # Validation
    if not os.path.exists(source_svg):
        print(f"Error: {source_svg} not found.")
        return

    output_dir = os.path.join(root_dir, 'app', 'static')
    png_path = os.path.join(output_dir, 'icon.png')
    ico_path = os.path.join(output_dir, 'icon.ico')

    print(f"Converting {source_svg}...")

    # 1. Convert SVG to high-res PNG (256x256)
    try:
        cairosvg.svg2png(url=source_svg, write_to=png_path, output_width=256, output_height=256)
        print(f"✔ Generated: {png_path}")
    except Exception as e:
        print(f"❌ Failed to generate PNG: {e}")
        return

    # 2. Convert PNG to ICO
    try:
        img = Image.open(png_path)
        img.save(ico_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
        print(f"✔ Generated: {ico_path}")
    except Exception as e:
        print(f"❌ Failed to generate ICO: {e}")

if __name__ == "__main__":
    convert_icons()

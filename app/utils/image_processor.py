import io
import logging
from PIL import Image
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger("image_processor")

def process_image(
    image_data: bytes, 
    target_width: int = 800, 
    target_format: str = "image/webp", 
    quality: int = 85
) -> Tuple[bytes, str]:
    """
    Processes an image: resizes, converts format, and compresses.
    
    Args:
        image_data: Raw image bytes.
        target_width: Maximum width for the image.
        target_format: Target MIME type (image/webp, image/jpeg, image/png).
        quality: Compression quality (1-100).
        
    Returns:
        Tuple of (processed_image_bytes, new_mime_type).
    """
    # Map MIME type to Pillow format string
    format_map = {
        "image/webp": "WEBP",
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/avif": "AVIF"
    }
    pil_format = format_map.get(target_format, "WEBP")
    
    try:
        img = Image.open(io.BytesIO(image_data))
        
        # 1. Resize if necessary
        if img.width > target_width:
            ratio = target_width / img.width
            new_height = int(img.height * ratio)
            # Use LANCZOS for high-quality downsampling
            img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
            
        # 2. Convert to RGB if saving as JPEG (cannot save RGBA as JPEG)
        if img.mode != "RGB" and pil_format == "JPEG":
            img = img.convert("RGB")
            
        # 3. Save to buffer
        out = io.BytesIO()
        save_kwargs = {"quality": quality, "optimize": True}
        
        if pil_format == "PNG":
            # PNG is lossless, so quality doesn't apply, only optimization level
            save_kwargs = {"optimize": True}
            
        img.save(out, format=pil_format, **save_kwargs)
        return out.getvalue(), target_format
        
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        # Return original data if processing fails
        return image_data, "image/jpeg" # Fallback mime

def get_default_image_settings(config: Dict[str, Any]) -> Tuple[int, str, int]:
    """Extracts image settings from app config with defaults."""
    img_settings = config.get('appSettings', {}).get('imageSettings', {})
    
    width = int(img_settings.get('width', 800))
    format = img_settings.get('format', 'image/webp')
    # Settings store quality as 0.0-1.0 float usually, or 1-100 int. 
    # Let's check how it's stored in main.js/settings_logic.js.
    # From settings_logic.js: quality is stored as float (0.85).
    quality_raw = img_settings.get('quality', 0.85)
    quality = int(quality_raw * 100) if isinstance(quality_raw, float) else int(quality_raw)
    
    return width, format, quality

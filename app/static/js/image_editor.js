/**
 * @fileoverview Image Editor logic for the wizard.
 * Handles drag-and-drop, canvas rendering, pan/zoom, and cropping.
 * @module image_editor
 */

import { showToast } from './toast.js';
import { state } from './state.js';

// =============================================================================
// STATE & CONFIG
// =============================================================================

const editorState = {
	canvas: null,
	ctx: null,
	image: null,
	file: null,
	callback: null, // Function to call with final blob

	// Transform State
	scale: 1,
	panning: false,
	startX: 0,
	startY: 0,
	imgX: 0,
	imgY: 0,
	minScale: 0.1,
	maxScale: 5,

	// Config
	aspectRatio: 2 / 3, // Default for covers
	targetWidth: 600,   // Default export width (will be synced from settings)
	targetFormat: 'image/jpeg',
	targetQuality: 0.9,
	maskColor: 'rgba(0, 0, 0, 0.7)',

	// Limits
	canvasWidth: 0,
	canvasHeight: 0,
	frameWidth: 0,
	frameHeight: 0,
	frameX: 0,
	frameY: 0
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the image editor with a file or URL.
 * @param {File|string} fileOrUrl - The image file or URL to edit.
 * @param {Function} onSave - Callback receiving the cropped Blob.
 */
export function initImageEditor(fileOrUrl, onSave) {
	if (!fileOrUrl) {
		showToast('No image source provided.', 'error');
		return;
	}

	if (fileOrUrl instanceof File && !fileOrUrl.type.startsWith('image/')) {
		showToast('Please select a valid image file.', 'error');
		return;
	}

	// Ensure clean slate, but keep config defaults if any
	editorState.image = null;
	editorState.scale = 1;
	editorState.imgX = 0;
	editorState.imgY = 0;

	editorState.file = fileOrUrl instanceof File ? fileOrUrl : null;
	editorState.callback = onSave;

	// Sync from global settings
	const settings = state.appSettings.imageSettings || { format: 'image/webp', quality: 0.85, width: 800 };
	editorState.targetWidth = settings.width || 800;
	editorState.targetFormat = settings.format || 'image/webp';
	editorState.targetQuality = settings.quality || 0.85;

	// Sync UI selectors if present
	const resSelect = document.getElementById('resolutionSelect');
	if (resSelect) resSelect.value = editorState.targetWidth.toString();

	const formatSelect = document.getElementById('editorFormatSelect');
	if (formatSelect) formatSelect.value = editorState.targetFormat;

	// Show Editor UI / Hide Preview UI
	toggleEditorUI(true);

	// Setup Canvas if not ready (or re-setup)
	setTimeout(() => {
		setupCanvas(); // execution deferred to ensure DOM visibility (animate-enter)
		loadImage(fileOrUrl);
	}, 50); // Small delay to allow 'hidden' class removal to paint so canvas can size correctly
}

/**
 * Toggles visibility between the upload preview and the editor.
 * @param {boolean} showEditor 
 */
function toggleEditorUI(showEditor) {
	const uploadStep = document.getElementById('step-4'); // Cover is now step-4
	const uploadArea = document.getElementById('imageUploadArea'); // To be added to HTML
	const editorArea = document.getElementById('imageEditorArea'); // To be added to HTML

	if (uploadArea && editorArea) {
		if (showEditor) {
			uploadArea.classList.add('hidden');
			editorArea.classList.remove('hidden');
		} else {
			uploadArea.classList.remove('hidden');
			editorArea.classList.add('hidden');
		}
	}
}

/**
 * Sets up the canvas and event listeners.
 */
function setupCanvas() {
	editorState.canvas = document.getElementById('editorCanvas');
	if (!editorState.canvas) return;

	editorState.ctx = editorState.canvas.getContext('2d');

	// Sizing
	resizeCanvas();
	window.addEventListener('resize', resizeCanvas);

	// Mouse Events
	editorState.canvas.addEventListener('mousedown', onPointerDown);
	editorState.canvas.addEventListener('mousemove', onPointerMove);
	editorState.canvas.addEventListener('mouseup', onPointerUp);
	editorState.canvas.addEventListener('mouseleave', onPointerUp);

	// Touch Events
	editorState.canvas.addEventListener('touchstart', onPointerDown, { passive: false });
	editorState.canvas.addEventListener('touchmove', onPointerMove, { passive: false });
	editorState.canvas.addEventListener('touchend', onPointerUp);

	// Zoom (Wheel)
	editorState.canvas.addEventListener('wheel', onWheel, { passive: false });

	// Reset State
	editorState.imgX = 0;
	editorState.imgY = 0;
	editorState.scale = 1;
}

/**
 * Resizes canvas to fit container and recalculates frame.
 */
function resizeCanvas() {
	const container = editorState.canvas.parentElement;
	if (!container) return;

	editorState.canvas.width = container.clientWidth;
	editorState.canvas.height = container.clientHeight; // Or fixed aspect?

	// Keep it responsive usually fixed height in modal is good
	if (editorState.canvas.height < 400) editorState.canvas.height = 400;

	editorState.canvasWidth = editorState.canvas.width;
	editorState.canvasHeight = editorState.canvas.height;

	calculateFrame();
	checkResolution();
	drawEditor();
}

/**
 * Calculates the crop frame dimensions based on aspect ratio and canvas size.
 */
function calculateFrame() {
	const padding = 20;
	const availW = editorState.canvasWidth - (padding * 2);
	const availH = editorState.canvasHeight - (padding * 2);

	let fw = availW;
	let fh = fw / editorState.aspectRatio;

	if (fh > availH) {
		fh = availH;
		fw = fh * editorState.aspectRatio;
	}

	editorState.frameWidth = fw;
	editorState.frameHeight = fh;
	editorState.frameX = (editorState.canvasWidth - fw) / 2;
	editorState.frameY = (editorState.canvasHeight - fh) / 2;
}

/**
 * Loads the image source into an Image object.
 * @param {File|string} source - File object or URL string
 */
function loadImage(source) {
	if (source instanceof File) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				editorState.image = img;
				resetTransform();
				checkResolution();
				drawEditor();
			};
			img.src = e.target.result;
		};
		reader.readAsDataURL(source);
	} else if (typeof source === 'string') {
		const img = new Image();
		img.crossOrigin = 'anonymous'; // Support cross-origin images for cropping
		img.onload = () => {
			editorState.image = img;
			resetTransform();
			checkResolution();
			drawEditor();
		};
		img.onerror = () => {
			showToast('Failed to load image from external URL. It may be restricted by security policies.', 'error');
			closeEditor();
		};
		// Use backend proxy to bypass CORS/Same-Origin restrictions
		img.src = `/api/proxy/image?url=${encodeURIComponent(source)}`;
	}
}

/**
 * Resets transform to fit image within frame.
 */
function resetTransform() {
	if (!editorState.image) return;

	// "Cover" fit by default (fill the frame)
	const imgRatio = editorState.image.width / editorState.image.height;
	const frameRatio = editorState.frameWidth / editorState.frameHeight;

	if (imgRatio > frameRatio) {
		// Image is wider than frame -> Match height
		editorState.scale = editorState.frameHeight / editorState.image.height;
	} else {
		// Image is taller/equal -> Match width
		editorState.scale = editorState.frameWidth / editorState.image.width;
	}

	// Center image
	editorState.imgX = editorState.canvasWidth / 2 - (editorState.image.width * editorState.scale) / 2;
	editorState.imgY = editorState.canvasHeight / 2 - (editorState.image.height * editorState.scale) / 2;

	updateZoomSlider();
	checkResolution();
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Main draw loop.
 */
function drawEditor() {
	const { ctx, canvas, image, imgX, imgY, scale, frameX, frameY, frameWidth, frameHeight, maskColor } = editorState;

	if (!ctx) return;

	// Clear
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw Background (Dark)
	ctx.fillStyle = '#18181b'; // zinc-900
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	if (image) {
		// Draw Image
		ctx.save();
		ctx.translate(imgX, imgY);
		ctx.scale(scale, scale);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
	}

	// Draw Overlay (Mask)
	// We use "destination-out" or complex paths, simpler is drawing 4 rectangles

	ctx.fillStyle = maskColor;

	// Top
	ctx.fillRect(0, 0, canvas.width, frameY);
	// Bottom
	ctx.fillRect(0, frameY + frameHeight, canvas.width, canvas.height - (frameY + frameHeight));
	// Left
	ctx.fillRect(0, frameY, frameX, frameHeight);
	// Right
	ctx.fillRect(frameX + frameWidth, frameY, canvas.width - (frameX + frameWidth), frameHeight);

	// Draw Frame Border
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

	// Grid lines (Rule of Thirds)
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;

	// Verticals
	ctx.beginPath();
	ctx.moveTo(frameX + frameWidth / 3, frameY);
	ctx.lineTo(frameX + frameWidth / 3, frameY + frameHeight);
	ctx.moveTo(frameX + (frameWidth / 3) * 2, frameY);
	ctx.lineTo(frameX + (frameWidth / 3) * 2, frameY + frameHeight);

	// Horizontals
	ctx.moveTo(frameX, frameY + frameHeight / 3);
	ctx.lineTo(frameX + frameWidth, frameY + frameHeight / 3);
	ctx.moveTo(frameX, frameY + (frameHeight / 3) * 2);
	ctx.lineTo(frameX + frameWidth, frameY + (frameHeight / 3) * 2);
	ctx.stroke();
}

// =============================================================================
// INTERACTION
// =============================================================================

function onPointerDown(e) {
	if (!editorState.image) return;
	e.preventDefault();
	editorState.panning = true;

	const pt = getPoint(e);
	editorState.startX = pt.x - editorState.imgX;
	editorState.startY = pt.y - editorState.imgY;
}

function onPointerMove(e) {
	if (!editorState.panning) return;
	e.preventDefault();

	const pt = getPoint(e);
	editorState.imgX = pt.x - editorState.startX;
	editorState.imgY = pt.y - editorState.startY;

	drawEditor();
}

function onPointerUp(e) {
	editorState.panning = false;
}

function onWheel(e) {
	e.preventDefault();
	const delta = e.deltaY > 0 ? 0.9 : 1.1;
	applyZoom(delta, getPoint(e));
}

function getPoint(e) {
	const rect = editorState.canvas.getBoundingClientRect();
	if (e.touches && e.touches.length > 0) {
		return {
			x: e.touches[0].clientX - rect.left,
			y: e.touches[0].clientY - rect.top
		};
	}
	return {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top
	};
}

/**
 * Applies zoom centered on a point.
 */
function applyZoom(factor, center) {
	const newScale = editorState.scale * factor;
	if (newScale < editorState.minScale || newScale > editorState.maxScale) return;

	// Zoom towards cursor (center)
	// Formula: newPos = cursor - (cursor - oldPos) * factor
	editorState.imgX = center.x - (center.x - editorState.imgX) * factor;
	editorState.imgY = center.y - (center.y - editorState.imgY) * factor;
	editorState.scale = newScale;

	updateZoomSlider();
	checkResolution();
	drawEditor();
}

// =============================================================================
// CONTROLS INTERFACE
// =============================================================================

/**
 * Sets the zoom level based on the slider value.
 * @param {number} value - Slider value (0-100)
 */
export function setZoomFromSlider(value) {
	const pct = value / 100;
	const newScale = editorState.minScale + pct * (editorState.maxScale - editorState.minScale);
	const center = { x: editorState.canvasWidth / 2, y: editorState.canvasHeight / 2 };
	const factor = newScale / editorState.scale;
	applyZoom(factor, center);
	checkResolution();
}

/** Updates the zoom slider UI to match current scale. */
function updateZoomSlider() {
	const slider = document.getElementById('zoomSlider');
	if (slider) {
		const range = editorState.maxScale - editorState.minScale;
		const pct = (editorState.scale - editorState.minScale) / range;
		slider.value = Math.max(0, Math.min(100, pct * 100));
	}
}

/**
 * Sets the target output width and re-checks resolution.
 * @param {number} width - Output width in pixels
 */
export function setTargetWidth(width) {
	editorState.targetWidth = width;
	checkResolution();
}

/**
 * Updates the output format (MIME type).
 * @param {string} mime 
 */
export function setFormat(mime) {
	editorState.targetFormat = mime;
}

/**
 * Checks if the source image resolution is sufficient for the current crop.
 * Displays a warning if upscaling will occur.
 */
function checkResolution() {
	if (!editorState.image) return;

	// Calculate how many source pixels are currently in the crop frame
	const sourcePixelsWidth = editorState.frameWidth / editorState.scale;
	const isUpscaling = sourcePixelsWidth < editorState.targetWidth;

	const warningEl = document.getElementById('resolutionWarning');
	if (warningEl) {
		warningEl.classList.toggle('hidden', !isUpscaling);

		// Update warning text with better wording
		const warnText = warningEl.querySelector('.warning-text');
		if (warnText) {
			const currentRes = Math.round(sourcePixelsWidth);
			warnText.innerText = `Loss of quality: Source provides only ${currentRes}px for a ${editorState.targetWidth}px output.`;
		}
	}
}

// =============================================================================
// EXPORT
// =============================================================================

/**
 * Generates the cropped blob via callback (Legacy).
 */
export async function saveCrop() {
	if (!editorState.image) return;

	// Calculate actual source pixels within the crop frame
	const sourcePixelsWide = Math.round(editorState.frameWidth / editorState.scale);

	// Smart Resolution: Cap output width to actual source detail to avoid upscaling
	const w = Math.min(editorState.targetWidth, sourcePixelsWide);
	const h = w / editorState.aspectRatio;

	const output = document.createElement('canvas');
	output.width = w;
	output.height = h;

	const ctx = output.getContext('2d');
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, w, h);

	const sx = (editorState.frameX - editorState.imgX) / editorState.scale;
	const sy = (editorState.frameY - editorState.imgY) / editorState.scale;
	const sw = editorState.frameWidth / editorState.scale;
	const sh = editorState.frameHeight / editorState.scale;

	ctx.drawImage(editorState.image, sx, sy, sw, sh, 0, 0, w, h);

	output.toBlob((blob) => {
		if (editorState.callback) {
			editorState.callback(blob);
		}
		closeEditor();
	}, editorState.targetFormat, editorState.targetQuality);
}

/**
 * Promise-based wrapper for saving the crop.
 * Resolves with the blob after processing.
 * @returns {Promise<Blob|void>}
 */
export function saveCropPromise() {
	return new Promise((resolve, reject) => {
		if (!editorState.image) {
			resolve();
			return;
		}

		const output = document.createElement('canvas');

		// Smart Resolution: Cap output width to actual source detail
		const sourcePixelsWide = Math.round(editorState.frameWidth / editorState.scale);
		const w = Math.min(editorState.targetWidth, sourcePixelsWide);
		const h = w / editorState.aspectRatio;

		output.width = w;
		output.height = h;

		const ctx = output.getContext('2d');

		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, w, h);

		const sx = (editorState.frameX - editorState.imgX) / editorState.scale;
		const sy = (editorState.frameY - editorState.imgY) / editorState.scale;
		const sw = editorState.frameWidth / editorState.scale;
		const sh = editorState.frameHeight / editorState.scale;

		ctx.drawImage(editorState.image, sx, sy, sw, sh, 0, 0, w, h);

		output.toBlob((blob) => {
			if (editorState.callback) {
				editorState.callback(blob);
			}
			closeEditor();
			resolve(blob);
		}, editorState.targetFormat, editorState.targetQuality);
	});
}

/** Closes the editor UI. */
export function closeEditor() {
	toggleEditorUI(false);
}

/** Resets the editor state completely. */
export function resetEditorState() {
	editorState.canvas = null; // Force re-setup
	editorState.ctx = null;
	editorState.image = null;
	editorState.file = null;
	editorState.callback = null;
	editorState.scale = 1;
	editorState.imgX = 0;
	editorState.imgY = 0;

	const slider = document.getElementById('zoomSlider');
	if (slider) slider.value = 0;

	toggleEditorUI(false);
}

// Expose to window for UI binding
window.imageEditor = {
	setZoomFromSlider,
	setFormat,
	setTargetWidth,
	saveCrop,
	saveCropPromise,
	resetTransform,
	closeEditor,
	resetEditorState
};

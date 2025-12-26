/**
 * @fileoverview Unified Toast Notification System for UpNext.
 * Features:
 * - Queue system (max 3 visible)
 * - Rich content support (cover images)
 * - Circular progress timer
 * - Dismiss All stack logic
 * @module toast
 */

import { safeCreateIcons } from './dom_utils.js';

const ToastConfig = {
    containerId: 'toast-container',
    maxVisible: 3,
    defaultDuration: 5000,
    animationDuration: 300,
};

// Global Queue State
let queue = [];
let activeToasts = []; // Array of { id, element, ... }

/**
 * Initializes the toast container.
 */
function getContainer() {
    let container = document.getElementById(ToastConfig.containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = ToastConfig.containerId;
        // Fixed bottom-right. Flex-col-reverse so "Dismiss All" can be at the bottom (visually)
        container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col-reverse items-end gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Adds a toast to the queue and processes it.
 * @param {Object} options - Toast options
 */
export function enqueueToast(options) {
    queue.push({
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...options,
        duration: options.duration ?? ToastConfig.defaultDuration
    });
    processQueue();
}

/**
 * Processes the queue and renders toasts if slot available.
 */
function processQueue() {
    // Clean up activeToasts that might have been removed from DOM manually
    activeToasts = activeToasts.filter(t => document.getElementById(t.id));

    // If we have space and items in queue
    if (activeToasts.length < ToastConfig.maxVisible && queue.length > 0) {
        const nextToast = queue.shift();
        renderToast(nextToast);
    }

    updateDismissAllButton();
}

/**
 * Renders a single toast element.
 * @param {Object} toastData 
 */
function renderToast(toastData) {
    const container = getContainer();
    const el = document.createElement('div');
    el.id = toastData.id;

    // Base classes
    const baseClasses = 'pointer-events-auto relative overflow-hidden rounded-2xl shadow-xl backdrop-blur-xl border transform transition-all duration-300 translate-x-full opacity-0 flex flex-col w-[340px] group';

    // Theme/Type logic
    const isRich = !!toastData.coverUrl;
    const type = toastData.type || 'info';

    const typeStyles = {
        success: 'bg-emerald-50/95 dark:bg-zinc-900/95 border-emerald-500/30',
        error: 'bg-red-50/95 dark:bg-zinc-900/95 border-red-500/30',
        info: 'bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800'
    };

    el.className = `${baseClasses} ${typeStyles[type] || typeStyles.info}`;

    // SVG Timer Logic
    // Circle circumference = 2 * pi * r. r=9 -> C ~ 56.5
    const radius = 9;
    const circumference = 2 * Math.PI * radius;

    const timerHtml = toastData.duration > 0 ? `
        <div class="absolute top-3 right-3 z-20 cursor-pointer hover:scale-110 transition-transform" 
             onclick="dismissToastById('${toastData.id}')"
             title="Dismiss">
            <svg class="w-6 h-6 -rotate-90 transform" viewBox="0 0 24 24">
                <!-- Background Circle -->
                <circle cx="12" cy="12" r="${radius}" 
                    class="fill-transparent stroke-zinc-200 dark:stroke-zinc-800"
                    stroke-width="2"></circle>
                <!-- Progress Circle -->
                <circle cx="12" cy="12" r="${radius}" 
                    class="fill-transparent stroke-emerald-500 transition-[stroke-dashoffset] ease-linear"
                    stroke-width="2"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="0"
                    style="transition-duration: ${toastData.duration}ms;"
                    id="timer-${toastData.id}"></circle>
                <!-- X Icon overlay (visible on hover) -->
                <path d="M9 9l6 6M15 9l-6 6" class="stroke-zinc-400 dark:stroke-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" stroke-width="2" stroke-linecap="round"></path>
            </svg>
        </div>
    ` : `
        <button onclick="dismissToastById('${toastData.id}')" class="absolute top-3 right-3 z-20 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    `;

    // Content Layout
    let contentHtml = '';

    if (isRich) {
        // Rich Layout: Flex Row [Image] [Content]
        contentHtml = `
            <div class="flex p-3 gap-3 relative z-10">
                <div class="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">
                    <img src="/images/${toastData.coverUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                </div>
                <div class="flex-1 min-w-0 py-0.5 pr-6">
                    <h4 class="text-sm font-bold text-zinc-900 dark:text-white truncate leading-tight mb-1">${toastData.title || 'Notification'}</h4>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">${toastData.message}</p>
                </div>
            </div>
        `;
    } else {
        // Simple Layout
        const iconMap = {
            success: 'check-circle',
            error: 'alert-circle',
            info: 'info'
        };
        const iconColor = {
            success: 'text-emerald-500',
            error: 'text-red-500',
            info: 'text-zinc-500'
        };

        contentHtml = `
            <div class="flex items-center p-4 gap-3 pr-10 relative z-10">
                <div class="shrink-0 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 ${iconColor[type]}">
                    <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-bold text-zinc-900 dark:text-white leading-tight">${toastData.message}</p>
                </div>
            </div>
        `;
    }

    // Action Button (Bottom)
    let actionHtml = '';
    if (toastData.actionLabel && toastData.onAction) {
        actionHtml = `
            <div class="border-t border-zinc-100 dark:border-zinc-800/50 p-1 bg-zinc-50/50 dark:bg-zinc-900/50">
                <button id="action-${toastData.id}" class="w-full py-2 text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors flex items-center justify-center gap-2">
                    ${toastData.actionLabel}
                    <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
            </div>
        `;
    }

    el.innerHTML = `${timerHtml}${contentHtml}${actionHtml}`;

    container.appendChild(el);

    // Bind Action
    if (toastData.actionLabel && toastData.onAction) {
        const btn = document.getElementById(`action-${toastData.id}`);
        if (btn) {
            btn.onclick = () => {
                toastData.onAction();
                dismissToastById(toastData.id);
            };
        }
    }

    safeCreateIcons();

    // Track
    const toastObj = { id: toastData.id, el, duration: toastData.duration };
    activeToasts.push(toastObj);

    // Animate In
    requestAnimationFrame(() => {
        el.classList.remove('translate-x-full', 'opacity-0');

        // Start Timer Animation
        if (toastData.duration > 0) {
            const circle = document.getElementById(`timer-${toastData.id}`);
            let startTime = Date.now();
            let remaining = toastData.duration;
            let timerId = null;

            const startTimer = (duration) => {
                if (dur <= 0) return;

                // SVG Animation
                if (circle) {
                    circle.style.transitionDuration = `${duration}ms`;
                    circle.style.strokeDashoffset = circumference;
                }

                timerId = setTimeout(() => {
                    dismissToastById(toastData.id);
                }, duration);

                startTime = Date.now();
            };

            // Initial Start
            if (circle) {
                circle.getBoundingClientRect(); // Force reflow
                circle.style.strokeDashoffset = circumference;
            }
            timerId = setTimeout(() => {
                dismissToastById(toastData.id);
            }, remaining);

            // Pause on Hover
            el.addEventListener('mouseenter', () => {
                const elapsed = Date.now() - startTime;
                remaining -= elapsed;
                clearTimeout(timerId);

                if (circle) {
                    const computedStyle = window.getComputedStyle(circle);
                    const currentOffset = computedStyle.strokeDashoffset;
                    circle.style.transition = 'none';
                    circle.style.strokeDashoffset = currentOffset;
                }
            });

            el.addEventListener('mouseleave', () => {
                if (remaining <= 0) {
                    dismissToastById(toastData.id);
                    return;
                }

                startTime = Date.now();
                timerId = setTimeout(() => {
                    dismissToastById(toastData.id);
                }, remaining);

                if (circle) {
                    circle.style.transition = `stroke-dashoffset ${remaining}ms linear`;
                    // Force reflow
                    circle.getBoundingClientRect();
                    circle.style.strokeDashoffset = circumference;
                }
            });
        }
    });
}

/**
 * Updates the 'Dismiss All' button visibility.
 */
function updateDismissAllButton() {
    const container = getContainer();
    let btn = document.getElementById('toast-dismiss-all');

    // Count is active items
    const count = activeToasts.length;

    if (count > 1) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'toast-dismiss-all';
            btn.className = 'pointer-events-auto mb-2 px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white bg-white/80 dark:bg-zinc-800/80 backdrop-blur rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700 transition-all opacity-0 translate-y-4 hover:scale-105 active:scale-95';
            btn.innerHTML = 'Dismiss All';
            btn.onclick = dismissAllToasts;

            // Insert as first child (Visually Bottom in flex-col-reverse)
            container.insertBefore(btn, container.firstChild);

            requestAnimationFrame(() => {
                btn.classList.remove('opacity-0', 'translate-y-4');
            });
        }
    } else {
        if (btn) {
            btn.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => { if (btn.parentElement) btn.remove(); }, 300);
        }
    }
}

/**
 * Dismisses a notification by ID.
 * @param {string} id 
 */
function dismissToastById(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.add('translate-x-full', 'opacity-0');

    // Remove from active array immediately to allow next in queue
    activeToasts = activeToasts.filter(t => t.id !== id);
    processQueue();

    setTimeout(() => {
        if (el.parentElement) el.remove();
        updateDismissAllButton();
    }, 300);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Shows a standard or rich toast.
 * @param {string} message - Message text
 * @param {'success'|'error'|'info'} type - Toast type
 * @param {number} duration - Duration in ms
 * @param {Object} richOptions - Optional rich data { title, coverUrl, actionLabel, onAction }
 */
export function showToast(message, type = 'info', duration = ToastConfig.defaultDuration, richOptions = {}) {
    enqueueToast({
        message,
        type,
        duration,
        ...richOptions
    });
}

/**
 * Backward compatibility wrapper for action toasts.
 */
export function showActionToast(message, actionLabel, onAction) {
    enqueueToast({
        message,
        type: 'info',
        actionLabel,
        onAction,
        duration: 8000 // give more time for actions
    });
}

/**
 * Shows a purely rich toast (alias).
 */
export function showRichToast(data) {
    enqueueToast(data);
}

export function dismissAllToasts() {
    // Clear queue
    queue = [];
    // Dismiss all active
    [...activeToasts].forEach(t => dismissToastById(t.id));
}

// Expose to Window
window.showToast = showToast;
window.showActionToast = showActionToast;
window.showRichToast = showRichToast;
window.dismissAllToasts = dismissAllToasts;
window.dismissToastById = dismissToastById;

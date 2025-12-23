/**
 * @fileoverview Simple Toast Notification System for UpNext.
 * Handles displaying success, error, and info messages.
 * @module toast
 */

import { safeCreateIcons } from './dom_utils.js';

export const ToastParams = {
    containerId: 'toast-container',
    defaultDuration: 3000,
};

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'} type - The type of toast.
 * @param {number} duration - Duration in ms before auto-dismissing.
 */
export function showToast(message, type = 'info', duration = ToastParams.defaultDuration) {
    let container = document.getElementById(ToastParams.containerId);
    if (!container) {
        // Create container if it doesn't exist (failsafe)
        container = document.createElement('div');
        container.id = ToastParams.containerId;
        container.className = 'fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    toast.id = id;

    // Styles based on type
    const baseClasses = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border transform transition-all duration-300 translate-y-10 opacity-0 max-w-sm';

    const typeClasses = {
        success: 'bg-emerald-500/90 dark:bg-emerald-600/90 text-white border-emerald-400/50',
        error: 'bg-red-500/90 dark:bg-red-600/90 text-white border-red-400/50',
        info: 'bg-zinc-800/90 dark:bg-zinc-700/90 text-white border-zinc-600/50'
    };

    const iconMap = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info'
    };

    toast.className = `${baseClasses} ${typeClasses[type] || typeClasses.info}`;

    toast.innerHTML = `
        <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5 shrink-0"></i>
        <span class="text-sm font-bold tracking-wide">${message}</span>
    `;

    container.appendChild(toast);
    safeCreateIcons();

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    });

    // Auto Dismiss
    setTimeout(() => {
        dismissToast(toast);
    }, duration);

    // Click to dismiss
    toast.onclick = () => dismissToast(toast);
}

function dismissToast(element) {
    if (!element) return;
    element.classList.add('opacity-0', 'translate-y-4', 'scale-95');
    setTimeout(() => {
        if (element.parentElement) element.parentElement.removeChild(element);
    }, 300);
}

// Expose globally for ease of use in inline handlers if needed
window.showToast = showToast;

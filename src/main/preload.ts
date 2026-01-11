/**
 * Preload script for Electron security bridge
 * Exposes safe APIs to renderer process
 */
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Keyboard event listener (for coin acceptor)
  onKeyboardEvent: (_callback: (event: { key: string }) => void) => {
    // Window will listen for keyboard events in renderer
    // This is a placeholder for hardware integration
  },

  // Printer status
  getPrinterStatus: () => ipcRenderer.invoke('get-printer-status'),

  // Print ticket
  printTicket: (data: { qrCode: string; prizeValue: string; expiration: string }) =>
    ipcRenderer.invoke('print-ticket', data),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});

export type ElectronAPI = typeof electronAPI;

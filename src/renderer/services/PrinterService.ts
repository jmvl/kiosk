/// <reference types="vite/client" />
import type { Prize } from '@shared/types';
import { storageService } from './StorageService';

/**
 * Printer Service
 * Handles thermal printer communication via ESC/POS
 * In development mode, logs to console instead of printing
 */
export class PrinterService {
  private connected = false;
  private isDevelopment = true; // Set to false in production
  private kioskId: string;

  constructor() {
    // Get kiosk ID from environment variable
    this.kioskId = import.meta.env.VITE_KIOSK_ID || 'unknown';
  }

  /**
   * Initialize printer connection
   */
  async connect(): Promise<boolean> {
    if (this.isDevelopment) {
      console.log('[PrinterService] Development mode - printer simulated');
      this.connected = true;
      return true;
    }

    // TODO: Implement printer connection in Story 1.8
    // Using node-escpos library for production
    this.connected = true;
    return true;
  }

  /**
   * Generate a QR code URL for the prize
   */
  generateQRCodeData(prize: Prize): string {
    // Generate redemption URL with prize info
    const baseUrl = 'https://kiosk.example.com/redeem';
    const params = new URLSearchParams({
      id: prize.id,
      value: prize.value.toString(),
      expires: prize.expiresAt.toString(),
      kiosk: this.kioskId, // Include kiosk ID for tracking
    });
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Get current kiosk ID
   */
  getKioskId(): string {
    return this.kioskId;
  }

  /**
   * Print winning ticket with QR code
   */
  async printTicket(prize: Prize): Promise<boolean> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const qrData = this.generateQRCodeData(prize);

      if (this.isDevelopment) {
        // Development mode: log ticket details to console
        console.log('='.repeat(40));
        console.log('[PrinterService] TICKET PRINT SIMULATION');
        console.log('='.repeat(40));
        console.log('Kiosk ID:', this.kioskId);
        console.log('Prize ID:', prize.id);
        console.log('Prize Value:', `€${prize.value}`);
        console.log('Prize Name (FR):', prize.name.fr);
        console.log('Prize Name (NL):', prize.name.nl);
        console.log('Expires:', new Date(prize.expiresAt).toLocaleString());
        console.log('QR Code Data:', qrData);
        console.log('='.repeat(40));

        // Decrement inventory on successful print
        const newInventory = await storageService.decrementInventory();
        console.log('[PrinterService] Inventory remaining:', newInventory);

        return true;
      }

      // Production: Send ESC/POS commands to printer
      // TODO: Implement ESC/POS printing
      // 1. Initialize printer
      // 2. Print header with store logo
      // 3. Print "WINNER!" banner
      // 4. Print QR code
      // 5. Print prize value
      // 6. Print expiration
      // 7. Print kiosk ID
      // 8. Cut paper

      return true;
    } catch (error) {
      console.error('[PrinterService] Print failed:', error);
      return false;
    }
  }

  /**
   * Generate a new prize for a winner
   */
  generatePrize(prizeValue: number): Prize {
    const now = Date.now();
    const expiresIn = 24 * 60 * 60 * 1000; // 24 hours expiration

    return {
      id: crypto.randomUUID(),
      name: {
        fr: `Bon de réduction ${prizeValue}€`,
        nl: `Waardebon ${prizeValue}€`,
      },
      value: prizeValue,
      expiresAt: now + expiresIn,
      qrCode: '', // Will be generated during print
    };
  }

  /**
   * Check printer status
   */
  getStatus(): { connected: boolean; paperLow: boolean; error: string | null } {
    return {
      connected: this.connected,
      paperLow: false,
      error: null,
    };
  }

  /**
   * Test printer by printing a test page
   */
  async printTestPage(): Promise<boolean> {
    const testPrize = this.generatePrize(1);
    return this.printTicket(testPrize);
  }
}

// Singleton instance
export const printerService = new PrinterService();

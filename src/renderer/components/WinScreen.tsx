// Win Screen - celebration display after winning the slot machine
import { useEffect, useState } from 'react';
import { printerService } from '../services/PrinterService';

export interface WinScreenProps {
  onComplete: () => void;
  prizeValue?: number; // Prize value in euros (default: 1)
}

// Confetti particle configuration
const CONFETTI_COUNT = 50;
const CONFETTI_COLORS = [
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#ffa500',
  '#ff69b4',
];

interface ConfettiPiece {
  id: number;
  color: string;
  left: number;
  delay: number;
  rotation: number;
}

export function WinScreen({ onComplete, prizeValue = 1 }: WinScreenProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [showTicketMessage, setShowTicketMessage] = useState(false);
  const [printStatus, setPrintStatus] = useState<'pending' | 'printing' | 'success' | 'error'>(
    'pending'
  );

  useEffect(() => {
    // Generate confetti pieces
    const pieces: ConfettiPiece[] = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      left: Math.random() * 100,
      delay: Math.random() * 2,
      rotation: Math.random() * 360,
    }));
    setConfetti(pieces);

    // Show ticket message and start printing after initial celebration
    const ticketTimer = setTimeout(async () => {
      setShowTicketMessage(true);
      setPrintStatus('printing');

      try {
        // Generate prize and print ticket
        const prize = printerService.generatePrize(prizeValue);
        const success = await printerService.printTicket(prize);
        setPrintStatus(success ? 'success' : 'error');
      } catch (error) {
        console.error('Print error:', error);
        setPrintStatus('error');
      }
    }, 1500);

    // Auto-complete after 6 seconds (give more time for print)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 6000);

    return () => {
      clearTimeout(ticketTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, prizeValue]);

  const getPrintStatusMessage = () => {
    switch (printStatus) {
      case 'pending':
        return 'Preparing your prize...';
      case 'printing':
        return '🎫 Printing your prize ticket...';
      case 'success':
        return '✅ Ticket printed! Take your prize!';
      case 'error':
        return '⚠️ Print error - please see staff';
    }
  };

  return (
    <div className="win-screen">
      {/* Confetti animation */}
      <div className="confetti-container">
        {confetti.map((piece) => (
          <div
            key={piece.id}
            className="confetti-piece"
            style={{
              backgroundColor: piece.color,
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Flashing lights overlay */}
      <div className="lights-overlay" />

      {/* YOU WIN overlay */}
      <div className="win-overlay">
        <h1 className="win-title">🎉 YOU WIN! 🎉</h1>
        <div className="jackpot-animation">
          <span className="jackpot-text">JACKPOT!</span>
        </div>
        <p className="prize-value">Prize: €{prizeValue}</p>
      </div>

      {/* Ticket printing message */}
      {showTicketMessage && (
        <div className="ticket-message">
          <p className={`printing-text status-${printStatus}`}>{getPrintStatusMessage()}</p>
          <div className="printer-animation">
            <div className="printer-icon">🖨️</div>
          </div>
        </div>
      )}
    </div>
  );
}

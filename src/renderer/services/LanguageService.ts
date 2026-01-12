/**
 * Language Service
 * Handles language detection and translation
 * Supports French (fr) and Dutch (nl)
 */

export type Language = 'fr' | 'nl';

// UI String translations
const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Idle Screen
    'idle.insertCoin': 'Insérez une pièce pour jouer!',
    'idle.winChance': 'Gagnez des prix instantanément!',
    'idle.specialOffers': 'Offres Spéciales!',
    'idle.playToWin': 'Jouez pour gagner des prix incroyables!',
    'idle.ad': 'Pub',
    'idle.of': 'de',

    // Quiz Screen
    'quiz.title': 'Répondez pour jouer!',
    'quiz.question': 'Question',
    'quiz.timeLeft': 'Temps restant',
    'quiz.seconds': 'secondes',
    'quiz.correct': 'Correct!',
    'quiz.incorrect': 'Incorrect!',
    'quiz.timeout': 'Temps écoulé!',
    'quiz.loading': 'Chargement...',

    // Slot Machine Screen
    'slot.title': 'Tournez pour gagner!',
    'slot.push': 'APPUYER',
    'slot.spinning': 'Tourne...',
    'slot.done': 'Terminé!',
    'slot.pressButton': 'Appuyez sur le bouton pour tourner!',
    'slot.jackpot': 'JACKPOT!',
    'slot.betterLuck': 'Meilleure chance la prochaine fois!',

    // Win Screen
    'win.congratulations': 'Félicitations!',
    'win.youWon': 'VOUS AVEZ GAGNÉ!',
    'win.jackpot': 'JACKPOT!',
    'win.prize': 'Prix',
    'win.preparing': 'Préparation de votre prix...',
    'win.printingTicket': 'Impression de votre ticket prix...',
    'win.ticketPrinted': 'Ticket imprimé! Prenez votre prix!',
    'win.printError': 'Erreur d\'impression - veuillez voir le personnel',
    'win.takeTicket': 'Prenez votre ticket!',
    'win.redeemAt': 'Échangez au comptoir',
    'win.expiresIn': 'Expire dans 24 heures',

    // Loss Screen
    'loss.betterLuck': 'Meilleure chance la prochaine fois!',
    'loss.tryAgain': 'Insérez une autre pièce pour rejouer',

    // Coin values
    'coin.euro1': '1€',
    'coin.euro2': '2€',
    'coin.euro5': '5€',
  },
  nl: {
    // Idle Screen
    'idle.insertCoin': 'Gooi een munt in om te spelen!',
    'idle.winChance': 'Win direct prijzen!',
    'idle.specialOffers': 'Speciale Aanbiedingen!',
    'idle.playToWin': 'Speel om geweldige prijzen te winnen!',
    'idle.ad': 'Adv',
    'idle.of': 'van',

    // Quiz Screen
    'quiz.title': 'Beantwoord om te spelen!',
    'quiz.question': 'Vraag',
    'quiz.timeLeft': 'Tijd over',
    'quiz.seconds': 'seconden',
    'quiz.correct': 'Correct!',
    'quiz.incorrect': 'Fout!',
    'quiz.timeout': 'Tijd om!',
    'quiz.loading': 'Laden...',

    // Slot Machine Screen
    'slot.title': 'Draai om te winnen!',
    'slot.push': 'DRUK',
    'slot.spinning': 'Draait...',
    'slot.done': 'Klaar!',
    'slot.pressButton': 'Druk op de knop om te draaien!',
    'slot.jackpot': 'JACKPOT!',
    'slot.betterLuck': 'Volgende keer beter!',

    // Win Screen
    'win.congratulations': 'Gefeliciteerd!',
    'win.youWon': 'JE HEBT GEWONNEN!',
    'win.jackpot': 'JACKPOT!',
    'win.prize': 'Prijs',
    'win.preparing': 'Je prijs wordt voorbereid...',
    'win.printingTicket': 'Je prijsticket wordt afgedrukt...',
    'win.ticketPrinted': 'Ticket afgedrukt! Neem je prijs!',
    'win.printError': 'Afdrukfout - neem contact op met personeel',
    'win.takeTicket': 'Neem je ticket!',
    'win.redeemAt': 'Wissel in bij de balie',
    'win.expiresIn': 'Verloopt over 24 uur',

    // Loss Screen
    'loss.betterLuck': 'Volgende keer beter!',
    'loss.tryAgain': 'Gooi een andere munt in om opnieuw te spelen',

    // Coin values
    'coin.euro1': '€1',
    'coin.euro2': '€2',
    'coin.euro5': '€5',
  },
};

const LANGUAGE_STORAGE_KEY = 'kiosk_language';

class LanguageService {
  private currentLanguage: Language = 'fr';

  constructor() {
    this.loadLanguage();
  }

  /**
   * Load language from storage or detect from browser
   */
  private loadLanguage(): void {
    // First check localStorage for persisted preference
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'fr' || stored === 'nl') {
      this.currentLanguage = stored;
      console.log(`[LanguageService] Loaded language from storage: ${stored}`);
      return;
    }

    // Fall back to browser detection
    this.detectLanguage();
  }

  /**
   * Detect browser language and set accordingly
   * Defaults to French if not French or Dutch
   */
  detectLanguage(): Language {
    const browserLang = navigator.language.toLowerCase();

    if (browserLang.startsWith('nl')) {
      this.currentLanguage = 'nl';
    } else {
      // Default to French (fr, fr-BE, fr-FR, or any other)
      this.currentLanguage = 'fr';
    }

    // Persist detected language
    localStorage.setItem(LANGUAGE_STORAGE_KEY, this.currentLanguage);
    console.log(`[LanguageService] Detected language: ${browserLang} -> ${this.currentLanguage}`);
    return this.currentLanguage;
  }

  /**
   * Get current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set language manually and persist to storage
   */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    console.log(`[LanguageService] Language set to: ${lang}`);
  }

  /**
   * Get translated string by key
   */
  t(key: string): string {
    const translation = translations[this.currentLanguage][key];
    if (!translation) {
      console.warn(`[LanguageService] Missing translation for key: ${key}`);
      return key;
    }
    return translation;
  }

  /**
   * Check if current language is French
   */
  isFrench(): boolean {
    return this.currentLanguage === 'fr';
  }

  /**
   * Check if current language is Dutch
   */
  isDutch(): boolean {
    return this.currentLanguage === 'nl';
  }
}

// Singleton instance
export const languageService = new LanguageService();

// Convenience function for translations
export const t = (key: string): string => languageService.t(key);

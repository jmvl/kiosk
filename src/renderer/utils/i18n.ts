/**
 * Internationalization utilities for French/Dutch language support
 * Story 6.3: UI String Localization
 */

export type Language = 'fr' | 'nl';

// Translation dictionary type
type TranslationKey = keyof typeof translations.fr;

const translations = {
  fr: {
    // Idle Screen
    'idle.title': 'Bienvenue',
    'idle.insertCoin': 'Insérez une pièce pour jouer',

    // Quiz Screen
    'quiz.title': 'Question',
    'quiz.instructions': 'Répondez à la question pour jouer',

    // Slot Machine Screen
    'slot.title': 'Machine à sous',
    'slot.push': 'JOUER',
    'slot.spinning': 'En cours...',

    // Win Screen
    'win.title': 'VOUS AVEZ GAGNÉ!',
    'win.printingTicket': 'Impression du ticket...',
    'win.collectTicket': 'Récupérez votre ticket',

    // Loss Screen
    'loss.title': 'Pas de chance',
    'loss.tryAgain': 'Réessayez la prochaine fois!',

    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Une erreur est survenue',
    'common.retry': 'Réessayer',
  },
  nl: {
    // Idle Screen
    'idle.title': 'Welkom',
    'idle.insertCoin': 'Gooi een munt in om te spelen',

    // Quiz Screen
    'quiz.title': 'Vraag',
    'quiz.instructions': 'Beantwoord de vraag om te spelen',

    // Slot Machine Screen
    'slot.title': 'Gokautomaat',
    'slot.push': 'SPELEN',
    'slot.spinning': 'Bezig...',

    // Win Screen
    'win.title': 'JE HEBT GEWONNEN!',
    'win.printingTicket': 'Ticket wordt afgedrukt...',
    'win.collectTicket': 'Haal je ticket op',

    // Loss Screen
    'loss.title': 'Helaas',
    'loss.tryAgain': 'Probeer het de volgende keer opnieuw!',

    // Common
    'common.loading': 'Laden...',
    'common.error': 'Er is een fout opgetreden',
    'common.retry': 'Opnieuw proberen',
  },
} as const;

/**
 * Detect browser language, default to French
 */
export function detectLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith('nl')) {
    return 'nl';
  }

  // Default to French for fr, fr-BE, or unknown
  return 'fr';
}

/**
 * Get translation for a key in the specified language
 */
export function t(key: TranslationKey, lang: Language = 'fr'): string {
  return translations[lang][key] || translations.fr[key] || key;
}

/**
 * Create a translation function bound to a specific language
 */
export function createTranslator(lang: Language) {
  return (key: TranslationKey) => t(key, lang);
}

export default translations;

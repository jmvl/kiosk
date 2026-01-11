// Quiz Service - manages quiz questions library
import type { QuizQuestion } from '@shared/types';

// Quiz questions library - will be synced from Convex in production
const questionsLibrary: QuizQuestion[] = [
  {
    id: '1',
    question: {
      fr: 'Quelle est la capitale de la Belgique?',
      nl: 'Wat is de hoofdstad van Belgie?',
    },
    answers: {
      fr: ['Paris', 'Bruxelles', 'Amsterdam', 'Berlin'],
      nl: ['Parijs', 'Brussel', 'Amsterdam', 'Berlijn'],
    },
    correctAnswer: 1,
  },
  {
    id: '2',
    question: {
      fr: 'Combien de grammes font un kilogramme?',
      nl: 'Hoeveel gram zit er in een kilogram?',
    },
    answers: {
      fr: ['100', '500', '1000', '10000'],
      nl: ['100', '500', '1000', '10000'],
    },
    correctAnswer: 2,
  },
  {
    id: '3',
    question: {
      fr: 'Quelle couleur obtient-on en melangeant le bleu et le jaune?',
      nl: 'Welke kleur krijg je als je blauw en geel mengt?',
    },
    answers: {
      fr: ['Rouge', 'Vert', 'Orange', 'Violet'],
      nl: ['Rood', 'Groen', 'Oranje', 'Paars'],
    },
    correctAnswer: 1,
  },
  {
    id: '4',
    question: {
      fr: 'Combien y a-t-il de jours dans une semaine?',
      nl: 'Hoeveel dagen zitten er in een week?',
    },
    answers: {
      fr: ['5', '6', '7', '8'],
      nl: ['5', '6', '7', '8'],
    },
    correctAnswer: 2,
  },
  {
    id: '5',
    question: {
      fr: 'Quel est le plus grand ocean du monde?',
      nl: 'Wat is de grootste oceaan ter wereld?',
    },
    answers: {
      fr: ['Atlantique', 'Indien', 'Arctique', 'Pacifique'],
      nl: ['Atlantische', 'Indische', 'Arctische', 'Stille'],
    },
    correctAnswer: 3,
  },
  {
    id: '6',
    question: {
      fr: 'Combien de pattes a une araignee?',
      nl: 'Hoeveel poten heeft een spin?',
    },
    answers: {
      fr: ['4', '6', '8', '10'],
      nl: ['4', '6', '8', '10'],
    },
    correctAnswer: 2,
  },
  {
    id: '7',
    question: {
      fr: 'Quel animal est le plus grand mammifere terrestre?',
      nl: 'Welk dier is het grootste landzoogdier?',
    },
    answers: {
      fr: ['Lion', 'Elephant', 'Girafe', 'Hippopotame'],
      nl: ['Leeuw', 'Olifant', 'Giraffe', 'Nijlpaard'],
    },
    correctAnswer: 1,
  },
  {
    id: '8',
    question: {
      fr: 'Combien de mois ont 31 jours?',
      nl: 'Hoeveel maanden hebben 31 dagen?',
    },
    answers: {
      fr: ['4', '5', '6', '7'],
      nl: ['4', '5', '6', '7'],
    },
    correctAnswer: 3,
  },
];

/**
 * Get a random question from the library
 */
export function getRandomQuestion(): QuizQuestion {
  const randomIndex = Math.floor(Math.random() * questionsLibrary.length);
  return questionsLibrary[randomIndex];
}

/**
 * Get total number of questions in library
 */
export function getQuestionCount(): number {
  return questionsLibrary.length;
}

/**
 * Get a specific question by ID
 */
export function getQuestionById(id: string): QuizQuestion | undefined {
  return questionsLibrary.find((q) => q.id === id);
}

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type CampaignManifest = {
  name: string;
  brandName: string;
  copy: Record<string, string>;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
  };
  wheelSegments: Array<{ id: string; label: string; color: string; weight: number }>;
  questions: Array<{ id: string; prompt: string; options: Array<{ key: string; label: string }> }>;
};

const campaign: CampaignManifest = {
  name: 'Chocomel One and Only Spin',
  brandName: 'Chocomel',
  copy: {
    attractHeadline: 'Experience the one and only chocolate taste sensation',
    attractSubheadline: 'Insert a coin and spin for a Chocomel reward.',
    insertCoinCta: 'Insert coin to spin',
    spinCta: 'Spin the wheel',
    questionIntro: 'Answer one quick Chocomel question.',
    prizeIntro: 'Your Chocomel reward',
    resetMessage: 'Enjoy the one and only Chocomel.',
  },
  theme: {
    primaryColor: '#FFD200',
    secondaryColor: '#5A2D0C',
    accentColor: '#FFF3B0',
    backgroundColor: '#2A1308',
    textColor: '#2A1308',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  wheelSegments: [
    { id: 'free-sample', label: 'Free sample', color: '#FFD200', weight: 10 },
    { id: 'discount', label: 'Discount', color: '#5A2D0C', weight: 20 },
    { id: 'warm-chocomel', label: 'Warm Chocomel', color: '#FFF3B0', weight: 15 },
    { id: 'try-again', label: 'Try again', color: '#8B4A14', weight: 55 },
  ],
  questions: [
    {
      id: 'since-1932',
      prompt: 'Since which year has Chocomel been known for its chocolate flavoured milk?',
      options: [
        { key: 'a', label: '1932' },
        { key: 'b', label: '1958' },
        { key: 'c', label: '1984' },
      ],
    },
  ],
};

type Stage = 'attract' | 'ready' | 'spinning' | 'question' | 'prize';

function App() {
  const [stage, setStage] = useState<Stage>('attract');
  const [rotation, setRotation] = useState(0);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const question = campaign.questions[0];

  const result = useMemo(() => {
    if (resultIndex === null) return null;
    return campaign.wheelSegments[resultIndex];
  }, [resultIndex]);

  function insertCoin() {
    setStage('ready');
  }

  function spin() {
    const nextIndex = Math.floor(Math.random() * campaign.wheelSegments.length);
    setResultIndex(nextIndex);
    setRotation((previous) => previous + 1440 + nextIndex * 90);
    setStage('spinning');
    window.setTimeout(() => setStage('question'), 1700);
  }

  function answerQuestion() {
    setStage('prize');
  }

  function reset() {
    setStage('attract');
    setResultIndex(null);
  }

  return (
    <main className="screen" style={{ fontFamily: campaign.theme.fontFamily }}>
      <section className="hero">
        <p className="eyebrow">{campaign.brandName}</p>
        <h1>{campaign.copy.attractHeadline}</h1>
        <p>{campaign.copy.attractSubheadline}</p>
      </section>

      <section className="wheel-zone">
        <div className="pointer" />
        <div className="wheel" style={{ transform: `rotate(${rotation}deg)` }}>
          {campaign.wheelSegments.map((segment, index) => (
            <div
              className="segment"
              key={segment.id}
              style={{
                '--segment-color': segment.color,
                transform: `rotate(${index * 90}deg) skewY(-45deg)`,
              } as React.CSSProperties}
            >
              <span>{segment.label}</span>
            </div>
          ))}
          <div className="hub">One & Only</div>
        </div>
      </section>

      <section className="panel">
        {stage === 'attract' && <button onClick={insertCoin}>{campaign.copy.insertCoinCta}</button>}
        {stage === 'ready' && <button onClick={spin}>{campaign.copy.spinCta}</button>}
        {stage === 'spinning' && <strong>Spinning...</strong>}
        {stage === 'question' && question && (
          <div className="question">
            <p>{campaign.copy.questionIntro}</p>
            <h2>{question.prompt}</h2>
            <div className="answers">
              {question.options.map((option) => (
                <button key={option.key} onClick={answerQuestion}>{option.label}</button>
              ))}
            </div>
          </div>
        )}
        {stage === 'prize' && result && (
          <div className="prize">
            <p>{campaign.copy.prizeIntro}</p>
            <h2>{result.label}</h2>
            <p>Fake thermal ticket print event queued.</p>
            <button onClick={reset}>Reset kiosk</button>
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

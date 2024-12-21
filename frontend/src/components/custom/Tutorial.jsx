// src/components/custom/Tutorial.jsx
import { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { Button } from '../ui/button';
import { HelpCircle } from 'lucide-react';

const steps = [
  {
    target: '.tools-section',
    content: 'Welcome to NestJS Schema Generator! Let\'s take a quick tour of the features.',
    placement: 'bottom',
  },
  {
    target: '.add-table-btn',
    content: 'Start by creating a new table. Click here to add your first table.',
  },
  {
    target: '.table-list',
    content: 'Your tables will appear here. Click on a table to edit its properties.',
  },
  {
    target: '.erd-area',
    content: 'This is your ERD workspace. You can drag tables around and create relationships between them.',
  },
  {
    target: '.properties-panel',
    content: 'Edit table properties, add columns, and create relationships here.',
  },
  {
    target: '.export-section',
    content: 'When you\'re done, export your schema or save it as an image.',
  }
];

export function Tutorial() {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data) => {
    const { status, index } = data;
    setStepIndex(index);

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      localStorage.setItem('hasSeenTutorial', 'true');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setRun(true)}
        className="help-button"
        title="Show Tutorial"
      >
        <HelpCircle size={20} />
      </Button>

      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        stepIndex={stepIndex}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            textColor: '#1f2937',
            zIndex: 1000,
          },
        }}
      />
    </>
  );
}
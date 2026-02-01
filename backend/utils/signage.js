const DEFAULT_BACKGROUND_CONFIG = {
  type: 'gradient',
  colors: ['#be185d', '#831843', '#500724']
};

export function getDefaultBackgroundConfig() {
  return DEFAULT_BACKGROUND_CONFIG;
}

export function getDefaultQuestionnaireConfig() {
  return {
    initial_options: [
      { id: 'yes', label: 'Yes!' },
      { id: 'ready', label: "Let's go!" }
    ],
    questions_by_gender: {
      yes: [
        { id: 'q1_yes', label: 'Question 1?', type: 'mcq', options: [{ label: 'Option A', points: 1 }, { label: 'Option B', points: 2 }, { label: 'Option C', points: 3 }], timer_seconds: 10 }
      ],
      ready: [
        { id: 'q1_ready', label: 'Question 1?', type: 'mcq', options: [{ label: 'Option A', points: 1 }, { label: 'Option B', points: 2 }, { label: 'Option C', points: 3 }], timer_seconds: 10 }
      ]
    },
    result_bands: [
      { min_score: 0, max_score: 4, signage: { emoji: '😊', message: 'Thanks!', subtext: '' }, mobile: { heading: 'Thank you!', message: 'Your response has been submitted.' } },
      { min_score: 5, max_score: 999, signage: { emoji: '🎉', message: 'Great!', subtext: '' }, mobile: { heading: 'Thank you!', message: 'Your response has been submitted.' } }
    ]
  };
}

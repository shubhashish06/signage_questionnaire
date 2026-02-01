export function getBasePath() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path.startsWith('/questionnaire')) return '/questionnaire';
  return '';
}

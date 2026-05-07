import { getAuthUser } from './auth';

const SHARED_TOURNAMENT_SELECTION_KEY = 'falconarena_selected_tournament_id';

type TournamentOption = {
  id: string;
};

function userTournamentSelectionKey() {
  const userId = getAuthUser()?.id;
  return userId
    ? `${SHARED_TOURNAMENT_SELECTION_KEY}:${userId}`
    : SHARED_TOURNAMENT_SELECTION_KEY;
}

export function getStoredTournamentSelection() {
  return (
    localStorage.getItem(userTournamentSelectionKey()) ??
    localStorage.getItem(SHARED_TOURNAMENT_SELECTION_KEY) ??
    ''
  );
}

export function rememberTournamentSelection(tournamentId: string) {
  if (!tournamentId) {
    return;
  }

  localStorage.setItem(userTournamentSelectionKey(), tournamentId);
  localStorage.setItem(SHARED_TOURNAMENT_SELECTION_KEY, tournamentId);
}

export function resolveStoredTournamentSelection<T extends TournamentOption>(
  tournaments: T[],
  fallbackTournamentId: string,
) {
  const storedTournamentId = getStoredTournamentSelection();
  if (storedTournamentId && tournaments.some((entry) => entry.id === storedTournamentId)) {
    return storedTournamentId;
  }

  return fallbackTournamentId;
}

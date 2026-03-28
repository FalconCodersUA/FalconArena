export type TournamentScheduleEventType =
  | 'ROUND'
  | 'CONSULTATION'
  | 'DEADLINE'
  | 'ANNOUNCEMENT'
  | 'OTHER';

export type TournamentScheduleEvent = {
  id: string;
  tournamentId: string;
  title: string;
  description: string | null;
  type: TournamentScheduleEventType;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ROLES = ['ADMIN', 'TEAM', 'JURY', 'ORGANIZER'] as const;

export type Role = (typeof ROLES)[number];

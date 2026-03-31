import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { EvaluationController } from './evaluation.controller';

describe('EvaluationController permissions', () => {
  it('allows only admin and organizer to distribute assignments', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, EvaluationController.prototype.distribute);
    expect(roles).toEqual(['ADMIN', 'ORGANIZER']);
  });

  it('allows only admin and organizer to list all assignments in a round', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, EvaluationController.prototype.listByRound);
    expect(roles).toEqual(['ADMIN', 'ORGANIZER']);
  });

  it('allows only jury to access personal assignments', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, EvaluationController.prototype.listMyAssignments);
    expect(roles).toEqual(['JURY']);
  });

  it('allows only jury to submit evaluation', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, EvaluationController.prototype.submitEvaluation);
    expect(roles).toEqual(['JURY']);
  });
});

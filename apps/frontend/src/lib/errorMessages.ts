type Translate = (key: string) => string;

const ERROR_TRANSLATION_RULES: Array<[RegExp, string]> = [
  [/^Invalid tournament status transition:/i, 'common.errors.invalidTournamentStatusTransition'],
  [/registrationOpenAt must be earlier than registrationCloseAt/i, 'common.errors.invalidRegistrationWindow'],
  [/^Invalid round status transition:/i, 'common.errors.invalidRoundStatusTransition'],
  [/^Unsupported round status update:/i, 'common.errors.invalidRoundStatusTransition'],
  [/startsAt must be earlier than deadlineAt/i, 'common.errors.invalidRoundWindow'],
  [/Schedule event start time must be earlier than end time/i, 'common.errors.invalidScheduleWindow'],
  [/^Cannot activate round for draft tournament$/i, 'common.errors.activateRoundDraftTournament'],
  [/^Cannot activate round for finished tournament$/i, 'common.errors.activateRoundFinishedTournament'],
  [/^Cannot activate round after deadline$/i, 'common.errors.activateRoundAfterDeadline'],
  [/^Another round is already active for this tournament$/i, 'common.errors.anotherRoundActive'],
  [/^Round is not accepting submissions$/i, 'common.errors.roundNotAcceptingSubmissions'],
  [/^Submission deadline has passed$/i, 'common.errors.submissionDeadlinePassed'],
  [/^Cannot distribute assignments for draft round$/i, 'common.errors.distributeDraftRound'],
  [/^Cannot distribute assignments for evaluated round$/i, 'common.errors.distributeEvaluatedRound'],
  [/^Cannot distribute assignments for draft tournament$/i, 'common.errors.distributeDraftTournament'],
  [/^No submissions found for this round$/i, 'common.errors.noSubmissionsForRound'],
  [/^No users with JURY role found$/i, 'common.errors.noJuryUsers'],
  [/^Some provided juryUserIds are invalid or not JURY$/i, 'common.errors.invalidJuryUsers'],
  [/^No jury assigned to this tournament$/i, 'common.errors.noTournamentJury'],
  [/^Some selected jury users are invalid, blocked, or not JURY$/i, 'common.errors.invalidTournamentJuryUsers'],
  [/^Some selected jury users are not assigned to this tournament$/i, 'common.errors.juryUsersNotAssignedToTournament'],
  [/^Not enough jury users for requested reviewers per submission$/i, 'common.errors.notEnoughJuryUsers'],
  [/^Unable to distribute assignments without duplicates for one submission$/i, 'common.errors.distributeWithoutDuplicatesFailed'],
  [/^Cannot finish evaluation for draft round$/i, 'common.errors.finishDraftRound'],
  [/^Round is still active; use force=true to close and finish evaluation early$/i, 'common.errors.roundStillActive'],
  [/^Evaluation is incomplete:/i, 'common.errors.evaluationIncomplete'],
  [/^Cannot submit evaluation for draft round$/i, 'common.errors.evaluateDraftRound'],
  [/^Cannot submit evaluation for evaluated round$/i, 'common.errors.evaluateEvaluatedRound'],
  [/^Cannot submit evaluation for finished tournament$/i, 'common.errors.evaluateFinishedTournament'],
  [/^Evaluation assignment not found for this round$/i, 'common.errors.evaluationAssignmentNotFound'],
  [/^Assignment belongs to a different jury member$/i, 'common.errors.assignmentWrongJury'],
  [/^Use finish evaluation endpoint to mark round as evaluated$/i, 'common.errors.useFinishEvaluationEndpoint'],
  [/^Tournament is not open for registration$/i, 'common.errors.tournamentNotOpenForRegistration'],
  [/^Registration window is closed$/i, 'common.errors.registrationWindowClosed'],
  [/^Tournament team limit reached$/i, 'common.errors.teamLimitReached'],
  [/^Team must contain between \d+ and \d+ members$/i, 'common.errors.teamMemberCountInvalid'],
  [/^Member emails must be unique within the team$/i, 'common.errors.memberEmailsUnique'],
  [/^Captain email cannot be duplicated in members list$/i, 'common.errors.captainEmailDuplicate'],
  [/^Team already exists for this captain or team name is already used$/i, 'common.errors.teamAlreadyExists'],
  [/^Current user has no team in this tournament as captain$/i, 'common.errors.noCaptainTeam'],
  [/^Recipient not found$/i, 'common.errors.recipientNotFound'],
  [/^Cannot start dialog with yourself$/i, 'common.errors.dialogWithYourself'],
  [/^Dialog not found$/i, 'common.errors.dialogNotFound'],
  [/^Message body is empty$/i, 'common.errors.messageBodyEmpty'],
  [/^publishedAt is invalid$/i, 'common.errors.publishedAtInvalid'],
  [/^No fields provided for update$/i, 'common.errors.noFieldsProvided'],
  [/^Email is already registered$/i, 'common.errors.emailAlreadyRegistered'],
  [/^Invalid email or password$/i, 'common.errors.invalidCredentials'],
  [/^Account is blocked$/i, 'common.errors.accountBlocked'],
  [/^Organizer cannot create admin users$/i, 'common.errors.organizerCannotCreateAdmin'],
  [/^You cannot change your own role or block your own account$/i, 'common.errors.cannotUpdateSelf'],
  [/^No user management updates were provided$/i, 'common.errors.noUserUpdates'],
  [/^Blocked reason is required when blocking a user$/i, 'common.errors.blockReasonRequired'],
  [/^Current password is invalid$/i, 'common.errors.currentPasswordInvalid'],
  [/^currentPassword is required$/i, 'common.errors.currentPasswordRequired'],
  [/^newPassword is required$/i, 'common.errors.newPasswordRequired'],
  [/^dateOfBirth is invalid$/i, 'common.errors.dateOfBirthInvalid'],
  [/image type is not supported/i, 'common.errors.imageTypeUnsupported'],
  [/image payload is empty/i, 'common.errors.imagePayloadEmpty'],
  [/image is too large/i, 'common.errors.imageTooLarge'],
  [/^Review text is too short$/i, 'common.errors.reviewTooShort'],
  [/^Certificates are available only for finished tournaments$/i, 'common.errors.certificatesOnlyFinished'],
  [/^Winner certificate is available only for the first ranked team$/i, 'common.errors.winnerCertificateOnlyFirst'],
  [/^Platform banner file is required$/i, 'common.errors.platformBannerRequired'],
  [/^Platform content field exceeds \d+ characters$/i, 'common.errors.platformContentTooLong'],
  [/^Platform content image URL exceeds 2000 characters$/i, 'common.errors.platformImageUrlTooLong'],
  [/^Platform content contact URL exceeds 2000 characters$/i, 'common.errors.platformContactUrlTooLong'],
  [/^Platform content image URL must be an HTTP\(S\) URL or an absolute path$/i, 'common.errors.platformImageUrlInvalid'],
  [/^Platform content contact URL must be an HTTP\(S\), mailto, or absolute path URL$/i, 'common.errors.platformContactUrlInvalid'],
  [/^Only admins can manage system integrations$/i, 'common.errors.onlyAdminsIntegrations'],
  [/OAuth is not configured/i, 'common.errors.oauthNotConfigured'],
  [/Google account email is not verified/i, 'common.errors.googleEmailNotVerified'],
  [/GitHub account verified email is not available/i, 'common.errors.githubEmailUnavailable'],
  [/not found/i, 'common.errors.notFound'],
];

export function normalizeApiErrorMessage(
  requestError: unknown,
  t: Translate,
  fallbackMessage: string,
) {
  if (!(requestError instanceof Error)) {
    return fallbackMessage;
  }

  const message = requestError.message.trim();

  if (!message || /failed to fetch/i.test(message)) {
    return fallbackMessage;
  }

  for (const [pattern, key] of ERROR_TRANSLATION_RULES) {
    if (pattern.test(message)) {
      return t(key);
    }
  }

  return fallbackMessage;
}

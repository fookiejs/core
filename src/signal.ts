export type DoneSignal = "done";

export type RunningSignal = "running";

export type FailedSignal = "failed";

export const Done: DoneSignal = "done";

export const Running: RunningSignal = "running";

export const Failed: FailedSignal = "failed";

export type SignalByName = {
  done: DoneSignal;
  running: RunningSignal;
  failed: FailedSignal;
};

export type Signal = SignalByName[keyof SignalByName];

export type OutboxPendingStatus = "pending";

export type OutboxFailedStatus = "failed";

export type OutboxCompletedStatus = "completed";

export const OutboxPending: OutboxPendingStatus = "pending";

export const OutboxFailed: OutboxFailedStatus = "failed";

export const OutboxCompleted: OutboxCompletedStatus = "completed";

export type OutboxBlockedStatus = "blocked";

export type OutboxDeadLetterStatus = "dead_letter";

export const OutboxBlocked: OutboxBlockedStatus = "blocked";

export const OutboxDeadLetter: OutboxDeadLetterStatus = "dead_letter";

export type OutboxStatusByName = {
  pending: OutboxPendingStatus;
  failed: OutboxFailedStatus;
  completed: OutboxCompletedStatus;
  blocked: OutboxBlockedStatus;
  dead_letter: OutboxDeadLetterStatus;
};

export type OutboxStatus = OutboxStatusByName[keyof OutboxStatusByName];

export enum Phase {
  Forward = "forward",
  Settling = "settling",
  Compensating = "compensating",
  Completed = "completed",
  Compensated = "compensated",
  Stuck = "stuck",
}

export function isSagaPhase(phaseValue: string): phaseValue is Phase {
  if (phaseValue === Phase.Forward) {
    return true;
  }
  if (phaseValue === Phase.Settling) {
    return true;
  }
  if (phaseValue === Phase.Compensating) {
    return true;
  }
  if (phaseValue === Phase.Completed) {
    return true;
  }
  if (phaseValue === Phase.Compensated) {
    return true;
  }
  if (phaseValue === Phase.Stuck) {
    return true;
  }
  return false;
}

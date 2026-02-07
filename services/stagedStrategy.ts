// Staged Strategies - DCA / multi-step deposit plans
// "Deposit 100 USDC in 3 steps over 2 weeks" = plan with scheduled steps

const STORAGE_KEY = 'lifi_staged_strategy';

export interface StagedStep {
  stepNumber: number;
  amount: string;
  amountFormatted: string;
  dueDate: string; // ISO date
  dueInDays: number;
  status: 'pending' | 'completed' | 'skipped';
  txHash?: string;
}

export interface StagedStrategy {
  id: string;
  type: 'deposit' | 'hedge' | 'swap';
  totalAmount: string;
  totalAmountFormatted: string;
  steps: StagedStep[];
  createdAt: string;
  token: string;
  chain?: string;
  destinationChain?: string;
}

function getDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Create a staged deposit plan.
 * e.g. 100 USDC in 3 steps over 14 days = 3 steps of ~33 USDC each, spread across 2 weeks.
 */
export function createStagedDepositPlan(
  totalAmount: string,
  stepsCount: number,
  totalDays: number,
  token: string = 'USDC'
): StagedStrategy {
  const totalNum = parseFloat(totalAmount);
  const amountPerStep = totalNum / stepsCount;
  const daysPerStep = Math.floor(totalDays / Math.max(1, stepsCount - 1));

  const steps: StagedStep[] = [];
  for (let i = 0; i < stepsCount; i++) {
    const dueInDays = i * daysPerStep;
    steps.push({
      stepNumber: i + 1,
      amount: Math.floor(amountPerStep * 1e6).toString(), // USDC = 6 decimals
      amountFormatted: amountPerStep.toFixed(2),
      dueDate: getDaysFromNow(dueInDays),
      dueInDays,
      status: 'pending',
    });
  }

  const strategy: StagedStrategy = {
    id: `staged_${Date.now()}`,
    type: 'deposit',
    totalAmount: Math.floor(totalNum * 1e6).toString(),
    totalAmountFormatted: totalAmount,
    steps,
    createdAt: new Date().toISOString(),
    token,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strategy));
    } catch (_) {}
  }

  return strategy;
}

/**
 * Get current staged strategy from storage.
 */
export function getStagedStrategy(): StagedStrategy | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Mark a step as completed.
 */
export function completeStagedStep(stepNumber: number, txHash?: string): StagedStrategy | null {
  const strategy = getStagedStrategy();
  if (!strategy) return null;

  const step = strategy.steps.find(s => s.stepNumber === stepNumber);
  if (step) {
    step.status = 'completed';
    step.txHash = txHash;
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strategy));
    } catch (_) {}
  }
  return strategy;
}

/**
 * Get next pending step.
 */
export function getNextPendingStep(): StagedStep | null {
  const strategy = getStagedStrategy();
  if (!strategy) return null;
  return strategy.steps.find(s => s.status === 'pending') || null;
}

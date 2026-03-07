import planData from '@/data/plan.json'
import type { Plan } from '@/types/plan'

export function usePlan(): Plan {
  return planData as Plan
}

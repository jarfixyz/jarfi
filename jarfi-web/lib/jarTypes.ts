"use client";

export type JarType = "GOAL" | "DATE" | "GOAL_BY_DATE" | "SHARED";

export type UnlockRule =
  | "GOAL_REACHED"
  | "DATE_REACHED"
  | "GOAL_OR_DATE"
  | "MANUAL_ANYTIME";

export type JarStatus =
  | "ACTIVE"
  | "GOAL_REACHED"
  | "DATE_REACHED"
  | "ELIGIBLE_TO_WITHDRAW"
  | "WITHDRAWN";

export type ApprovalMode = "NONE" | "FAMILY_APPROVAL" | "CUSTOM_APPROVAL";

export type StepName =
  | "type"
  | "guide"
  | "name"
  | "image"
  | "goal"
  | "date"
  | "reminder"
  | "security"
  | "review";

// Steps to show per jar type (in order)
export const STEP_FLOWS: Record<JarType, StepName[]> = {
  GOAL:         ["name", "image", "goal", "date", "reminder", "security", "review"],
  DATE:         ["name", "image", "date", "reminder", "security", "review"],
  GOAL_BY_DATE: ["name", "image", "goal", "date", "reminder", "security", "review"],
  SHARED:       ["name", "image", "goal", "date", "security", "review"],
};

export const JAR_TYPE_LABELS: Record<JarType, string> = {
  GOAL:         "Goal Jar",
  DATE:         "Date Jar",
  GOAL_BY_DATE: "Goal by Date",
  SHARED:       "Shared Jar",
};

export const JAR_TYPE_DESCRIPTIONS: Record<JarType, string> = {
  GOAL:         "Reach a specific amount. Good for a trip, car, laptop, or gift.",
  DATE:         "Lock funds until a future date. Good for child savings, birthdays, or long-term plans.",
  GOAL_BY_DATE: "Set both a target amount and deadline. Unlocks when either happens first.",
  SHARED:       "Collect money from friends or family. Goal and date are optional. Creator withdraws anytime.",
};

export const JAR_TYPE_ICONS: Record<JarType, string> = {
  GOAL:         "🎯",
  DATE:         "📅",
  GOAL_BY_DATE: "🏁",
  SHARED:       "🎁",
};

export const UNLOCK_RULE_LABEL: Record<UnlockRule, string> = {
  GOAL_REACHED:   "Unlocks when goal is reached",
  DATE_REACHED:   "Unlocks on the set date",
  GOAL_OR_DATE:   "Unlocks when goal or date is reached — whichever comes first",
  MANUAL_ANYTIME: "Creator can withdraw anytime",
};

// Maps a jar type to its contract parameters
export function jarTypeToContract(
  type: JarType,
  unlockDate: number,
  goalAmount: number
): { mode: number; contractUnlockDate: number; contractGoal: number } {
  switch (type) {
    case "GOAL":
      return { mode: 1, contractUnlockDate: unlockDate, contractGoal: goalAmount };
    case "DATE":
      return { mode: 0, contractUnlockDate: unlockDate, contractGoal: 0 };
    case "GOAL_BY_DATE":
      return { mode: 2, contractUnlockDate: unlockDate, contractGoal: goalAmount };
    case "SHARED":
      // mode=0 with unlockDate=1 (epoch past) → unlock_jar succeeds immediately
      return { mode: 0, contractUnlockDate: 1, contractGoal: 0 };
  }
}

// Derive JarType from on-chain mode + unlock_date
export function contractToJarType(mode: number, unlockDate: number): JarType {
  if (mode === 1) return "GOAL";
  if (mode === 2) return "GOAL_BY_DATE";
  if (mode === 0 && (unlockDate === 0 || unlockDate === 1)) return "SHARED";
  return "DATE";
}

// Unlock rule derived from jar type
export function unlockRuleForType(type: JarType): UnlockRule {
  switch (type) {
    case "GOAL":         return "GOAL_REACHED";
    case "DATE":         return "DATE_REACHED";
    case "GOAL_BY_DATE": return "GOAL_OR_DATE";
    case "SHARED":       return "MANUAL_ANYTIME";
  }
}

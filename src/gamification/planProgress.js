import { evaluateStepChecks } from '../utils/stepChecker';

export function getPlanStepKey(stageId, stepIndex) {
  return `${stageId}:${stepIndex}`;
}

export function buildPlanMissionView(plan, workspaceState) {
  const stages = plan?.stages || [];
  if (!stages.length) return null;

  const completedStepXp = {};
  const stageViews = stages.map((stage, stageIndex) => {
    const steps = (stage.steps || []).map((description, stepIndex) => {
      const checks = stage.stepChecks?.[stepIndex] ?? [];
      const evaluation = checks.length && workspaceState
        ? evaluateStepChecks(checks, workspaceState)
        : { passed: false, pendingAiChecks: [] };
      const isCompleted = evaluation.passed && (evaluation.pendingAiChecks?.length || 0) === 0;
      const rewardXp = stage.stepXp?.[stepIndex] || 0;
      const stepKey = getPlanStepKey(stage.id, stepIndex);

      if (isCompleted) completedStepXp[stepKey] = rewardXp;

      return {
        id: `${stage.id}-step-${stepIndex + 1}`,
        description,
        target: 1,
        completed: isCompleted,
        rewardXp,
        stepKey,
      };
    });

    const completedSteps = steps.filter((step) => step.completed).length;

    return {
      id: stage.id,
      title: stage.label || `Stage ${stageIndex + 1}`,
      description: stage.objective || stage.why || '',
      reward_xp: steps.reduce((sum, step) => sum + step.rewardXp, 0),
      steps,
      sourceStage: stage,
      completedSteps,
      isComplete: steps.length > 0 && completedSteps === steps.length,
    };
  });

  const firstIncompleteIndex = stageViews.findIndex((stage) => !stage.isComplete);
  const currentIndex = firstIncompleteIndex === -1 ? Math.max(stageViews.length - 1, 0) : firstIncompleteIndex;
  const currentMission = stageViews[currentIndex];
  const missionProgress = Object.fromEntries(
    currentMission.steps.map((step) => [step.id, step.completed ? 1 : 0]),
  );
  const totalXpEarned = Object.values(completedStepXp).reduce((sum, xp) => sum + xp, 0);
  const totalXpAvailable = stageViews.reduce((sum, stage) => sum + stage.reward_xp, 0);

  return {
    currentMission,
    currentStageNumber: currentIndex + 1,
    currentStageTitle: currentMission.title,
    missionProgress,
    stepRewards: currentMission.steps.map((step) => step.rewardXp),
    completedSteps: currentMission.completedSteps,
    totalSteps: currentMission.steps.length,
    progressPercent: currentMission.steps.length > 0
      ? (currentMission.completedSteps / currentMission.steps.length) * 100
      : 0,
    isAllComplete: stageViews.every((stage) => stage.isComplete),
    completedStepXp,
    totalXpEarned,
    totalXpAvailable,
    stageViews,
  };
}

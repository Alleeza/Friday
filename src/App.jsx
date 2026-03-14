import { useState } from 'react';
import { getFallbackPlan } from './ai/planning/fallbackPlans';
import SandboxBuilderPage from './components/SandboxBuilderPage';
import GuidedSetupFlow from './components/GuidedSetupFlow';

export default function App() {
  const [setupData, setSetupData] = useState(null);
  const [projectPlan, setProjectPlan] = useState(null);

  const handleSetupComplete = (nextSetupData) => {
    setSetupData(nextSetupData);
    setProjectPlan(getFallbackPlan(nextSetupData?.idea || '', 0));
  };

  if (!setupData) {
    return <GuidedSetupFlow onComplete={handleSetupComplete} />;
  }

  return <SandboxBuilderPage initialSetupData={setupData} projectPlan={projectPlan} />;
}

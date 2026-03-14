import { useState } from 'react';
import { getFallbackPlan } from './ai/planning/fallbackPlans';
import SandboxBuilderPage from './components/SandboxBuilderPage';
import GuidedSetupFlow from './components/GuidedSetupFlow';
import { createBunnyCarrotExampleProject } from './data/exampleProjects';

export default function App() {
  const [setupData, setSetupData] = useState(null);
  const [projectPlan, setProjectPlan] = useState(null);

  const handleSetupComplete = (nextSetupData) => {
    setSetupData(nextSetupData);
    setProjectPlan(nextSetupData?.plan || getFallbackPlan(nextSetupData?.idea || '', 0));
  };

  const handleLaunchExample = () => {
    const exampleProject = createBunnyCarrotExampleProject();
    handleSetupComplete(exampleProject);
  };

  if (!setupData) {
    return <GuidedSetupFlow onComplete={handleSetupComplete} onLaunchExample={handleLaunchExample} />;
  }

  return <SandboxBuilderPage initialSetupData={setupData} projectPlan={projectPlan} />;
}

import { useState } from 'react';
import SandboxBuilderPage from './components/SandboxBuilderPage';
import GuidedSetupFlow from './components/GuidedSetupFlow';

export default function App() {
  const [setupData, setSetupData] = useState(null);

  if (!setupData) {
    return <GuidedSetupFlow onComplete={setSetupData} />;
  }

  return <SandboxBuilderPage initialSetupData={setupData} />;
}

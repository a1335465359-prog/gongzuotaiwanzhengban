import Scene from "./components/Scene";
import Onboarding from "./components/Onboarding";
import { useApp } from "./lib/useApp";

export default function App() {
  const { settings, setSettings } = useApp();

  if (!settings.onboardingDone) {
    return <Onboarding onDone={setSettings} />;
  }

  return <Scene />;
}

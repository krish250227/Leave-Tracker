import { useState } from "react";
import LeaveTracker from './LeaveTracker';
import ScrumTracker from './ScrumTracker';

export default function App() {
  const [view, setView] = useState("leave");
  return view === "leave"
    ? <LeaveTracker onSwitchView={() => setView("scrum")} />
    : <ScrumTracker onSwitchView={() => setView("leave")} />;
}

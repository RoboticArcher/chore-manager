import { useState, useEffect } from "react";
import ChoreLibrary from "./components/ChoreLibrary";
import ScheduleSetup from "./components/ScheduleSetup";
import CalendarView from "./components/CalendarView";
import "./App.css";

const STEPS = ["library", "schedule", "calendar"];

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [step, setStep] = useState(() => loadFromStorage("chore-step", "library"));
  const [selectedChores, setSelectedChores] = useState(() => loadFromStorage("chore-selected", []));
  const [schedules, setSchedules] = useState(() => loadFromStorage("chore-schedules", {}));
  const [completions, setCompletions] = useState(() => loadFromStorage("chore-completions", {}));

  useEffect(() => { localStorage.setItem("chore-step", JSON.stringify(step)); }, [step]);
  useEffect(() => { localStorage.setItem("chore-selected", JSON.stringify(selectedChores)); }, [selectedChores]);
  useEffect(() => { localStorage.setItem("chore-schedules", JSON.stringify(schedules)); }, [schedules]);
  useEffect(() => { localStorage.setItem("chore-completions", JSON.stringify(completions)); }, [completions]);

  function handleToggleComplete(dayKey, choreId) {
    const key = `${dayKey}:${choreId}`;
    setCompletions((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

  function handleToggleChore(chore) {
    setSelectedChores((prev) => {
      const exists = prev.find((c) => c.id === chore.id);
      if (exists) {
        setSchedules((s) => {
          const next = { ...s };
          delete next[chore.id];
          return next;
        });
        return prev.filter((c) => c.id !== chore.id);
      }
      return [...prev, chore];
    });
  }

  function handleAddCustom(chore) {
    setSelectedChores((prev) => {
      if (prev.find((c) => c.id === chore.id)) return prev;
      return [...prev, chore];
    });
  }

  function handleChangeSchedule(choreId, schedule) {
    setSchedules((prev) => ({ ...prev, [choreId]: schedule }));
  }

  function handleGoToSchedule() {
    setSchedules((prev) => {
      const next = { ...prev };
      for (const chore of selectedChores) {
        if (!next[chore.id]) {
          next[chore.id] = {
            frequency: "weekly",
            dayOfWeek: 1,
            dayOfMonth: 1,
            month: 0,
            customDays: 7,
            startDate: new Date().toISOString().split("T")[0],
          };
        }
      }
      return next;
    });
    setStep("schedule");
  }

  return (
    <div className="app">
      <div className="progress-bar">
        {["Pick Chores", "Set Schedules", "Calendar"].map((label, i) => {
          const currentIdx = STEPS.indexOf(step);
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <div key={label} className={`progress-step ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
              <div className="progress-dot">{isDone ? "✓" : i + 1}</div>
              <span className="progress-label">{label}</span>
            </div>
          );
        })}
      </div>

      {step === "library" && (
        <ChoreLibrary
          selectedChores={selectedChores}
          onToggleChore={handleToggleChore}
          onAddCustom={handleAddCustom}
          onNext={handleGoToSchedule}
        />
      )}

      {step === "schedule" && (
        <ScheduleSetup
          chores={selectedChores}
          schedules={schedules}
          onChangeSchedule={handleChangeSchedule}
          onBack={() => setStep("library")}
          onNext={() => setStep("calendar")}
        />
      )}

      {step === "calendar" && (
        <CalendarView
          chores={selectedChores}
          schedules={schedules}
          completions={completions}
          onToggleComplete={handleToggleComplete}
          onBack={() => setStep("schedule")}
        />
      )}
    </div>
  );
}

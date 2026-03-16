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

  const [selectedChores, setSelectedChores] = useState(() =>
    loadFromStorage("chore-selected", [])
  );

  // Custom chores stored separately so deselecting doesn't delete them.
  // Migration: if chore-custom doesn't exist yet, seed it from selectedChores.
  const [customChores, setCustomChores] = useState(() => {
    const saved = loadFromStorage("chore-custom", null);
    if (saved !== null) return saved;
    const selected = loadFromStorage("chore-selected", []);
    return selected.filter((c) => c.custom);
  });

  const [schedules, setSchedules] = useState(() =>
    loadFromStorage("chore-schedules", {})
  );
  const [completions, setCompletions] = useState(() =>
    loadFromStorage("chore-completions", {})
  );

  // Email reminder subscription (null = not subscribed)
  const [reminderEmail, setReminderEmail] = useState(() =>
    loadFromStorage("reminder-email", null)
  );
  // Hour of day to send the reminder (0–23, default 8 = 8am)
  const [reminderHour, setReminderHour] = useState(() =>
    loadFromStorage("reminder-hour", 8)
  );

  // Toast state for undo notifications
  const [toast, setToast] = useState(null); // { message, onUndo }

  useEffect(() => { localStorage.setItem("chore-step", JSON.stringify(step)); }, [step]);
  useEffect(() => { localStorage.setItem("chore-selected", JSON.stringify(selectedChores)); }, [selectedChores]);
  useEffect(() => { localStorage.setItem("chore-custom", JSON.stringify(customChores)); }, [customChores]);
  useEffect(() => { localStorage.setItem("chore-schedules", JSON.stringify(schedules)); }, [schedules]);
  useEffect(() => { localStorage.setItem("chore-completions", JSON.stringify(completions)); }, [completions]);
  useEffect(() => { localStorage.setItem("reminder-email", JSON.stringify(reminderEmail)); }, [reminderEmail]);
  useEffect(() => { localStorage.setItem("reminder-hour", JSON.stringify(reminderHour)); }, [reminderHour]);

  // Auto-sync schedule to server whenever chores/schedules change (if reminders are active)
  useEffect(() => {
    if (!reminderEmail) return;
    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: reminderEmail,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reminderHour,
        chores: selectedChores,
        schedules,
      }),
    }).catch(() => {}); // Silent — app works fine without server sync
  }, [selectedChores, schedules]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

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
        // For preset chores, also remove their schedule so it resets when re-added.
        // For custom chores, keep the schedule so it comes back intact on re-select.
        if (!chore.custom) {
          setSchedules((s) => {
            const next = { ...s };
            delete next[chore.id];
            return next;
          });
        }
        return prev.filter((c) => c.id !== chore.id);
      }
      return [...prev, chore];
    });
  }

  function handleAddCustom(chore) {
    setCustomChores((prev) => {
      if (prev.find((c) => c.id === chore.id)) return prev;
      return [...prev, chore];
    });
    setSelectedChores((prev) => {
      if (prev.find((c) => c.id === chore.id)) return prev;
      return [...prev, chore];
    });
  }

  // Feature #3: Undo for custom chore deletion
  function handleDeleteCustom(choreId) {
    const chore = customChores.find((c) => c.id === choreId);
    if (!chore) return;
    const wasSelected = !!selectedChores.find((c) => c.id === choreId);
    const savedSchedule = schedules[choreId] || null;

    setCustomChores((prev) => prev.filter((c) => c.id !== choreId));
    setSelectedChores((prev) => prev.filter((c) => c.id !== choreId));
    setSchedules((prev) => {
      const next = { ...prev };
      delete next[choreId];
      return next;
    });

    setToast({
      message: `"${chore.name}" removed.`,
      onUndo: () => {
        setCustomChores((prev) => [...prev, chore]);
        if (wasSelected) setSelectedChores((prev) => [...prev, chore]);
        if (savedSchedule) setSchedules((prev) => ({ ...prev, [choreId]: savedSchedule }));
        setToast(null);
      },
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
            dayOfWeek: [1], // Array for multi-day support (Feature #2)
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

  const currentIdx = STEPS.indexOf(step);

  return (
    <div className="app">
      {/* Feature #5: Clickable stepper navigation */}
      <div className="progress-bar">
        {["Pick Chores", "Set Schedules", "Calendar"].map((label, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          // Steps 0 and 1 are clickable when they're behind the current step.
          // Step 2 (Calendar) is never directly clickable — must go through the flow.
          const isClickable = isDone && i < 2;
          return (
            <div
              key={label}
              className={`progress-step ${isDone ? "done" : ""} ${isActive ? "active" : ""} ${isClickable ? "clickable" : ""}`}
              onClick={() => isClickable && setStep(STEPS[i])}
              title={isClickable ? `Go back to ${label}` : undefined}
            >
              <div className="progress-dot">{isDone ? "✓" : i + 1}</div>
              <span className="progress-label">{label}</span>
            </div>
          );
        })}
      </div>

      {step === "library" && (
        <ChoreLibrary
          selectedChores={selectedChores}
          customChores={customChores}
          onToggleChore={handleToggleChore}
          onAddCustom={handleAddCustom}
          onDeleteCustom={handleDeleteCustom}
          onNext={handleGoToSchedule}
        />
      )}

      {step === "schedule" && (
        <ScheduleSetup
          chores={selectedChores}
          schedules={schedules}
          completions={completions}
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
          reminderEmail={reminderEmail}
          onSetReminderEmail={setReminderEmail}
          reminderHour={reminderHour}
          onSetReminderHour={setReminderHour}
        />
      )}

      {/* Feature #3: Undo toast */}
      {toast && (
        <div className="toast">
          <span className="toast-message">{toast.message}</span>
          {toast.onUndo && (
            <button className="toast-undo" onClick={toast.onUndo}>
              Undo
            </button>
          )}
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}

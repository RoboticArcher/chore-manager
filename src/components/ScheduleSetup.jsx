import { useState } from "react";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily", description: "Every day" },
  { value: "weekly", label: "Weekly", description: "Once a week" },
  { value: "biweekly", label: "Every 2 Weeks", description: "Every other week" },
  { value: "monthly", label: "Monthly", description: "Once a month" },
  { value: "quarterly", label: "Quarterly", description: "Every 3 months" },
  { value: "yearly", label: "Yearly", description: "Once a year" },
  { value: "custom", label: "Custom", description: "Set your own interval" },
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ScheduleCard({ chore, schedule, onChange }) {
  const freq = schedule?.frequency || "weekly";
  const [expanded, setExpanded] = useState(true);

  function update(fields) {
    onChange(chore.id, { ...schedule, frequency: freq, ...fields });
  }

  return (
    <div className="schedule-card">
      <button className="schedule-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="chore-icon">
          {chore.emoji} {chore.name}
        </span>
        <span className="schedule-summary">
          {getScheduleSummary(schedule)} {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="schedule-card-body">
          {/* Frequency selector */}
          <div className="freq-grid">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`freq-chip ${freq === opt.value ? "selected" : ""}`}
                onClick={() => update({ frequency: opt.value, dayOfWeek: 1, dayOfMonth: 1, month: 0, customDays: 7 })}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refinement options based on frequency */}
          {freq === "weekly" && (
            <div className="refine-section">
              <label>Which day?</label>
              <div className="day-grid">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={day}
                    className={`day-chip ${(schedule?.dayOfWeek ?? 1) === i ? "selected" : ""}`}
                    onClick={() => update({ dayOfWeek: i })}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === "biweekly" && (
            <div className="refine-section">
              <label>Which day?</label>
              <div className="day-grid">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={day}
                    className={`day-chip ${(schedule?.dayOfWeek ?? 1) === i ? "selected" : ""}`}
                    onClick={() => update({ dayOfWeek: i })}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === "monthly" && (
            <div className="refine-section">
              <label>Which day of the month?</label>
              <div className="dom-grid">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    className={`day-chip ${(schedule?.dayOfMonth ?? 1) === d ? "selected" : ""}`}
                    onClick={() => update({ dayOfMonth: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === "quarterly" && (
            <div className="refine-section">
              <label>Day of month?</label>
              <div className="dom-grid small">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    className={`day-chip ${(schedule?.dayOfMonth ?? 1) === d ? "selected" : ""}`}
                    onClick={() => update({ dayOfMonth: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === "yearly" && (
            <div className="refine-section">
              <label>Which month?</label>
              <div className="month-grid">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    className={`month-chip ${(schedule?.month ?? 0) === i ? "selected" : ""}`}
                    onClick={() => update({ month: i, dayOfMonth: schedule?.dayOfMonth ?? 1 })}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
              <label style={{ marginTop: "10px" }}>Which day?</label>
              <div className="dom-grid small">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    className={`day-chip ${(schedule?.dayOfMonth ?? 1) === d ? "selected" : ""}`}
                    onClick={() => update({ dayOfMonth: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === "custom" && (
            <div className="refine-section">
              <label>Every how many days?</label>
              <div className="custom-interval-row">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={schedule?.customDays ?? 7}
                  onChange={(e) => update({ customDays: parseInt(e.target.value) || 7 })}
                  className="interval-input"
                />
                <span>days</span>
              </div>
            </div>
          )}

          {/* Start date */}
          <div className="refine-section">
            <label>Start date</label>
            <input
              type="date"
              className="date-input"
              value={schedule?.startDate || new Date().toISOString().split("T")[0]}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function getScheduleSummary(schedule) {
  if (!schedule) return "Not set";
  const { frequency, dayOfWeek, dayOfMonth, month, customDays } = schedule;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  switch (frequency) {
    case "daily": return "Every day";
    case "weekly": return `Every ${days[dayOfWeek ?? 1]}`;
    case "biweekly": return `Every other ${days[dayOfWeek ?? 1]}`;
    case "monthly": return `Monthly on the ${ordinal(dayOfMonth ?? 1)}`;
    case "quarterly": return `Quarterly on the ${ordinal(dayOfMonth ?? 1)}`;
    case "yearly": return `${months[month ?? 0]} ${dayOfMonth ?? 1}`;
    case "custom": return `Every ${customDays ?? 7} days`;
    default: return "Not set";
  }
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ScheduleSetup({ chores, schedules, onChangeSchedule, onBack, onNext }) {
  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Set Schedules</h1>
        <p className="subtitle">Choose how often each chore repeats.</p>
      </div>

      <div className="schedule-list">
        {chores.map((chore) => (
          <ScheduleCard
            key={chore.id}
            chore={chore}
            schedule={schedules[chore.id]}
            onChange={onChangeSchedule}
          />
        ))}
      </div>

      <div className="sticky-footer">
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" onClick={onNext}>
          View Calendar →
        </button>
      </div>
    </div>
  );
}

export { getScheduleSummary };

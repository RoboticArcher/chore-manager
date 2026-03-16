import { useState } from "react";
import { calculateStreak } from "../utils/scheduleUtils";

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

// Normalize dayOfWeek: old data may store a plain number, new data stores an array.
function normWeekDays(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "number") return [val];
  return [1];
}

function ScheduleCard({ chore, schedule, completions, onChange }) {
  const freq = schedule?.frequency || "weekly";
  const [expanded, setExpanded] = useState(true);

  function update(fields) {
    onChange(chore.id, { ...schedule, frequency: freq, ...fields });
  }

  // Feature #2: Multi-day weekly — dayOfWeek is now an array
  const weekDays = normWeekDays(schedule?.dayOfWeek);

  function toggleWeekDay(i) {
    if (weekDays.includes(i)) {
      // Don't let the user remove the last day
      if (weekDays.length > 1) {
        update({ dayOfWeek: weekDays.filter((d) => d !== i).sort((a, b) => a - b) });
      }
    } else {
      update({ dayOfWeek: [...weekDays, i].sort((a, b) => a - b) });
    }
  }

  // Biweekly still uses a single day (normalised to first element if array)
  const biDow =
    typeof schedule?.dayOfWeek === "number"
      ? schedule.dayOfWeek
      : normWeekDays(schedule?.dayOfWeek)[0];

  // Feature #1: Streak counter
  const streak = calculateStreak(chore, schedule, completions);

  return (
    <div className="schedule-card">
      <button className="schedule-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="chore-icon">
          {chore.emoji} {chore.name}
          {streak > 0 && (
            <span className="streak-badge">🔥 {streak} in a row</span>
          )}
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
                onClick={() =>
                  update({ frequency: opt.value, dayOfWeek: [1], dayOfMonth: 1, month: 0, customDays: 7 })
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Feature #2: Weekly — multi-select days */}
          {freq === "weekly" && (
            <div className="refine-section">
              <label>Which day(s)? <span className="label-hint">tap to toggle</span></label>
              <div className="day-grid">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={day}
                    className={`day-chip ${weekDays.includes(i) ? "selected" : ""}`}
                    onClick={() => toggleWeekDay(i)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Biweekly — single day */}
          {freq === "biweekly" && (
            <div className="refine-section">
              <label>Which day?</label>
              <div className="day-grid">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={day}
                    className={`day-chip ${biDow === i ? "selected" : ""}`}
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
            <label>Start date <span className="label-hint">use the calendar picker</span></label>
            <input
              type="date"
              className="date-input"
              value={schedule?.startDate || new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                const val = e.target.value;
                // Only save when value is a valid YYYY-MM-DD (prevents malformed keyboard entry)
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) update({ startDate: val });
              }}
            />
          </div>

          {/* Notes */}
          <div className="refine-section">
            <label>Notes <span className="label-hint">optional · max 100 chars</span></label>
            <textarea
              className="notes-input"
              maxLength={100}
              placeholder="Any details about this chore..."
              value={schedule?.notes || ""}
              onChange={(e) => update({ notes: e.target.value })}
            />
            <div className="notes-counter">{(schedule?.notes || "").length}/100</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function getScheduleSummary(schedule) {
  if (!schedule) return "Not set";
  const { frequency, dayOfWeek, dayOfMonth, month, customDays } = schedule;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  switch (frequency) {
    case "daily":
      return "Every day";

    case "weekly": {
      // Feature #2: dayOfWeek is now an array
      const targets = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek ?? 1];
      if (targets.length === 1) return `Every ${days[targets[0]]}`;
      return `Every ${targets.map((d) => shortDays[d]).join(", ")}`;
    }

    case "biweekly": {
      const dow = typeof dayOfWeek === "number" ? dayOfWeek : normWeekDays(dayOfWeek)[0];
      return `Every other ${days[dow ?? 1]}`;
    }

    case "monthly":
      return `Monthly on the ${ordinal(dayOfMonth ?? 1)}`;

    case "quarterly":
      return `Quarterly on the ${ordinal(dayOfMonth ?? 1)}`;

    case "yearly":
      return `${months[month ?? 0]} ${dayOfMonth ?? 1}`;

    case "custom":
      return `Every ${customDays ?? 7} days`;

    default:
      return "Not set";
  }
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ScheduleSetup({ chores, schedules, completions, onChangeSchedule, onBack, onNext }) {
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
            completions={completions}
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

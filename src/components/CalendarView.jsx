import { useState } from "react";
import { buildCalendarMap, dateKey } from "../utils/scheduleUtils";
import { downloadICS } from "../utils/icsExport";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ChoreRow({ chore, done, onToggle }) {
  return (
    <li className={`chore-row ${done ? "done" : ""}`} onClick={onToggle}>
      <button
        className={`complete-btn ${done ? "checked" : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done ? "✓" : ""}
      </button>
      <span className="chore-emoji-lg">{chore.emoji}</span>
      <span className="chore-name">{chore.name}</span>
    </li>
  );
}

export default function CalendarView({ chores, schedules, completions, onToggleComplete, onBack, reminderEmail, onSetReminderEmail }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showExportPanel, setShowExportPanel] = useState(false);

  // Email reminder form state
  const [emailInput, setEmailInput] = useState("");
  const [timezoneInput, setTimezoneInput] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  );
  const [subscribeStatus, setSubscribeStatus] = useState("idle"); // "idle" | "loading" | "error"

  async function handleSubscribe(e) {
    e.preventDefault();
    setSubscribeStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput,
          timezone: timezoneInput,
          chores,
          schedules,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      onSetReminderEmail(emailInput);
      setSubscribeStatus("idle");
    } catch {
      setSubscribeStatus("error");
    }
  }

  async function handleUnsubscribe() {
    if (!reminderEmail) return;
    // In-app removal — no HMAC token needed (user is present)
    try {
      await fetch(`/api/unsubscribe?email=${encodeURIComponent(reminderEmail)}`);
    } catch {
      // Ignore — clear locally regardless
    }
    onSetReminderEmail(null);
  }

  const calMap = buildCalendarMap(chores, schedules, viewYear, viewMonth);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startPadding = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const todayKey = dateKey(today);

  // The key for the selected day (if any)
  const selectedKey = selectedDay
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;

  // Bug #4: Top card shows selected day OR today (when nothing is selected)
  const displayKey = selectedDay ? selectedKey : todayKey;
  const displayChores = calMap[displayKey] || [];
  const displayDoneCount = displayChores.filter((c) => completions[`${displayKey}:${c.id}`]).length;
  const displayAllDone = displayChores.length > 0 && displayDoneCount === displayChores.length;
  const isShowingToday = !selectedDay || selectedKey === todayKey;

  // The date object for the display card header
  const displayDate = selectedDay ? new Date(viewYear, viewMonth, selectedDay) : today;

  // Feature #1: Monthly completion percentage
  const totalThisMonth = Object.values(calMap).reduce((sum, arr) => sum + arr.length, 0);
  const completedThisMonth = Object.entries(calMap).reduce((sum, [key, dayChores]) => {
    return sum + dayChores.filter((c) => !!completions[`${key}:${c.id}`]).length;
  }, 0);
  const completionPct = totalThisMonth > 0
    ? Math.round((completedThisMonth / totalThisMonth) * 100)
    : null;

  return (
    <div className="screen">

      {/* Bug #4: Top detail card — updates when a date is clicked */}
      <div className="today-section">
        <div className="today-header">
          <div>
            {isShowingToday
              ? <div className="today-label">TODAY</div>
              : <div className="today-label selected-label">Selected Date</div>
            }
            <div className="today-date">
              {MONTH_NAMES[displayDate.getMonth()]} {displayDate.getDate()}, {displayDate.getFullYear()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {!isShowingToday && (
              <button
                className="btn-ghost small"
                onClick={() => setSelectedDay(null)}
                title="Back to today"
              >
                ← Today
              </button>
            )}
            <button className="export-btn" onClick={() => setShowExportPanel(true)}>
              Export ↗
            </button>
          </div>
        </div>

        {displayChores.length === 0 ? (
          <p className="today-empty">
            {isShowingToday ? "No chores scheduled today. Enjoy your day!" : "No chores scheduled on this day."}
          </p>
        ) : displayAllDone ? (
          <div className="today-all-done">All done{isShowingToday ? " for today" : ""}! 🎉</div>
        ) : (
          <>
            <ul className="chore-list-detail today-chores">
              {displayChores.map((c) => (
                <ChoreRow
                  key={c.id}
                  chore={c}
                  done={!!completions[`${displayKey}:${c.id}`]}
                  onToggle={() => onToggleComplete(displayKey, c.id)}
                />
              ))}
            </ul>
            <div className="today-progress">
              <div className="today-progress-bar">
                <div
                  className="today-progress-fill"
                  style={{ width: `${(displayDoneCount / displayChores.length) * 100}%` }}
                />
              </div>
              <span className="today-progress-text">{displayDoneCount}/{displayChores.length} done</span>
            </div>
          </>
        )}
      </div>

      {/* Feature #1: Monthly completion percentage summary */}
      {completionPct !== null && (
        <div className={`completion-summary ${completionPct === 100 ? "perfect" : ""}`}>
          {completionPct === 100
            ? `🏆 Perfect month — all ${totalThisMonth} chores completed!`
            : `${MONTH_NAMES[viewMonth]}: ${completedThisMonth} of ${totalThisMonth} chores completed — ${completionPct}%`
          }
        </div>
      )}

      {/* Month navigation */}
      <div className="month-nav">
        <button className="nav-arrow" onClick={prevMonth}>‹</button>
        <div className="month-title-block">
          <h2 className="month-title">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
          <span className="month-count">{totalThisMonth} chore{totalThisMonth !== 1 ? "s" : ""}</span>
        </div>
        <button className="nav-arrow" onClick={nextMonth}>›</button>
      </div>

      {/* Calendar grid */}
      <div className="calendar">
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}

        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="cal-cell empty" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayChores = calMap[key] || [];
          const doneCount = dayChores.filter((c) => completions[`${key}:${c.id}`]).length;
          const allDone = dayChores.length > 0 && doneCount === dayChores.length;
          const isToday = key === todayKey;
          const isSelected = day === selectedDay;

          return (
            <button
              key={day}
              className={`cal-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${dayChores.length > 0 ? "has-chores" : ""} ${allDone ? "all-done" : ""}`}
              onClick={() => setSelectedDay(isSelected ? null : day)}
            >
              <span className="cal-day-num">{day}</span>
              {dayChores.length > 0 && (
                <div className="chore-dots">
                  {dayChores.slice(0, 3).map((c, i) => {
                    const done = !!completions[`${key}:${c.id}`];
                    return (
                      <span key={i} className={`chore-dot ${done ? "done" : ""}`} title={c.name}>
                        {done ? "✓" : c.emoji}
                      </span>
                    );
                  })}
                  {dayChores.length > 3 && (
                    <span className="chore-more">+{dayChores.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Export modal */}
      {showExportPanel && (
        <div className="modal-overlay" onClick={() => setShowExportPanel(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export to Calendar</h3>
            <p>Download your chore schedule as a calendar file (.ics). This works with Apple Calendar and Google Calendar.</p>
            <button
              className="btn-primary full-width"
              onClick={() => { downloadICS(chores, schedules); setShowExportPanel(false); }}
            >
              📅 Download .ics file
            </button>
            <div className="export-instructions">
              <p><strong>Apple Calendar:</strong> Double-click the downloaded file to import.</p>
              <p><strong>Google Calendar:</strong> Go to Settings → Import &amp; Export → Import.</p>
            </div>
            <div className="reminder-section">
              <h4>🔔 Morning Reminders</h4>
              {reminderEmail ? (
                <div className="reminder-active">
                  <span>Reminders active for <strong>{reminderEmail}</strong></span>
                  <button className="btn-ghost small" onClick={handleUnsubscribe}>
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubscribe}>
                  <p className="reminder-description">Get a morning email on days you have chores scheduled.</p>
                  <input
                    type="email"
                    className="text-input"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                  <select
                    className="text-input"
                    value={timezoneInput}
                    onChange={(e) => setTimezoneInput(e.target.value)}
                  >
                    <option value="America/New_York">Eastern (ET)</option>
                    <option value="America/Chicago">Central (CT)</option>
                    <option value="America/Denver">Mountain (MT)</option>
                    <option value="America/Los_Angeles">Pacific (PT)</option>
                    <option value="America/Anchorage">Alaska (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii (HST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                  <button
                    type="submit"
                    className="btn-primary full-width"
                    disabled={subscribeStatus === "loading"}
                  >
                    {subscribeStatus === "loading" ? "Saving..." : "Enable reminders"}
                  </button>
                  {subscribeStatus === "error" && (
                    <p className="custom-form-error">Something went wrong. Please try again.</p>
                  )}
                </form>
              )}
            </div>
            <button className="btn-ghost full-width" onClick={() => setShowExportPanel(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="sticky-footer">
        <button className="btn-ghost" onClick={onBack}>
          ← Edit Schedules
        </button>
      </div>
    </div>
  );
}

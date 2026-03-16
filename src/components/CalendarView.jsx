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

export default function CalendarView({ chores, schedules, completions, onToggleComplete, onBack }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showExportPanel, setShowExportPanel] = useState(false);

  const calMap = buildCalendarMap(chores, schedules, viewYear, viewMonth);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startPadding = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }

  const todayKey = dateKey(today);

  // Today's chores
  const todayChores = calMap[todayKey] || [];
  const todayDoneCount = todayChores.filter(c => completions[`${todayKey}:${c.id}`]).length;
  const todayAllDone = todayChores.length > 0 && todayDoneCount === todayChores.length;

  // Selected day
  const selectedKey = selectedDay
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;
  const selectedChores = selectedKey ? (calMap[selectedKey] || []) : [];

  const totalThisMonth = Object.values(calMap).reduce((sum, arr) => sum + arr.length, 0);

  // Is viewing current month?
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <div className="screen">
      {/* Today section */}
      <div className="today-section">
        <div className="today-header">
          <div>
            <div className="today-label">Today</div>
            <div className="today-date">
              {MONTH_NAMES[today.getMonth()]} {today.getDate()}, {today.getFullYear()}
            </div>
          </div>
          <button className="export-btn" onClick={() => setShowExportPanel(true)}>
            Export ↗
          </button>
        </div>

        {todayChores.length === 0 ? (
          <p className="today-empty">No chores scheduled today. Enjoy your day!</p>
        ) : todayAllDone ? (
          <div className="today-all-done">All done for today! 🎉</div>
        ) : (
          <>
            <ul className="chore-list-detail today-chores">
              {todayChores.map((c) => (
                <ChoreRow
                  key={c.id}
                  chore={c}
                  done={!!completions[`${todayKey}:${c.id}`]}
                  onToggle={() => onToggleComplete(todayKey, c.id)}
                />
              ))}
            </ul>
            <div className="today-progress">
              <div className="today-progress-bar">
                <div
                  className="today-progress-fill"
                  style={{ width: `${(todayDoneCount / todayChores.length) * 100}%` }}
                />
              </div>
              <span className="today-progress-text">{todayDoneCount}/{todayChores.length} done</span>
            </div>
          </>
        )}
      </div>

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
          const doneCount = dayChores.filter(c => completions[`${key}:${c.id}`]).length;
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

      {/* Selected day detail */}
      {selectedDay && (
        <div className="day-detail">
          <h3>
            {MONTH_NAMES[viewMonth]} {selectedDay}
            {selectedChores.length === 0 && " — No chores"}
          </h3>
          {selectedChores.length > 0 && (
            <ul className="chore-list-detail">
              {selectedChores.map((c) => {
                const done = !!completions[`${selectedKey}:${c.id}`];
                return (
                  <ChoreRow
                    key={c.id}
                    chore={c}
                    done={done}
                    onToggle={() => onToggleComplete(selectedKey, c.id)}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}

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
            <div className="coming-soon">
              <p>🔔 <strong>Email reminders</strong> — coming soon. We'll send you a morning reminder on each chore day.</p>
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

import { useState, useMemo, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { buildCalendarMap, dateKey, calculateStreak } from "../utils/scheduleUtils";
import { downloadICS } from "../utils/icsExport";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ChoreRow({ chore, done, onToggle, note }) {
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
      <div className="chore-row-text">
        <span className="chore-name">{chore.name}</span>
        {note && <span className="chore-note">{note}</span>}
      </div>
    </li>
  );
}

const REMINDER_TIMES = [
  { label: "6:00 AM", hour: 6 },
  { label: "7:00 AM", hour: 7 },
  { label: "8:00 AM", hour: 8 },
  { label: "9:00 AM", hour: 9 },
  { label: "10:00 AM", hour: 10 },
  { label: "12:00 PM", hour: 12 },
];

export default function CalendarView({ chores, schedules, completions, onToggleComplete, onBack, reminderEmail, onSetReminderEmail, reminderHour, onSetReminderHour, reminderTimezone, onSetReminderTimezone }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // Email reminder form state
  const [emailInput, setEmailInput] = useState("");
  const [timezoneInput, setTimezoneInput] = useState(
    reminderTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  );
  const [hourInput, setHourInput] = useState(reminderHour ?? 8);
  const [subscribeStatus, setSubscribeStatus] = useState("idle");
  const [updateStatus, setUpdateStatus] = useState("idle");

  // Keep hourInput in sync if parent changes reminderHour
  useEffect(() => { setHourInput(reminderHour ?? 8); }, [reminderHour]);

  // Confetti when all chores for a day are marked done
  const prevAllDoneRef = useRef(false);
  useEffect(() => {
    if (displayAllDone && displayChores.length > 0 && !prevAllDoneRef.current) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    prevAllDoneRef.current = displayAllDone;
  });

  function handleMarkAllDone() {
    displayChores.forEach((c) => {
      if (!completions[`${displayKey}:${c.id}`]) {
        onToggleComplete(displayKey, c.id);
      }
    });
  }

  function handleUnmarkAll() {
    displayChores.forEach((c) => {
      if (completions[`${displayKey}:${c.id}`]) {
        onToggleComplete(displayKey, c.id);
      }
    });
  }

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
          reminderHour: hourInput,
          chores,
          schedules,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      onSetReminderEmail(emailInput);
      onSetReminderHour(hourInput);
      onSetReminderTimezone(timezoneInput);
      setSubscribeStatus("idle");
    } catch {
      setSubscribeStatus("error");
    }
  }

  async function handleUpdateTime(newHour) {
    setHourInput(newHour);
    if (!reminderEmail) return;
    setUpdateStatus("saving");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: reminderEmail,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          reminderHour: newHour,
          chores,
          schedules,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      onSetReminderHour(newHour);
      setUpdateStatus("saved");
      setTimeout(() => setUpdateStatus("idle"), 2000);
    } catch {
      setUpdateStatus("error");
    }
  }

  async function handleUnsubscribe() {
    if (!reminderEmail) return;
    try {
      await fetch(`/api/unsubscribe?email=${encodeURIComponent(reminderEmail)}`);
    } catch {
      // Ignore — clear locally regardless
    }
    onSetReminderEmail(null);
  }

  // Memoized calendar map — only recomputes on chore/schedule/month change
  const calMap = useMemo(
    () => buildCalendarMap(chores, schedules, viewYear, viewMonth),
    [chores, schedules, viewYear, viewMonth]
  );

  // Stats: last 6 months completion data
  const monthlyStats = useMemo(() => {
    const stats = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const map = buildCalendarMap(chores, schedules, yr, mo);
      const total = Object.values(map).reduce((sum, arr) => sum + arr.length, 0);
      const done = Object.entries(map).reduce((sum, [key, arr]) => {
        return sum + arr.filter((c) => !!completions[`${key}:${c.id}`]).length;
      }, 0);
      stats.push({
        label: d.toLocaleString("default", { month: "short" }),
        total,
        done,
        pct: total > 0 ? Math.round((done / total) * 100) : null,
      });
    }
    return stats;
  }, [chores, schedules, completions]);

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

  const selectedKey = selectedDay
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;

  const displayKey = selectedDay ? selectedKey : todayKey;
  const displayChores = calMap[displayKey] || [];
  const displayDoneCount = displayChores.filter((c) => completions[`${displayKey}:${c.id}`]).length;
  const displayAllDone = displayChores.length > 0 && displayDoneCount === displayChores.length;
  const isShowingToday = !selectedDay || selectedKey === todayKey;

  const displayDate = selectedDay ? new Date(viewYear, viewMonth, selectedDay) : today;

  // Monthly completion percentage
  const totalThisMonth = Object.values(calMap).reduce((sum, arr) => sum + arr.length, 0);
  const completedThisMonth = Object.entries(calMap).reduce((sum, [key, dayChores]) => {
    return sum + dayChores.filter((c) => !!completions[`${key}:${c.id}`]).length;
  }, 0);
  const completionPct = totalThisMonth > 0
    ? Math.round((completedThisMonth / totalThisMonth) * 100)
    : null;

  return (
    <div className="screen">

      {/* Top detail card */}
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
            <button className="export-btn" onClick={() => setShowStatsPanel(true)} title="Stats" aria-label="View stats">
              📊
            </button>
            <button className="export-btn" onClick={() => setShowReminderPanel(true)} title="Email reminders" aria-label="Email reminders">
              🔔{reminderEmail ? <span className="reminder-active-dot" /> : null}
            </button>
            <button className="export-btn" onClick={() => setShowExportPanel(true)} aria-label="Export calendar">
              Export ↗
            </button>
          </div>
        </div>

        {displayChores.length === 0 ? (
          <p className="today-empty">
            {isShowingToday ? "No chores scheduled today. Enjoy your day!" : "No chores scheduled on this day."}
          </p>
        ) : displayAllDone ? (
          <>
            <div className="today-all-done">All done{isShowingToday ? " for today" : ""}! 🎉</div>
            <button className="mark-all-btn unmark" onClick={handleUnmarkAll}>Unmark all</button>
          </>
        ) : (
          <>
            <ul className="chore-list-detail today-chores">
              {displayChores.map((c) => (
                <ChoreRow
                  key={c.id}
                  chore={c}
                  done={!!completions[`${displayKey}:${c.id}`]}
                  onToggle={() => onToggleComplete(displayKey, c.id)}
                  note={schedules[c.id]?.notes}
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
            <button className="mark-all-btn" onClick={handleMarkAllDone}>✓ Mark all done</button>
          </>
        )}
      </div>

      {/* Monthly completion percentage summary */}
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
        <button className="nav-arrow" onClick={prevMonth} aria-label="Previous month">‹</button>
        <div className="month-title-block">
          <h2 className="month-title">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
          <span className="month-count">{totalThisMonth} chore{totalThisMonth !== 1 ? "s" : ""}</span>
        </div>
        <button className="nav-arrow" onClick={nextMonth} aria-label="Next month">›</button>
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
              aria-label={`${MONTH_NAMES[viewMonth]} ${day}${dayChores.length > 0 ? `, ${dayChores.length} chore${dayChores.length !== 1 ? "s" : ""}` : ""}`}
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
            <button
              className="btn-ghost full-width"
              onClick={() => { setShowExportPanel(false); setTimeout(() => window.print(), 150); }}
            >
              🖨️ Print schedule
            </button>
            <button className="btn-ghost full-width" onClick={() => setShowExportPanel(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Reminders modal */}
      {showReminderPanel && (
        <div className="modal-overlay" onClick={() => setShowReminderPanel(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔔 Morning Reminders</h3>
            {reminderEmail ? (
              <>
                <div className="reminder-active-block">
                  <div className="reminder-active-email">
                    <span className="reminder-check">✓</span>
                    <span>Reminders on for <strong>{reminderEmail}</strong></span>
                  </div>
                </div>
                <div className="reminder-time-section">
                  <label className="reminder-time-label">Send reminder at:</label>
                  <div className="reminder-time-grid">
                    {REMINDER_TIMES.map(({ label, hour }) => (
                      <button
                        key={hour}
                        className={`time-chip ${(reminderHour ?? 8) === hour ? "selected" : ""}`}
                        onClick={() => handleUpdateTime(hour)}
                        disabled={updateStatus === "saving"}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {updateStatus === "saved" && <p className="reminder-saved">✓ Saved</p>}
                  {updateStatus === "error" && <p className="custom-form-error">Failed to save. Try again.</p>}
                </div>
                <button className="btn-ghost full-width" style={{ color: "var(--red)" }} onClick={handleUnsubscribe}>
                  Turn off reminders
                </button>
              </>
            ) : (
              <form onSubmit={handleSubscribe}>
                <p className="reminder-description">Get an email on days you have chores scheduled.</p>
                <label className="reminder-field-label">Email</label>
                <input
                  type="email"
                  className="text-input"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
                <label className="reminder-field-label">Timezone</label>
                <select
                  className="text-input"
                  value={timezoneInput}
                  onChange={(e) => setTimezoneInput(e.target.value)}
                >
                  <optgroup label="North America">
                    <option value="America/New_York">Eastern (ET)</option>
                    <option value="America/Chicago">Central (CT)</option>
                    <option value="America/Denver">Mountain (MT)</option>
                    <option value="America/Los_Angeles">Pacific (PT)</option>
                    <option value="America/Anchorage">Alaska (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii (HST)</option>
                    <option value="America/Toronto">Toronto (ET)</option>
                    <option value="America/Vancouver">Vancouver (PT)</option>
                    <option value="America/Mexico_City">Mexico City (CT)</option>
                  </optgroup>
                  <optgroup label="Europe">
                    <option value="UTC">UTC</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Central European (CET)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                    <option value="Europe/Rome">Rome (CET)</option>
                    <option value="Europe/Helsinki">Eastern European (EET)</option>
                    <option value="Europe/Istanbul">Istanbul (TRT)</option>
                    <option value="Europe/Moscow">Moscow (MSK)</option>
                  </optgroup>
                  <optgroup label="Middle East &amp; Africa">
                    <option value="Asia/Dubai">Gulf (GST)</option>
                    <option value="Asia/Riyadh">Riyadh (AST)</option>
                    <option value="Africa/Cairo">Cairo (EET)</option>
                    <option value="Africa/Johannesburg">Johannesburg (SAST)</option>
                    <option value="Africa/Lagos">Lagos (WAT)</option>
                  </optgroup>
                  <optgroup label="Asia">
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Karachi">Pakistan (PKT)</option>
                    <option value="Asia/Dhaka">Dhaka (BST)</option>
                    <option value="Asia/Bangkok">Bangkok (ICT)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Asia/Shanghai">China (CST)</option>
                    <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                    <option value="Asia/Tokyo">Japan (JST)</option>
                    <option value="Asia/Seoul">Seoul (KST)</option>
                  </optgroup>
                  <optgroup label="Pacific &amp; Oceania">
                    <option value="Australia/Perth">Perth (AWST)</option>
                    <option value="Australia/Adelaide">Adelaide (ACST)</option>
                    <option value="Australia/Sydney">Sydney (AEST)</option>
                    <option value="Pacific/Auckland">New Zealand (NZST)</option>
                    <option value="Pacific/Fiji">Fiji (FJT)</option>
                  </optgroup>
                </select>
                <label className="reminder-field-label">Send at</label>
                <div className="reminder-time-grid">
                  {REMINDER_TIMES.map(({ label, hour }) => (
                    <button
                      type="button"
                      key={hour}
                      className={`time-chip ${hourInput === hour ? "selected" : ""}`}
                      onClick={() => setHourInput(hour)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  className="btn-primary full-width"
                  disabled={subscribeStatus === "loading"}
                  style={{ marginTop: 8 }}
                >
                  {subscribeStatus === "loading" ? "Saving..." : "Enable reminders"}
                </button>
                {subscribeStatus === "error" && (
                  <p className="custom-form-error">Something went wrong. Please try again.</p>
                )}
              </form>
            )}
            <button className="btn-ghost full-width" onClick={() => setShowReminderPanel(false)} style={{ marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {showStatsPanel && (
        <div className="modal-overlay" onClick={() => setShowStatsPanel(false)}>
          <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📊 Your Stats</h3>

            <div className="stats-section">
              <div className="stats-section-title">Last 6 Months</div>
              <div className="stats-bars">
                {monthlyStats.map((s) => (
                  <div key={s.label} className="stats-bar-item">
                    <div className="stats-bar-track">
                      <div
                        className="stats-bar-fill"
                        style={{ height: `${s.pct ?? 0}%` }}
                      />
                    </div>
                    <div className="stats-bar-label">{s.label}</div>
                    <div className="stats-bar-pct">{s.pct !== null ? `${s.pct}%` : "–"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="stats-section">
              <div className="stats-section-title">All-Time</div>
              <div className="stats-total-row">
                <span className="stats-total-num">{Object.keys(completions).length}</span>
                <span className="stats-total-label">chores completed</span>
              </div>
            </div>

            {chores.some((c) => calculateStreak(c, schedules[c.id], completions) > 0) && (
              <div className="stats-section">
                <div className="stats-section-title">Active Streaks</div>
                {chores
                  .map((c) => ({ chore: c, streak: calculateStreak(c, schedules[c.id], completions) }))
                  .filter(({ streak }) => streak > 0)
                  .sort((a, b) => b.streak - a.streak)
                  .map(({ chore, streak }) => (
                    <div key={chore.id} className="stats-chore-row">
                      <span>{chore.emoji} {chore.name}</span>
                      <span className="streak-badge">🔥 {streak} in a row</span>
                    </div>
                  ))}
              </div>
            )}

            <button className="btn-ghost full-width" onClick={() => setShowStatsPanel(false)}>Close</button>
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

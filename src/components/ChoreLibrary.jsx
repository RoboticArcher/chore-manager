import { useState, useRef, useEffect } from "react";
import { PRESET_CHORES } from "../data/presetChores";

// A curated set of home/chore relevant emojis for the picker
const CHORE_EMOJIS = [
  "📝", "🧹", "🧽", "🫧", "🪣", "🧴", "🪥", "🛁", "🚿", "🧻",
  "🧺", "👕", "👔", "🧦", "🪴", "💐", "🌿", "🌱", "🏡", "🌳",
  "🔧", "🪛", "🔨", "🗑️", "🛒", "🍳", "🫕", "🥘", "🍽️", "🥄",
  "🧊", "❄️", "💡", "🚪", "🛋️", "🛏️", "📦", "🪟", "🐕", "🐈",
  "🚗", "🏋️", "📅", "⏰", "✨", "⭐", "🌊", "🌻", "🧯", "🪠",
];

// Seasonal chore suggestions — static, grouped by season
const SEASONAL = {
  spring: {
    label: "🌱 Spring Suggestions",
    chores: [
      { id: "seasonal-gutters", name: "Clean Gutters", emoji: "🏡" },
      { id: "seasonal-windows", name: "Wash Windows", emoji: "🪟" },
      { id: "seasonal-fertilize", name: "Fertilize Lawn", emoji: "🌿" },
      { id: "seasonal-ac", name: "AC Service Check", emoji: "❄️" },
    ],
  },
  summer: {
    label: "☀️ Summer Suggestions",
    chores: [
      { id: "seasonal-mow", name: "Mow Lawn", emoji: "🌱" },
      { id: "seasonal-acfilter", name: "Replace AC Filter", emoji: "❄️" },
      { id: "seasonal-grill", name: "Clean Grill", emoji: "🍳" },
      { id: "seasonal-irrigation", name: "Check Irrigation", emoji: "🌊" },
    ],
  },
  fall: {
    label: "🍂 Fall Suggestions",
    chores: [
      { id: "seasonal-leaves", name: "Rake Leaves", emoji: "🌳" },
      { id: "seasonal-winterize", name: "Winterize Garden", emoji: "🌱" },
      { id: "seasonal-furnace", name: "Furnace Service", emoji: "🔧" },
      { id: "seasonal-dryer", name: "Clean Dryer Vent", emoji: "🧺" },
    ],
  },
  winter: {
    label: "❄️ Winter Suggestions",
    chores: [
      { id: "seasonal-deepclean", name: "Deep Clean Kitchen", emoji: "🧽" },
      { id: "seasonal-closets", name: "Declutter Closets", emoji: "📦" },
      { id: "seasonal-smoke", name: "Check Smoke Detectors", emoji: "🧯" },
      { id: "seasonal-pipes", name: "Insulate Pipes", emoji: "🔧" },
    ],
  },
};

function getSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

export default function ChoreLibrary({
  selectedChores,
  customChores,
  onToggleChore,
  onAddCustom,
  onDeleteCustom,
  onNext,
}) {
  const [customName, setCustomName] = useState("");
  const [customEmoji, setCustomEmoji] = useState("📝");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [customError, setCustomError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSeasonal, setShowSeasonal] = useState(true);
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    function onOutside(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showEmojiPicker]);

  // Collect all existing names for duplicate detection
  const allChoreNames = [
    ...PRESET_CHORES.flatMap((cat) => cat.chores.map((c) => c.name.toLowerCase())),
    ...customChores.map((c) => c.name.toLowerCase()),
  ];
  const trimmedName = customName.trim();
  const isDuplicate = trimmedName.length > 0 && allChoreNames.includes(trimmedName.toLowerCase());

  function handleAddCustom() {
    if (!trimmedName) {
      setCustomError("Please enter a chore name.");
      return;
    }
    if (isDuplicate) {
      setCustomError("A chore with this name already exists.");
      return;
    }
    setCustomError("");
    onAddCustom({ id: `custom-${Date.now()}`, name: trimmedName, emoji: customEmoji, custom: true });
    setCustomName("");
    setCustomEmoji("📝");
    setShowCustomForm(false);
  }

  const selectedIds = new Set(selectedChores.map((c) => c.id));
  const count = selectedChores.length;

  // Seasonal suggestion helpers
  const season = getSeason();
  const seasonal = SEASONAL[season];

  function handleSeasonalClick(sc) {
    if (selectedIds.has(sc.id)) {
      onToggleChore(sc); // deselect
    } else {
      onAddCustom({ ...sc, custom: true }); // add as custom + select
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Your Chores</h1>
        <p className="subtitle">Select everything you want to track, then we'll set schedules.</p>
      </div>

      {/* Seasonal suggestions banner */}
      {showSeasonal && activeCategory === null && (
        <div className="seasonal-banner">
          <div className="seasonal-header">
            <span className="seasonal-title">{seasonal.label}</span>
            <button
              className="seasonal-dismiss"
              onClick={() => setShowSeasonal(false)}
              aria-label="Dismiss seasonal suggestions"
            >
              ×
            </button>
          </div>
          <div className="seasonal-chips">
            {seasonal.chores.map((sc) => {
              const selected = selectedIds.has(sc.id);
              // Check if name already exists in preset list
              const inPreset = PRESET_CHORES.some((cat) =>
                cat.chores.some((c) => c.name.toLowerCase() === sc.name.toLowerCase())
              );
              return (
                <button
                  key={sc.id}
                  className={`seasonal-chip ${selected ? "selected" : ""}`}
                  onClick={() => !inPreset && handleSeasonalClick(sc)}
                  disabled={inPreset}
                  title={inPreset ? "Already in the list above" : undefined}
                >
                  {sc.emoji} {sc.name} {selected ? "✓" : "+"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="category-tabs">
        <button
          className={`tab-btn ${activeCategory === null ? "active" : ""}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {PRESET_CHORES.map((cat) => (
          <button
            key={cat.category}
            className={`tab-btn ${activeCategory === cat.category ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.category)}
          >
            {cat.emoji} {cat.category}
          </button>
        ))}
      </div>

      <div className="chore-grid-container">
        {PRESET_CHORES.filter(
          (cat) => activeCategory === null || cat.category === activeCategory
        ).map((cat) => (
          <div key={cat.category} className="category-section">
            {activeCategory === null && (
              <h3 className="category-label">
                {cat.emoji} {cat.category}
              </h3>
            )}
            <div className="chore-grid">
              {cat.chores.map((chore) => {
                const selected = selectedIds.has(chore.id);
                return (
                  <button
                    key={chore.id}
                    className={`chore-chip ${selected ? "selected" : ""}`}
                    onClick={() => onToggleChore(chore)}
                  >
                    <span className="chore-emoji">{chore.emoji}</span>
                    <span className="chore-name">{chore.name}</span>
                    {selected && <span className="check-mark">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom chores — shown in "All" view only */}
        {activeCategory === null && customChores.length > 0 && (
          <div className="category-section">
            <h3 className="category-label">✏️ Custom</h3>
            <div className="chore-grid">
              {customChores.map((chore) => {
                const selected = selectedIds.has(chore.id);
                return (
                  <div key={chore.id} className="custom-chip-wrap">
                    <button
                      className={`chore-chip ${selected ? "selected" : ""}`}
                      onClick={() => onToggleChore(chore)}
                    >
                      <span className="chore-emoji">{chore.emoji}</span>
                      <span className="chore-name">{chore.name}</span>
                      {selected && <span className="check-mark">✓</span>}
                    </button>
                    <button
                      className="delete-custom-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteCustom(chore.id); }}
                      title="Remove custom chore"
                      aria-label={`Remove ${chore.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Chore */}
      <div className="custom-chore-section">
        {!showCustomForm ? (
          <button className="add-custom-btn" onClick={() => { setShowCustomForm(true); setCustomError(""); }}>
            + Add a custom chore
          </button>
        ) : (
          <div className="custom-form">
            <h4>Add Custom Chore</h4>
            <div className="custom-form-row">
              <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                <button
                  type="button"
                  className="emoji-pick-btn"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  title="Choose an emoji"
                  aria-label="Choose emoji"
                >
                  {customEmoji}
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker-panel">
                    {CHORE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={`emoji-option ${customEmoji === emoji ? "selected" : ""}`}
                        onClick={() => { setCustomEmoji(emoji); setShowEmojiPicker(false); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                className={`text-input ${customError ? "input-error" : ""}`}
                value={customName}
                onChange={(e) => { setCustomName(e.target.value); setCustomError(""); }}
                placeholder="Chore name..."
                maxLength={40}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                autoFocus
              />
              <button
                className="btn-primary small"
                onClick={handleAddCustom}
                disabled={!trimmedName || isDuplicate}
              >
                Add
              </button>
              <button
                className="btn-ghost small"
                onClick={() => { setShowCustomForm(false); setCustomName(""); setCustomError(""); }}
              >
                Cancel
              </button>
            </div>

            {customError && <div className="custom-form-error">{customError}</div>}

            {!customError && isDuplicate && (
              <div className="custom-form-error">A chore with this name already exists.</div>
            )}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky-footer">
        <div className="footer-count">
          {count === 0 ? "No chores selected yet" : `${count} chore${count !== 1 ? "s" : ""} selected`}
        </div>
        <button className="btn-primary" onClick={onNext} disabled={count === 0}>
          Set Schedules →
        </button>
      </div>
    </div>
  );
}

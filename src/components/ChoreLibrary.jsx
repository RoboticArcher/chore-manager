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

  // Feature #4: Collect all existing names for duplicate detection
  const allChoreNames = [
    ...PRESET_CHORES.flatMap((cat) => cat.chores.map((c) => c.name.toLowerCase())),
    ...customChores.map((c) => c.name.toLowerCase()),
  ];
  const trimmedName = customName.trim();
  const isDuplicate = trimmedName.length > 0 && allChoreNames.includes(trimmedName.toLowerCase());

  function handleAddCustom() {
    // Bug #2: Validate empty input with inline message
    if (!trimmedName) {
      setCustomError("Please enter a chore name.");
      return;
    }
    // Feature #4: Block duplicate names
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

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Your Chores</h1>
        <p className="subtitle">Select everything you want to track, then we'll set schedules.</p>
      </div>

      {/* Feature #6: Category tabs — now flex-wrap so all labels visible on desktop */}
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

        {/* Bug #1: Custom chores persist even when deselected.
            Shown only in the "All" view to keep the category filter clean. */}
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
                    {/* Hover to reveal — explicitly deletes (not deselects) */}
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
              {/* Bug #3: Functional emoji picker */}
              <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                <button
                  type="button"
                  className="emoji-pick-btn"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  title="Choose an emoji"
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

            {/* Bug #2: Inline validation feedback */}
            {customError && <div className="custom-form-error">{customError}</div>}

            {/* Feature #4: Real-time duplicate warning while typing */}
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

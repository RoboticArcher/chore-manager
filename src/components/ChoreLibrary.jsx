import { useState } from "react";
import { PRESET_CHORES } from "../data/presetChores";

export default function ChoreLibrary({ selectedChores, onToggleChore, onAddCustom, onNext }) {
  const [customName, setCustomName] = useState("");
  const [customEmoji, setCustomEmoji] = useState("📝");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);

  function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    onAddCustom({ id: `custom-${Date.now()}`, name, emoji: customEmoji, custom: true });
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

        {/* Custom chores that have been added */}
        {selectedChores.filter((c) => c.custom).length > 0 && (
          <div className="category-section">
            <h3 className="category-label">✏️ Custom</h3>
            <div className="chore-grid">
              {selectedChores
                .filter((c) => c.custom)
                .map((chore) => (
                  <button
                    key={chore.id}
                    className="chore-chip selected"
                    onClick={() => onToggleChore(chore)}
                  >
                    <span className="chore-emoji">{chore.emoji}</span>
                    <span className="chore-name">{chore.name}</span>
                    <span className="check-mark">✓</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Chore */}
      <div className="custom-chore-section">
        {!showCustomForm ? (
          <button className="add-custom-btn" onClick={() => setShowCustomForm(true)}>
            + Add a custom chore
          </button>
        ) : (
          <div className="custom-form">
            <h4>Add Custom Chore</h4>
            <div className="custom-form-row">
              <input
                type="text"
                className="emoji-input"
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                maxLength={2}
                placeholder="📝"
              />
              <input
                type="text"
                className="text-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Chore name..."
                onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                autoFocus
              />
              <button className="btn-primary small" onClick={handleAddCustom}>
                Add
              </button>
              <button
                className="btn-ghost small"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomName("");
                }}
              >
                Cancel
              </button>
            </div>
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

import React from "react";

/**
 * Reusable list box for swimlane columns:
 * - title (e.g. "📂 Uploaded Files")
 * - items: array of filenames
 * - onView(type, filename)
 * - onDelete(type, filename)
 */
export default function FileSwimlane({
  title,
  items,
  type,
  emptyText,
  onView,
  onDelete,
}) {
  return (
    <div className="file-box">
      <h4>{title}</h4>

      {(!items || items.length === 0) ? (
        <p className="subtitle">{emptyText || "Nothing here yet."}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((f) => (
            <li key={f} className="file-row">
              <span className="file-name">{f}</span>
              <div className="file-actions">
                <button className="btn tiny" onClick={() => onView(type, f)}>
                  View
                </button>
                <button className="btn tiny danger" onClick={() => onDelete(type, f)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

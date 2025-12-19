import React from "react";

export default function ProjectTile({ name, onClick, disabled = false }) {
  return (
    <button className="tile" onClick={onClick} disabled={disabled}>
      <div className="tile-name">{name}</div>
    </button>
  );
}

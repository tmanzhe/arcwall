import Icon from "./Icon";
import { BACKGROUNDS } from "../src/backgrounds.js";
export default function BackgroundPicker({ value, onChange }) {
  return (
    <div className="background-gallery">
      {Object.entries(BACKGROUNDS).map(([id, b]) => (
        <button
          key={id}
          className={value === id ? "active" : ""}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
        >
          <span className={"background-thumbnail bg-" + id}>
            <Icon
              name={b.icon}
              size={id === "guardian" || id === "kinetic" ? 35 : 30}
            />
            <i />
            <i />
          </span>
          <span>
            <strong>{b.name}</strong>
            <small>{b.description}</small>
          </span>
          {value === id && <Icon name="check" size={12} />}
        </button>
      ))}
    </div>
  );
}

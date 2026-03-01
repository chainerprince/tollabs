/* Material Symbols icon wrapper */
interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

export default function Icon({ name, className = "", filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? "fill-1" : ""} ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

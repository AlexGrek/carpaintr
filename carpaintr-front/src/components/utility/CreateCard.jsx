import { Plus } from "lucide-react";
import React from "react";

/**
 * A "create new" card button that matches the CarCard styling.
 * No Tailwind, self-contained styles.
 */

const styles = {
  card: {
    width: 360,
    maxWidth: "100%",
    borderRadius: 16,
    border: "2px dashed rgba(0,0,0,0.12)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
    padding: 16,
    fontFamily:
      "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    background: "linear-gradient(180deg, #fafbfc, #f9fafb)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    userSelect: "none",
  },
  cardHover: {
    borderColor: "orange",
    boxShadow: "0 8px 24px rgba(99, 102, 241, 0.12)",
    background: "linear-gradient(180deg, #ffffff, #fafbfc)",
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    transition: "all 0.2s ease",
  },
  iconWrapperHover: {
    background: "orangered",
    transform: "scale(1.05)",
  },
  text: {
    fontSize: 16,
    fontWeight: 600,
    color: "black",
    margin: 0,
    transition: "color 0.2s ease",
  },
  textHover: {
    color: "orangered",
  },
};

export function CreateCard({ onClick, className, style, text = "Створити новий" }) {
  const [isHovered, setIsHovered] = React.useState(false);

  const cardStyle = {
    ...styles.card,
    ...(isHovered ? styles.cardHover : {}),
    ...style,
  };

  const iconStyle = {
    ...styles.iconWrapper,
    ...(isHovered ? styles.iconWrapperHover : {}),
  };

  const textStyle = {
    ...styles.text,
    ...(isHovered ? styles.textHover : {}),
  };

  return (
    <div
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={iconStyle}>
        <Plus size={32} color="orangered" strokeWidth={2.5} />
      </div>
      <p style={textStyle}>{text}</p>
    </div>
  );
}

export default CreateCard;
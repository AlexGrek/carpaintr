import { useState } from "react";
import { ArrowDownRight } from "lucide-react";

const MenuPickerV2 = ({
  items = [],
  label = "",
  onSelect,
  value = null,
  style = {},
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const isExpanded = value === null;

  const normalizedItems = items.map((item, index) => {
    if (typeof item === "string") {
      return { label: item, value: item };
    }
    return {
      label: item.label || `Item ${index + 1}`,
      details: item.details,
      value: item.value,
      icon: item.icon,
    };
  });

  const handleItemSelect = (item) => {
    if (isAnimating) return;

    setIsAnimating(true);

    if (onSelect) {
      onSelect(item.value);
    }

    // Reset animation state after CSS transition completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 400);
  };

  const handleSelectedItemClick = () => {
    if (isAnimating) return;

    if (onSelect) {
      onSelect(null);
    }
  };

  const styles = {
    container: {
      maxWidth: "400px",
      minWidth: "14em",
      margin: "4px auto",
      padding: "2px",
    },
    label: {
      fontSize: "14px",
      fontWeight: "600",
      color: "#333",
      marginBottom: "8px",
      letterSpacing: "0.5px",
    },
    menuWrapper: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      boxShadow:
        "0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)",
      border: "1px solid rgba(0, 0, 0, 0.06)",
      transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      height: isExpanded ? `${normalizedItems.length * 64}px` : "64px",
    },
    menuContainer: {
      position: "relative",
      height: "100%",
      backgroundColor: "#ffffff",
    },
    menuItem: {
      display: "flex",
      alignItems: "center",
      padding: "16px 20px",
      height: "64px",
      boxSizing: "border-box",
      cursor: "pointer",
      borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
      position: "absolute",
      left: 0,
      right: 0,
      backgroundColor: "#ffffff",
      transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      zIndex: 1,
    },
    menuItemContent: {
      flex: 1,
      display: "flex",
      backgroundColor: "#ffffff",
      flexDirection: "column",
      justifyContent: "center",
    },
    itemLabel: {
      fontSize: "16px",
      fontWeight: "500",
      padding: "0 3em",
      color: "#1c1c1e",
      lineHeight: "1.2",
      marginBottom: (item) => (item.details ? "2px" : "0"),
    },
    itemDetails: {
      fontSize: "12px",
      color: "#8e8e93",
      lineHeight: "1.3",
    },
    itemIcon: {
      fontSize: "20px",
      marginLeft: "12px",
    },
    checkmark: {
      position: "absolute",
      right: "16px",
      top: "24px",
      fontSize: "14px",
      color: "#e23b1a",
      fontWeight: "600",
    },
  };

  const getItemStyle = (item, index) => {
    const baseStyle = {
      ...styles.menuItem,
      top: `${index * 64}px`,
    };

    // If expanded or no selection, show normal positions
    if (isExpanded) {
      return baseStyle;
    }

    // If this is the selected item, move it to top
    if (value !== null && item.value === value) {
      return {
        ...baseStyle,
        top: "0px",
        zIndex: 10,
      };
    }

    // All other items fade out and stay in their positions initially
    // then slide down slightly as they disappear
    return {
      ...baseStyle,
      opacity: 0,
      transform: "translateY(10px) scale(0.98)",
      pointerEvents: "none",
    };
  };

  return (
    <div className="pop-in-simple" style={{ ...styles.container, ...style }}>
      {label && <div style={styles.label}>{label}</div>}
      <div style={styles.menuWrapper}>
        <div style={styles.menuContainer}>
          {normalizedItems.map((item, index) => (
            <div
              key={item.value}
              style={getItemStyle(item, index)}
              onClick={() => {
                if (!isExpanded) {
                  handleSelectedItemClick();
                } else {
                  handleItemSelect(item);
                }
              }}
              // onMouseEnter={(e) => {
              //   if (isExpanded && !isAnimating) {
              //     e.target.style.backgroundColor = '#f8f9fa';
              //   }
              // }}
              // onMouseLeave={(e) => {
              //   if (isExpanded && !isAnimating) {
              //     e.target.style.backgroundColor = '#ffffff';
              //   }
              // }}
            >
              <div style={styles.menuItemContent}>
                <div
                  style={{
                    ...styles.itemLabel,
                    marginBottom: item.details ? "2px" : "0",
                  }}
                >
                  {item.label}
                </div>
                {item.details && (
                  <div style={styles.itemDetails}>{item.details}</div>
                )}
              </div>
              {item.icon && <div style={styles.itemIcon}>{item.icon}</div>}
              {value === item.value && (
                <div style={styles.checkmark}>
                  <ArrowDownRight size={16} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuPickerV2;

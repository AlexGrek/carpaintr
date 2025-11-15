import React from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";

const normalizeItem = (item) => {
  if (typeof item === "string") {
    return { label: item, value: item };
  }
  if (item.label && !item.value) {
    return { ...item, value: item.label };
  }
  return item;
};

const MenuPicker = ({ label, items, value, onSelect }) => {
  const normalizedItems = items.map(normalizeItem);
  const selected = normalizedItems.find((it) => it.value === value) || null;
  const expanded = value === null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>{label}</div>
      <div style={styles.listContainer}>
        <AnimatePresence>
          {expanded
            ? normalizedItems.map((item) => (
                <motion.div
                  key={item.value}
                  style={{
                    ...styles.item,
                    ...(selected?.value === item.value
                      ? styles.selectedItem
                      : {}),
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => onSelect(item.value)}
                >
                  <div style={styles.itemRow}>
                    <div style={styles.labelArea}>
                      <span style={styles.itemLabel}>{item.label}</span>
                      {item.description && (
                        <span style={styles.itemDescription}>
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.icon && (
                      <div style={styles.iconArea}>{item.icon}</div>
                    )}
                  </div>
                </motion.div>
              ))
            : selected && (
                <motion.div
                  key={selected.value}
                  style={{ ...styles.item, ...styles.selectedItem }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => onSelect(null)}
                >
                  <div style={styles.itemRow}>
                    <div style={styles.labelArea}>
                      <span style={styles.itemLabel}>{selected.label}</span>
                      {selected.description && (
                        <span style={styles.itemDescription}>
                          {selected.description}
                        </span>
                      )}
                    </div>
                    {selected.icon && (
                      <div style={styles.iconArea}>{selected.icon}</div>
                    )}
                  </div>
                </motion.div>
              )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- PropTypes ---
MenuPicker.propTypes = {
  label: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string,
        description: PropTypes.string,
        icon: PropTypes.node,
      }),
    ]),
  ).isRequired,
  value: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: "#f8f8f8",
    borderRadius: "12px",
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
    padding: "8px 12px",
    width: "280px",
  },
  header: {
    fontSize: "12px",
    color: "#888",
    marginBottom: "6px",
    paddingLeft: "4px",
  },
  listContainer: {
    overflow: "hidden",
    cursor: "pointer",
  },
  item: {
    padding: "8px 10px",
    borderRadius: "8px",
    background: "linear-gradient(to bottom, #fff, #f1f1f1)",
    marginBottom: "4px",
    transition: "background 0.2s ease",
  },
  selectedItem: {
    background: "linear-gradient(to bottom, #e0f0ff, #d6eaff)",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelArea: {
    display: "flex",
    flexDirection: "column",
  },
  itemLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
  },
  itemDescription: {
    fontSize: "11px",
    color: "#777",
    marginTop: "2px",
  },
  iconArea: {
    marginLeft: "8px",
    opacity: 0.6,
  },
};

export default MenuPicker;

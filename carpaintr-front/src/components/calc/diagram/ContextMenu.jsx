import { useState, forwardRef } from "react";
import PropTypes from "prop-types";
import { useMediaQuery } from "react-responsive";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  X,
  Check,
} from "lucide-react";

const ContextMenu = forwardRef(({ position, items, title, selectedItems = [], onClose, onSelect }, ref) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  // Create set of selected item names for O(1) lookup
  const selectedNamesSet = new Set(selectedItems.map(item => item.name));

  // Separate ungrouped and grouped items
  const ungrouped = items.filter((item) => !item.group);
  const grouped = items.filter((item) => item.group);

  // Group items by group name
  const groups = grouped.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {});

  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const menuStyle = isMobile
    ? {}
    : {
        top: position.y,
        left: position.x,
      };

  return (
    <>
      {isMobile && <div className="context-menu-overlay" onClick={onClose} />}
      <div
        className={`context-menu ${isMobile ? "context-menu-mobile" : ""} fade-in-simple-fast`}
        style={menuStyle}
        ref={ref}
      >
        <div className="context-menu-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {title} <small className="opacity-30">({items.length})</small>
          </span>
          {isMobile && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <X size={20} />
            </button>
          )}
        </div>
        <ul className="context-menu-list">
          {/* Ungrouped items first */}
          {ungrouped.map((item, index) => {
            const isSelected = selectedNamesSet.has(item.name);
            return (
              <li
                key={`ungrouped-${index}`}
                className="context-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: isSelected ? "#dcfce7" : "transparent",
                  borderLeft: isSelected ? "3px solid #16a34a" : "3px solid transparent",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                }}
              >
                {isSelected ? (
                  <Check size={16} style={{ flexShrink: 0, color: "#16a34a" }} />
                ) : (
                  <FileText size={16} style={{ flexShrink: 0 }} />
                )}
                <span style={{ fontWeight: isSelected ? "600" : "normal" }}>{item.name}</span>
              </li>
            );
          })}

          {/* Grouped items */}
          {Object.entries(groups).map(([groupName, groupItems]) => (
            <li key={groupName} style={{ padding: 0 }}>
              <div
                className="context-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "600",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(groupName);
                }}
              >
                {expandedGroups[groupName] ? (
                  <>
                    <ChevronDown size={16} style={{ flexShrink: 0 }} />
                    <FolderOpen size={16} style={{ flexShrink: 0 }} />
                  </>
                ) : (
                  <>
                    <ChevronRight size={16} style={{ flexShrink: 0 }} />
                    <Folder size={16} style={{ flexShrink: 0 }} />
                  </>
                )}
                <span>{groupName}</span>
                <small style={{ opacity: 0.5, marginLeft: "auto" }}>
                  ({groupItems.length})
                </small>
              </div>
              {expandedGroups[groupName] && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {groupItems.map((item, index) => {
                    const isSelected = selectedNamesSet.has(item.name);
                    return (
                      <li
                        key={`${groupName}-${index}`}
                        className="context-menu-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          paddingLeft: "40px",
                          backgroundColor: isSelected ? "#dcfce7" : "transparent",
                          borderLeft: isSelected ? "3px solid #16a34a" : "3px solid transparent",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(item);
                        }}
                      >
                        {isSelected ? (
                          <Check size={14} style={{ flexShrink: 0, color: "#16a34a" }} />
                        ) : (
                          <FileText size={14} style={{ flexShrink: 0 }} />
                        )}
                        <span style={{ fontWeight: isSelected ? "600" : "normal" }}>{item.name}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
});

ContextMenu.displayName = "ContextMenu";

ContextMenu.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      group: PropTypes.string,
    }),
  ),
  title: PropTypes.string.isRequired,
  selectedItems: PropTypes.array,
  onClose: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
};

export default ContextMenu;

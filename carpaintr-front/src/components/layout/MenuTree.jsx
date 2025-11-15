import React, { useState } from "react";
import "./MenuTree.css";

const MenuTree = ({ items, value, onChange }) => {
  const [expandedItem, setExpandedItem] = useState(null);

  const handleItemClick = (item, index) => {
    if (item.subitems) {
      // Toggle expansion for items with subitems
      setExpandedItem(expandedItem === index ? null : index);
    } else if (item.value) {
      // Call onChange for items with value
      onChange(item.value);
    }
  };

  const handleSubitemClick = (subitem) => {
    if (subitem.value) {
      onChange(subitem.value);
    }
  };

  return (
    <div className="menu-tree">
      {items.map((item, index) => (
        <div key={index} className="menu-item-container">
          <div
            className={`menu-item ${item.subitems ? "has-subitems" : ""} ${
              value === item.value && value != null ? "selected" : ""
            }`}
            onClick={() => handleItemClick(item, index)}
          >
            <span className="menu-item-label">{item.label}</span>
            {item.subitems && (
              <span
                className={`menu-item-arrow ${expandedItem === index ? "expanded" : ""}`}
              >
                ▼
              </span>
            )}
          </div>

          {item.subitems && (
            <div
              className={`submenu ${expandedItem === index ? "expanded" : ""}`}
            >
              <div className="submenu-content">
                {item.subitems.map((subitem, subIndex) => (
                  <div
                    key={subIndex}
                    className={`submenu-item ${value === subitem.value ? "selected" : ""}`}
                    onClick={() => handleSubitemClick(subitem)}
                  >
                    <span className="submenu-item-label">{subitem.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MenuTree;

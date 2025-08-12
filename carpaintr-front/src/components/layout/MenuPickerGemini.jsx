import { CheckCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A modern, stateless, skeumorphic menu picker component.
 * @param {object} props - The component props.
 * @param {string} props.label - The main label displayed above the picker.
 * @param {Array<string|object>} props.items - The array of items. Can be strings or objects.
 * @param {any} props.value - The currently selected value. The picker is expanded if this is null/undefined.
 * @param {function(any): void} props.onSelect - Callback function when an item is selected or deselected.
 */
const MenuPickerGemini = ({ label, items = [], onSelect, value }) => {
  // --- State Derivation ---
  // The component's state (expanded/collapsed) is derived directly from the `value` prop.
  const isExpanded = value == null;

  // Normalize items to a consistent object structure for easier processing.
  const normalizedItems = useMemo(() => items.map(item =>
    typeof item === 'string' ? { label: item, value: item } : item
  ), [items]);

  // Find the index of the selected item based on the `value` prop.
  const selectedIndex = useMemo(() => {
    if (isExpanded) return null;
    return normalizedItems.findIndex(item => item.value === value);
  }, [value, isExpanded, normalizedItems]);

  // --- Dynamic Height Calculation ---
  const [itemHeight, setItemHeight] = useState(74); // A sensible default height.
  const itemRef = useRef(null); // Ref to measure the first item's rendered height.

  // Effect to measure and set the item height for smooth animations.
  useEffect(() => {
    if (itemRef.current) {
      // Add 1 for the border-bottom pixel to ensure perfect calculation
      const measuredHeight = itemRef.current.offsetHeight + 1;
      // Only set height if it's a valid measurement to avoid errors.
      if (measuredHeight > 1) {
        setItemHeight(measuredHeight);
      }
    }
  }, [normalizedItems]); // Rerun if the items change.

  // --- Event Handlers ---
  const handleItemClick = (itemValue) => {
    // Only allow selection when the menu is expanded.
    if (isExpanded && onSelect) {
      onSelect(itemValue);
    }
  };

  const handleToggleExpand = () => {
    // If collapsed, clicking the container should expand it by un-selecting the value.
    if (!isExpanded && onSelect) {
      onSelect(null);
    }
  };

  // --- Styles (memoized for performance) ---
  const styles = {
    mainContainer: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      maxWidth: '380px',
      margin: '40px auto',
      padding: '0 20px',
    },
    mainLabel: {
      fontSize: '15px',
      fontWeight: '600',
      color: 'rgba(0, 0, 0, 0.6)',
      paddingLeft: '16px',
      marginBottom: '8px',
    },
    pickerContainer: useMemo(() => ({
      borderRadius: '12px',
      backgroundColor: '#f0f0f0',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      height: isExpanded ? itemHeight * normalizedItems.length : itemHeight,
      cursor: isExpanded ? 'default' : 'pointer',
    }), [isExpanded, itemHeight, normalizedItems.length]),
    listWrapper: useMemo(() => ({
      transform: !isExpanded && selectedIndex !== null && selectedIndex !== -1
        ? `translateY(-${selectedIndex * itemHeight}px)`
        : 'translateY(0px)',
      transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    }), [isExpanded, selectedIndex, itemHeight]),
    item: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      backgroundColor: '#ffffff',
      userSelect: 'none',
      boxSizing: 'border-box',
      minHeight: '58px', // Ensure a minimum height
    },
    itemContent: { flexGrow: 1 },
    itemLabel: { fontSize: '17px', fontWeight: '500', color: '#000', lineHeight: '1.2' },
    itemDetails: { fontSize: '13px', color: 'rgba(0, 0, 0, 0.55)', marginTop: '2px' },
    iconWrapper: { display: 'flex', alignItems: 'center', marginLeft: '16px' },
  };

  const getItemStyle = (index) => {
    const style = { ...styles.item };
    if (isExpanded && index < normalizedItems.length - 1) {
      style.borderBottom = '1px solid #e5e5e5';
    }
    if (isExpanded) {
      style.cursor = 'pointer';
    }
    return style;
  };

  return (
    <div style={styles.mainContainer}>
      <p style={styles.mainLabel}>{label}</p>
      <div
        style={styles.pickerContainer}
        onClick={handleToggleExpand}
        role="button"
        tabIndex={isExpanded ? -1 : 0}
        aria-expanded={isExpanded}
      >
        <div style={styles.listWrapper}>
          {normalizedItems.map((item, index) => (
            <div
              key={item.value}
              ref={index === 0 ? itemRef : null}
              style={getItemStyle(index)}
              onClick={() => handleItemClick(item.value)}
              role="option"
              aria-selected={value === item.value}
            >
              <div style={styles.itemContent}>
                <div style={styles.itemLabel}>{item.label}</div>
                {item.details && <div style={styles.itemDetails}>{item.details}</div>}
              </div>
              <div style={styles.iconWrapper}>
                {item.icon}
                {!isExpanded && selectedIndex === index && <CheckCircle />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuPickerGemini;
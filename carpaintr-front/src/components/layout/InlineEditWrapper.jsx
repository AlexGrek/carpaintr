import { useState, useEffect, useRef } from "react";
import { InlineEdit } from "rsuite";
import PropTypes from "prop-types";

/**
 * InlineEditWrapper
 *
 * A wrapper for rsuite's InlineEdit that:
 * - Keeps local state while editing.
 * - Only calls `onChange` on blur or when saved.
 * - Syncs localValue with value prop when not actively editing.
 *
 * Props:
 * - value: any (initial value)
 * - onChange: function (called with final value on blur/save)
 * - other props are passed to InlineEdit
 */
export default function InlineEditWrapper({ value, onChange, ...props }) {
  const [localValue, setLocalValue] = useState(value);
  const isEditing = useRef(false);

  useEffect(() => {
    if (!isEditing.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleSave = () => {
    isEditing.current = false;
    if (onChange) onChange(localValue);
  };

  return (
    <InlineEdit
      {...props}
      value={localValue}
      onChange={(v) => {
        isEditing.current = true;
        setLocalValue(v);
      }}
      onSave={handleSave}
      stateOnBlur="save"
    />
  );
}

InlineEditWrapper.propTypes = {
  value: PropTypes.any,
  onChange: PropTypes.func,
};

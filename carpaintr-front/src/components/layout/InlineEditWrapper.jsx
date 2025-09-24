import { useState } from "react";
import { InlineEdit } from "rsuite";
import PropTypes from "prop-types";

/**
 * InlineEditWrapper
 *
 * A wrapper for rsuite's InlineEdit that:
 * - Keeps local state while editing.
 * - Only calls `onChange` on blur or when saved.
 *
 * Props:
 * - value: string (initial value)
 * - onChange: function (called with final value on blur/save)
 * - other props are passed to InlineEdit
 */
export default function InlineEditWrapper({ value, onChange, ...props }) {
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    if (onChange) onChange(localValue);
  };

  return (
    <InlineEdit
      {...props}
      value={localValue}
      onChange={setLocalValue}   // only update local state
      onSave={handleSave}        // commit value on save
      stateOnBlur="save"        // also commit on blur
    />
  );
}

InlineEditWrapper.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func,
};

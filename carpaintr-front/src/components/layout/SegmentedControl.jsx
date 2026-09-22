import PropTypes from "prop-types";
import "./SegmentedControl.css";

const SegmentedControl = ({ options, value, onChange, testId, ariaLabel }) => (
  <div className="segmented" role="group" aria-label={ariaLabel} data-testid={testId}>
    {options.map((option) => {
      const isActive = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          className="segmented-option"
          aria-pressed={isActive}
          onClick={() => {
            if (!isActive) onChange(option.value);
          }}
          data-testid={option.testId}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

SegmentedControl.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      testId: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  testId: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default SegmentedControl;

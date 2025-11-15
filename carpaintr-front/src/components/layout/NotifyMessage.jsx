import React, { useState, useEffect } from "react";
import { Message, Divider } from "rsuite";

const NotifyMessage = ({
  text,
  title,
  type = "info",
  duration = 3000,
  className = "fade-in-simple",
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentText, setCurrentText] = useState(null);

  // Parse text to determine type and clean content
  const parseTextAndType = (inputText) => {
    if (!inputText) return { parsedText: inputText, parsedType: type };

    const lowerText = inputText.toLowerCase();

    if (lowerText.startsWith("success")) {
      return {
        parsedText: inputText.substring(7).trim(), // Remove "success" and trim
        parsedType: "success",
      };
    }

    if (lowerText.startsWith("error")) {
      return {
        parsedText: inputText.substring(5).trim(), // Remove "error" and trim
        parsedType: "error",
      };
    }

    if (lowerText.startsWith("warning")) {
      return {
        parsedText: inputText.substring(7).trim(), // Remove "warning" and trim
        parsedType: "warning",
      };
    }

    return { parsedText: inputText, parsedType: type };
  };

  const { parsedText, parsedType } = parseTextAndType(text);

  useEffect(() => {
    // Show message when text changes and is not null/empty
    if (parsedText && parsedText !== currentText) {
      setCurrentText(parsedText);
      setIsVisible(true);

      // Hide message after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    }

    // Hide message if text becomes null/empty
    if (!parsedText) {
      setIsVisible(false);
      setCurrentText(null);
    }
  }, [parsedText, currentText, duration]);

  // Return null if not visible or no text
  if (!isVisible || !currentText) {
    return null;
  }

  return (
    <Message
      className={className}
      showIcon
      full
      closable
      type={parsedType}
      title={title}
    >
      {currentText}
      {children && (
        <>
          <Divider />
          {children}
        </>
      )}
    </Message>
  );
};

export default NotifyMessage;

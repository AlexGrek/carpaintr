import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Fixed-position popup used for the cell context menu and the column
 * AutoFilter menu. Clamps itself to the viewport (the old context menu could
 * render off-screen near the right/bottom edge) and closes on an outside
 * mousedown, Escape, or the underlying grid scrolling under it.
 */
const FloatingMenu = ({ x, y, onClose, className = "", testId, children }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 4;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    setPos({ left, top, ready: true });
    // Re-clamp only when the requested anchor changes.
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target))
        onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onScroll = (e) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target))
        return;
      onClose();
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`floating-menu ${className}`}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        visibility: pos.ready ? "visible" : "hidden",
      }}
      data-testid={testId}
    >
      {children}
    </div>
  );
};

export default FloatingMenu;

import { useRef } from "react";
import "./BottomStickyLayout.css";
import { useMediaQuery } from "react-responsive";

export default function BottomStickyLayout({ children, bottomPanel }) {
  const containerRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <div className="layout-container fade-in-simple" ref={containerRef}>
      <div className={`layout-content ${isMobile ? "vscroll" : ""}`}>
        {children}
      </div>

      <div
        className={`layout-bottom-panel ${isMobile ? "sticky" : "attached"}`}
      >
        {bottomPanel}
      </div>
    </div>
  );
}

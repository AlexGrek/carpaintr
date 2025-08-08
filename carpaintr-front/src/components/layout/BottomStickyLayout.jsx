import React, { useEffect, useRef, useState } from 'react';
import './BottomStickyLayout.css';

export default function BottomStickyLayout({ children, bottomPanel }) {
    const containerRef = useRef(null);
    const [isSticky, setIsSticky] = useState(false);

    const checkSticky = () => {
        const container = containerRef.current;
        if (!container) return;

        const fits = container.scrollHeight <= window.innerHeight;
        setIsSticky(!fits);
    };

    useEffect(() => {
        checkSticky();
        window.addEventListener('resize', checkSticky);
        return () => window.removeEventListener('resize', checkSticky);
    }, []);

    useEffect(() => {
        // Recheck on content changes
        const observer = new MutationObserver(checkSticky);
        if (containerRef.current) {
            observer.observe(containerRef.current, { childList: true, subtree: true });
        }
        return () => observer.disconnect();
    }, []);

    return (
        <div className="layout-container fade-in-simple" ref={containerRef}>
            <div className={`layout-content ${isSticky ? 'vscroll' : ''}`}>{children}</div>

            <div className={`layout-bottom-panel ${isSticky ? 'sticky' : 'attached'}`}>
                {bottomPanel}
            </div>
        </div>
    );
}

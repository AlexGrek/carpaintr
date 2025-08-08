/* eslint-disable react/display-name */
import React, { useEffect, useState } from "react";
import { authFetchYaml } from "../../utils/authFetch";
import { Placeholder } from "rsuite";

const ColorGrid = React.lazy(() => import('../ColorGrid')); // Used by ColorPicker

// Memoized ColorPicker to prevent unnecessary re-renders
const ColorPicker = React.memo(({ setColor, selectedColor }) => {
    const [baseColors, setBaseColors] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                let data = await authFetchYaml('/api/v1/user/global/colors.json');
                setBaseColors(data);
            } catch (error) {
                console.error("Failed to fetch colors:", error);
            }
        };
        fetchData();
    }, []); // Empty dependency array means this runs once on mount

    if (baseColors == null || baseColors.rows === undefined) {
        return <Placeholder.Paragraph rows={3} />; // Show a placeholder while loading
    }

    const displayColors = baseColors.rows;

    return (
        <div className="vscroll">
            {displayColors.map((subgrid, index) => (
                // Add a unique key for list rendering
                <React.Suspense key={index} fallback={<Placeholder.Paragraph rows={6} />}>
                    <ColorGrid colors={subgrid} selectedColor={selectedColor} onChange={setColor} />
                </React.Suspense>
            ))}
        </div>
    );
});

export default ColorPicker;

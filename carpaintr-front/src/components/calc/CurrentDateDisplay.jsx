/* eslint-disable react/display-name */
import React, { useEffect, useState } from "react";
import { DatePicker } from "rsuite";
import { useLocale } from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import Trans from "../../localization/Trans";



// Memoized CurrentDateDisplay to prevent unnecessary re-renders
const CurrentDateDisplay = React.memo(() => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [season, setSeason] = useState(null);
    const [seasonDetails, setSeasonDetails] = useState(null);
    const { str } = useLocale();

    useEffect(() => {
        authFetch('/api/v1/user/season')
            .then(response => response.json())
            .then((data) => {
                setCurrentDate(new Date());
                setSeason(data.season_name === "summer" ? str("Літо") : str("Зима"));
                setSeasonDetails(JSON.stringify(data));
            })
            .catch(console.error);
    }, []);

    return (
        <div>
            <DatePicker value={currentDate} disabled />
            <p><Trans>Calculated season</Trans>: {season}</p>
            <p><code>{JSON.stringify(seasonDetails)}</code></p>
        </div>
    );
});

export default CurrentDateDisplay;

import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Loader, Stack } from 'rsuite';
import { SelectPicker } from "rsuite";
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import Trans from '../../localization/Trans';

registerTranslations("ua", {
    "App language": "Мова програми",
    "Output language": "Мова документів"
})

const LanguageMenu = () => {
    const { currentLang, setLang } = useLocale();
    const handleSetLang = (lang) => {
        if (lang) {
            setLang(lang)
        }
    }
    const data = [{
        label: '🇬🇧 English', value: 'en'
    },
    {
        label: '🇺🇦 Українська', value: 'ua'
    }]
    return <div>
            <span><Trans>App language</Trans></span>
            <SelectPicker data={data} appearance="subtle" style={{ margin: "0 2pt" }} cleanable={false} searchable={false} onChange={handleSetLang} value={currentLang} />
            <br/>
            <span><Trans>Output language</Trans></span>
            <SelectPicker disabled data={data} appearance="subtle" style={{ margin: "0 2pt" }} cleanable={false} searchable={false} onChange={handleSetLang} value={currentLang} />
            <br/>
        </div>
}

export default LanguageMenu;
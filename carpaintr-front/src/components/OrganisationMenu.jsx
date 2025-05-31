import React, { useEffect, useState, useCallback } from 'react';
import { useLocale, registerTranslations } from '../localization/LocaleContext';
import { getCompanyInfo, fetchCompanyInfo, authFetch } from '../utils/authFetch';
import { Button, Divider, Input, Text } from 'rsuite';
import Trans from '../localization/Trans';

registerTranslations("ua",
    {
        "Company name": "Назва компанії",
        "Save changes": "Зберегти зміни"
    }
);

const OrganisationMenu = () => {
    const [company, setCompany] = useState(null);
    const [message, setMessage] = useState(null);
    const { str, setLang } = useLocale();

    const save = useCallback(async (value) => {
        const pushAsync = async () => {
            const data = await authFetch("/api/v1/updatecompanyinfo", {
                method: 'POST',
                body: JSON.stringify(value),
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const newData = await fetchCompanyInfo();
            setCompany(newData);
            if (data.lang_ui) {
                setLang(data.lang_ui)
            }
        }

        await pushAsync();
    }, [])

    const handleSave = useCallback(async () => await save(company), [company])

    useEffect(() => {
        const reportError = (err) => {
            console.error(err);
            setMessage({ "type": "error", "title": str("Failed to get company info"), "message": `${err}` });
            setTimeout(() => setMessage(null), 3000);
        }

        const fetchAsync = async () => {
            const data = await fetchCompanyInfo(reportError);
            if (data) {
                setCompany(data);
                if (data.lang_ui) {
                    setLang(data.lang_ui)
                }
            }
        }

        fetchAsync();
    }, [str, setLang])

    return <div>
        <Text><Trans>Company name</Trans></Text>
        {company &&
            <Input value={company.company_name} onChange={(value) => setCompany({ ...company, company_name: value })}></Input>
        }
        <Divider></Divider>
        <Button appearance='primary' onClick={handleSave} disabled={company == null}><Trans>Save changes</Trans></Button>
    </div>
}

export default OrganisationMenu;
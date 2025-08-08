import { useEffect, useState, useCallback } from 'react';
import { useLocale, registerTranslations } from '../localization/LocaleContext';
import { fetchCompanyInfo, authFetch } from '../utils/authFetch';
import { Button, Divider, Input, Text, Message } from 'rsuite';
import Trans from '../localization/Trans';
import MoneyEditor from './MoneyEditor';

registerTranslations("ua",
    {
        "Company name": "Назва компанії",
        "Company address": "Адреса компанії",
        "Save changes": "Зберегти зміни",
        "Norm price": "Ціна нормогодини",
        "Preferred currency": "Валюта"
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
    }, [setLang])

    const handleSave = useCallback(async () => await save(company), [company, save])

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
        {message && <Message type={message.type} header={message.title}>{message.message}</Message>}
        <Text><Trans>Company name</Trans></Text>
        {company &&
            <Input value={company.company_name} onChange={(value) => setCompany({ ...company, company_name: value })}></Input>
        }
        <Text><Trans>Company address</Trans></Text>
        {company &&
            <Input value={company.company_addr} onChange={(value) => setCompany({ ...company, company_addr: value })}></Input>
        }
        <Divider></Divider>
        <Text><Trans>Preferred currency</Trans></Text>
        {company &&
            <Input value={company.pricing_preferences.preferred_currency} onChange={(value) => setCompany({ ...company, pricing_preferences: { ...company.pricing_preferences, preferred_currency: value } })}></Input>
        }
        <Text><Trans>Norm price</Trans></Text>
        {company &&
            <MoneyEditor
                preferredCurrency={company.pricing_preferences.preferred_currency}
                value={company.pricing_preferences.norm_price}
                onChange={(value) => setCompany({ ...company, pricing_preferences: { ...company.pricing_preferences, norm_price: value } })} />
        }
        <Divider></Divider>
        <Button appearance='primary' onClick={handleSave} disabled={company == null}><Trans>Save changes</Trans></Button>
    </div>
}

export default OrganisationMenu;
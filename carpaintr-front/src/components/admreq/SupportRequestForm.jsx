import React, { useEffect, useState } from 'react';
import { Input, Button, TagPicker } from 'rsuite';
import { authFetch } from '../../utils/authFetch';
import AppVersionBadge from '../AppVersionBadge';
import { registerTranslations, useLocale } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';

registerTranslations("ua", {
    "Short summary of the issue": "Узагальнений опис запиту",
    "bug": "Баг",
    "issue": "Проблема",
    "question": "Запитання",
    "error": "Помилка",
    "request": "Запит",
    "proposal": "Пропозиція",
    "Detailed description": "Детальний опис",
    "Choose request type": "Виберіть тип запиту",
    "Submit a Support Request": "Надіслати запит до підтримки",
    "Title": "Тема",
    "Contacts": "Контакти",
    "Submit": "Надіслати",
    "Phone number, viber, telegram, email, etc.": "Телефон, вайбер, електронна пошта...",
    "Support request submitted successfully.": "Запит надіслано"
});

const SupportRequestForm = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [reqType, setReqType] = useState('');
    const [contacts, setContacts] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const { str } = useLocale();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const msg = params.get('msg');
        if (msg) setTitle(decodeURIComponent(msg));
    }, []);

    const handleSubmit = async () => {
        setSubmitting(true);
        const contactMap = {};
        contacts.split(',').forEach(entry => {
            const [k, v] = entry.split('=');
            if (k && v) contactMap[k.trim()] = v.trim();
        });

        const payload = {
            title,
            description,
            reqType,
            contacts: contactMap,
        };

        const res = await authFetch('/api/v1/user/support_request_submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        setSubmitting(false);
        if (res.ok) {
            setSubmitted(true);
            setTitle('');
            setDescription('');
            setReqType('');
            setContacts('');
        } else {
            alert(str('Submission failed.'));
        }
    };

    const types = ["bug", "issue", "question", "error", "request", "proposal"].map(
        item => ({ label: str(item), value: item })
    );

    return (
        <>
            <h2><Trans>Submit a Support Request</Trans></h2>
            <div style={{ maxWidth: '600px', margin: '30px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>

                <label><Trans>Title</Trans></label>
                <Input value={title} onChange={setTitle} placeholder={str("Short summary of the issue")} />

                <label style={{ marginTop: '15px' }}><Trans>Description</Trans></label>
                <Input
                    as="textarea"
                    rows={4}
                    value={description}
                    onChange={setDescription}
                    placeholder={str("Detailed description")}
                />

                <label style={{ marginTop: '15px' }}><Trans>Type</Trans></label>
                <TagPicker block value={reqType.split(" ")} data={types} onChange={(val) => setReqType(val.join(" "))} placeholder={str("Choose request type")}></TagPicker>


                <label style={{ marginTop: '15px' }}><Trans>Contacts</Trans></label>
                <Input
                    value={contacts}
                    onChange={setContacts}
                    placeholder={str("Phone number, viber, telegram, email, etc.")}
                />

                <AppVersionBadge />

                {(submitted != true) && <div style={{ marginTop: '20px' }}>
                    <Button appearance="primary" onClick={handleSubmit} loading={submitting} disabled={reqType == '' || title == '' || description.length < 2}>
                        <Trans>Submit</Trans>
                    </Button>
                </div>}

                {submitted && (
                    <p style={{ marginTop: '15px', color: 'green' }}><Trans>Support request submitted successfully.</Trans></p>
                )}
            </div>
        </>
    );
}

export default SupportRequestForm;
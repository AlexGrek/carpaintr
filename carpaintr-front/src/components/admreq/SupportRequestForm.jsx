import React, { useEffect, useState } from 'react';
import { Input, Button } from 'rsuite';
import { authFetch } from '../../utils/authFetch';

const SupportRequestForm = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [reqType, setReqType] = useState('');
    const [contacts, setContacts] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

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
            alert('Submission failed.');
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '30px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Submit a Support Request</h2>

            <label>Title</label>
            <Input value={title} onChange={setTitle} placeholder="Short summary of the issue" />

            <label style={{ marginTop: '15px' }}>Description</label>
            <Input
                as="textarea"
                rows={4}
                value={description}
                onChange={setDescription}
                placeholder="Detailed description of the problem"
            />

            <label style={{ marginTop: '15px' }}>Type</label>
            <Input value={reqType} onChange={setReqType} placeholder="e.g. bug, login, billing" />

            <label style={{ marginTop: '15px' }}>Contacts (key=value, comma-separated)</label>
            <Input
                value={contacts}
                onChange={setContacts}
                placeholder="e.g. telegram=@user, phone=+12345678"
            />

            {(submitted != true) && <div style={{ marginTop: '20px' }}>
                <Button appearance="primary" onClick={handleSubmit} loading={submitting}>
                    Submit
                </Button>
            </div>}

            {submitted && (
                <p style={{ marginTop: '15px', color: 'green' }}>Support request submitted successfully.</p>
            )}
        </div>
    );
}

export default SupportRequestForm;
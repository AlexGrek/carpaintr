// CommitHistoryDrawer.jsx
import React, { useState, useEffect } from 'react';
import { Drawer, Button, List, Placeholder, Modal, Message } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import { authFetch } from '../../utils/authFetch';
import { useLocale, registerTranslations } from '../../localization/LocaleContext'; // Import for translations
import Trans from '../../localization/Trans'; // Import for translations

// Register translations for CommitHistoryDrawer
registerTranslations("ua", {
  "Commit History": "Історія змін",
  "Cancel": "Скасувати",
  "Failed to load commit history.": "Не вдалося завантажити історію змін.",
  "No commits found.": "Змін не знайдено.",
  "Hash:": "Хеш:",
  "Author:": "Автор:",
  "Message:": "Повідомлення:",
  "Files:": "Файли:",
  "Revert": "Скасувати зміну",
  "Confirm Revert": "Підтвердити скасування",
  "Are you sure you want to revert commit": "Ви впевнені, що хочете скасувати зміну",
  "This action cannot be undone.": "Цю дію неможливо скасувати.",
  "Confirm": "Підтвердити",
  "Error": "Помилка",
  "Success": "Успіх",
  "reverted successfully!": "успішно скасовано!",
  "Error reverting commit": "Помилка скасування комміту"
});

const CommitHistoryDrawer = ({ show, onClose, onRevert }) => {
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);
    const [selectedCommitHash, setSelectedCommitHash] = useState('');
    const [msg, setMsg] = useState(null);

    const isMobile = useMediaQuery({ maxWidth: 767 });
    const { str } = useLocale(); // Destructure str from useLocale

    useEffect(() => {
        if (show) {
            setMsg(null);
            fetchCommits();
        }
    }, [show]);

    const fetchCommits = async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/v1/editor/list_commits');
            const data = await response.json();
            setCommits(data);
        } catch (error) {
            console.error('Error fetching commits:', error);
            setMsg(
                <Message type="error" closable>
                    {str("Failed to load commit history.")}
                </Message>,
                { placement: 'topEnd' }
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRevertClick = (hash) => {
        setSelectedCommitHash(hash);
        setShowRevertConfirm(true);
    };

    const handleRevertConfirm = async () => {
        setShowRevertConfirm(false);
        try {
            const response = await authFetch('/api/v1/editor/revert_commit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ commit_hash: selectedCommitHash }),
            });

            if (response.ok) {
                setMsg(
                    <Message type="success" closable>
                        <Trans>Commit</Trans> {selectedCommitHash.substring(0, 7)} <Trans>reverted successfully!</Trans>
                    </Message>,
                    { placement: 'topEnd' }
                );
                fetchCommits();
                onRevert && onRevert();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || str('Failed to revert commit.'));
            }
        } catch (error) {
            console.error('Error reverting commit:', error);
            setMsg(
                <Message type="error" closable>
                    {str("Error reverting commit")} {selectedCommitHash.substring(0, 7)}: {error.message}
                </Message>,
                { placement: 'topEnd' }
            );
        } finally {
            setSelectedCommitHash('');
        }
    };

    return (
        <div>
            <Drawer placement={'right'} size={isMobile ? 'full' : 'sm'} open={show} onClose={() => onClose()}>
                <Drawer.Header>
                    <Drawer.Title><Trans>Commit History</Trans></Drawer.Title>
                    <Drawer.Actions>
                        <Button onClick={onClose}><Trans>Cancel</Trans></Button>
                    </Drawer.Actions>
                </Drawer.Header>
                <Drawer.Body>
                    {msg}
                    {loading ? (
                        <Placeholder.Paragraph active rows={8} />
                    ) : (
                        <List hover>
                            {commits.length === 0 && !loading ? (
                                <List.Item><Trans>No commits found.</Trans></List.Item>
                            ) : (
                                commits.map((commit) => (
                                    <List.Item key={commit.hash} style={{paddingLeft: "3em"}}>
                                        <p>
                                            <strong><Trans>Hash:</Trans></strong> {commit.hash.substring(0, 7)}
                                        </p>
                                        <p>
                                            <strong><Trans>Author:</Trans></strong> {commit.author}
                                        </p>
                                        <p>
                                            <strong><Trans>Message:</Trans></strong> {commit.message}
                                        </p>
                                        {commit.files && commit.files.length > 0 && (
                                            <p>
                                                <strong><Trans>Files:</Trans></strong> {commit.files.join(', ')}
                                            </p>
                                        )}
                                        <Button
                                            appearance="subtle"
                                            color="red"
                                            onClick={() => handleRevertClick(commit.hash)}
                                            style={{ marginTop: 10 }}
                                        >
                                            <Trans>Revert</Trans>
                                        </Button>
                                    </List.Item>
                                ))
                            )}
                        </List>
                    )}
                </Drawer.Body>
            </Drawer>
            <Drawer
                onClose={onClose}
            >
                <Drawer.Header>
                    <Drawer.Title><Trans>Commit History</Trans></Drawer.Title>
                </Drawer.Header>
                <Drawer.Body>
                    {msg}
                    {loading ? (
                        <Placeholder.Paragraph active rows={8} />
                    ) : (
                        <List hover>
                            {commits.length === 0 && !loading ? (
                                <List.Item><Trans>No commits found.</Trans></List.Item>
                            ) : (
                                commits.map((commit) => (
                                    <List.Item key={commit.hash}>
                                        <p>
                                            <strong><Trans>Hash:</Trans></strong> {commit.hash.substring(0, 7)}
                                        </p>
                                        <p>
                                            <strong><Trans>Author:</Trans></strong> {commit.author}
                                        </p>
                                        <p>
                                            <strong><Trans>Message:</Trans></strong> {commit.message}
                                        </p>
                                        {commit.files && commit.files.length > 0 && (
                                            <p>
                                                <strong><Trans>Files:</Trans></strong> {commit.files.join(', ')}
                                            </p>
                                        )}
                                        <Button
                                            appearance="subtle"
                                            color="red"
                                            onClick={() => handleRevertClick(commit.hash)}
                                            style={{ marginTop: 10 }}
                                        >
                                            <Trans>Revert</Trans>
                                        </Button>
                                    </List.Item>
                                ))
                            )}
                        </List>
                    )}
                </Drawer.Body>
            </Drawer>

            <Modal open={showRevertConfirm} onClose={() => setShowRevertConfirm(false)} size="xs">
                <Modal.Header>
                    <Modal.Title><Trans>Confirm Revert</Trans></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Trans>Are you sure you want to revert commit</Trans>{' '}
                    <strong>{selectedCommitHash.substring(0, 7)}</strong>? <Trans>This action cannot be undone.</Trans>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleRevertConfirm} appearance="primary" color="red">
                        <Trans>Confirm</Trans>
                    </Button>
                    <Button onClick={() => setShowRevertConfirm(false)} appearance="subtle">
                        <Trans>Cancel</Trans>
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default CommitHistoryDrawer;
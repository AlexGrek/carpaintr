import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Drawer, Divider, Button } from 'rsuite';
import { useMediaQuery } from 'react-responsive';
import { useLocale } from '../../localization/LocaleContext';
import MenuPickerV2 from '../layout/MenuPickerV2';

/**
 * Part details drawer that manages its own state and only updates parent on close
 */
const PartDetailsDrawer = ({ open, partDetails, onClose }) => {
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const { str } = useLocale();

    // Internal state - only synced to parent on close
    const [localPartDetails, setLocalPartDetails] = useState(null);

    // Sync initial part details when drawer opens
    useEffect(() => {
        if (open && partDetails) {
            setLocalPartDetails({ ...partDetails });
        }
    }, [open, partDetails]);

    const handleSelectAction = (action) => {
        setLocalPartDetails(prev => ({
            ...prev,
            selectedAction: action
        }));
    };

    const handleClose = () => {
        // Update parent with modified state only when closing
        if (localPartDetails) {
            onClose(localPartDetails);
        } else {
            onClose(null);
        }
    };

    return (
        <Drawer
            open={open}
            onClose={handleClose}
            size={isMobile ? 'full' : 'sm'}
        >
            <Drawer.Header>
                <Drawer.Title>{localPartDetails?.name || str("Part Details")}</Drawer.Title>
                <Drawer.Actions>
                    <Button
                        onClick={handleClose}
                        appearance="subtle"
                    >
                        {str("Close")}
                    </Button>
                </Drawer.Actions>
            </Drawer.Header>
            <Drawer.Body>
                {localPartDetails ? (
                    <div style={{ padding: '10px' }}>
                        <div style={{ marginBottom: '15px' }}>
                            <strong>{str("Zone")}:</strong> {localPartDetails.zone || '-'}
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <strong>{str("Group")}:</strong> {localPartDetails.group || '-'}
                        </div>

                        {/* Action Selection */}
                        {localPartDetails.actions && localPartDetails.actions.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <Divider />
                                <MenuPickerV2
                                    label={str("Actions")}
                                    items={localPartDetails.actions.map(action => ({
                                        label: str(action),
                                        value: action
                                    }))}
                                    value={localPartDetails.selectedAction}
                                    onSelect={handleSelectAction}
                                    style={{ maxWidth: '100%' }}
                                />
                            </div>
                        )}

                        {/* Action-specific tabs/content */}
                        {localPartDetails.selectedAction && (
                            <div style={{ marginTop: '20px' }}>
                                <Divider />
                                <h5 style={{ marginBottom: '10px' }}>
                                    {str(localPartDetails.selectedAction)} - {str("Details")}
                                </h5>
                                <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <p style={{ fontSize: '13px', color: '#666' }}>
                                        {str("Content for action will appear here").replace("{action}", str(localPartDetails.selectedAction))}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Show all available properties */}
                        {Object.keys(localPartDetails).length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <Divider />
                                <details>
                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
                                        {str("Raw Data")}
                                    </summary>
                                    <pre style={{
                                        background: '#f5f5f5',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontFamily: 'monospace',
                                        overflow: 'auto',
                                        maxHeight: '400px'
                                    }}>
                                        {JSON.stringify(localPartDetails, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                        {str("No additional information available")}
                    </div>
                )}
            </Drawer.Body>
        </Drawer>
    );
};

PartDetailsDrawer.propTypes = {
    open: PropTypes.bool.isRequired,
    partDetails: PropTypes.shape({
        name: PropTypes.string,
        zone: PropTypes.string,
        group: PropTypes.string,
        actions: PropTypes.arrayOf(PropTypes.string),
        selectedAction: PropTypes.string
    }),
    onClose: PropTypes.func.isRequired
};

PartDetailsDrawer.defaultProps = {
    partDetails: null
};

export default PartDetailsDrawer;

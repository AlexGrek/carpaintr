import { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronRight, ChevronDown, FileText, FolderOpen, Folder } from 'lucide-react';

const ContextMenu = ({ position, items, title, onClose }, ref) => {

    // Separate ungrouped and grouped items
    const ungrouped = items.filter(item => !item.group);
    const grouped = items.filter(item => item.group);

    // Group items by group name
    const groups = grouped.reduce((acc, item) => {
        if (!acc[item.group]) {
            acc[item.group] = [];
        }
        acc[item.group].push(item);
        return acc;
    }, {});

    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    const menuStyle = {
        top: position.y,
        left: position.x,
    };

    return (
        <div className="context-menu fade-in-simple-fast" style={menuStyle} ref={ref}>
            <div className="context-menu-header">{title} <small className="opacity-30">({items.length})</small></div>
            <ul className="context-menu-list">
                {/* Ungrouped items first */}
                {ungrouped.map((item, index) => (
                    <li
                        key={`ungrouped-${index}`}
                        className="context-menu-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => alert(`Selected: ${item.name}`)}
                    >
                        <FileText size={16} style={{ flexShrink: 0 }} />
                        <span>{item.name}</span>
                    </li>
                ))}

                {/* Grouped items */}
                {Object.entries(groups).map(([groupName, groupItems]) => (
                    <li key={groupName} style={{ padding: 0 }}>
                        <div
                            className="context-menu-item"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '600'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup(groupName);
                            }}
                        >
                            {expandedGroups[groupName] ? (
                                <>
                                    <ChevronDown size={16} style={{ flexShrink: 0 }} />
                                    <FolderOpen size={16} style={{ flexShrink: 0 }} />
                                </>
                            ) : (
                                <>
                                    <ChevronRight size={16} style={{ flexShrink: 0 }} />
                                    <Folder size={16} style={{ flexShrink: 0 }} />
                                </>
                            )}
                            <span>{groupName}</span>
                            <small style={{ opacity: 0.5, marginLeft: 'auto' }}>({groupItems.length})</small>
                        </div>
                        {expandedGroups[groupName] && (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {groupItems.map((item, index) => (
                                    <li
                                        key={`${groupName}-${index}`}
                                        className="context-menu-item"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            paddingLeft: '40px'
                                        }}
                                        onClick={() => alert(`Selected: ${item.name}`)}
                                    >
                                        <FileText size={14} style={{ flexShrink: 0 }} />
                                        <span>{item.name}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

ContextMenu.propTypes = {
    position: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
    }).isRequired,
    items: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            group: PropTypes.string,
        })
    ),
    title: PropTypes.string.isRequired,
    onClose: PropTypes.func,
};

export default ContextMenu;
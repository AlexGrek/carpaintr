const ContextMenu = ({ position, items, title, onClose }) => {
    if (!items) return null;

    const menuStyle = {
        top: position.y,
        left: position.x,
    };

    return (
        <div className="context-menu fade-in-simple-fast" style={menuStyle}>
            <div className="context-menu-header">{title}</div>
            <ul className="context-menu-list">
                {items.map((item, index) => (
                    <li key={index} className="context-menu-item" onClick={() => alert(`Selected: ${item}`)}>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ContextMenu;
import React, { useState } from 'react';
import './ObjectBrowser.css'; // Custom CSS file for ObjectBrowser specific styles

// Recursive component to render object/array structure with expand/collapse
const JsonViewer = ({ data, level = 0, initialExpanded = false, isRoot = false }) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const toggleExpand = (e) => {
    // Prevent event bubbling if a child element is clicked
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  if (typeof data !== 'object' || data === null) {
    // Render primitive values (string, number, boolean, null)
    let displayValue;
    let valueType = typeof data;

    if (data === null) {
      displayValue = 'null';
      valueType = 'null';
    } else if (typeof data === 'string') {
      displayValue = data; // No quotes for strings
      valueType = 'string';
    } else {
      displayValue = String(data); // Numbers, booleans
    }

    return <span className={`json-value type-${valueType}`}>{displayValue}</span>;
  }

  // Determine if the current node is expandable (has children)
  const hasChildren = (Array.isArray(data) && data.length > 0) || (!Array.isArray(data) && Object.keys(data).length > 0);
  const isEmpty = (Array.isArray(data) && data.length === 0) || (!Array.isArray(data) && Object.keys(data).length === 0);

  // Render arrays
  if (Array.isArray(data)) {
    const itemCount = data.length;
    return (
      <div className={`json-array-node ${isRoot ? 'json-root-node' : ''}`}>
        <div className="json-node-header" onClick={hasChildren ? toggleExpand : undefined}>
          {hasChildren && (
            <span className={`json-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}>
              ▶ {/* Always render right arrow, rotate with CSS */}
            </span>
          )}
          <span className="json-node-label">
            {isRoot ? 'Root Array' : 'Array'}
          </span>
          <span className="json-summary">
            {isEmpty ? ' (empty)' : ` (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`}
          </span>
        </div>
        <div className={`json-children ${isExpanded ? 'expanded-content' : ''}`}>
          {data.map((item, index) => (
            <div key={index} className="json-item">
              <span className="json-index">{index}</span>
              <JsonViewer data={item} level={level + 1} initialExpanded={false} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle objects
  const keys = Object.keys(data);
  const keyCount = keys.length;

  return (
    <div className={`json-object-node ${isRoot ? 'json-root-node' : ''}`}>
      <div className="json-node-header" onClick={hasChildren ? toggleExpand : undefined}>
        {hasChildren && (
          <span className={`json-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}>
            ▶ {/* Always render right arrow, rotate with CSS */}
          </span>
        )}
        <span className="json-node-label">
          {isRoot ? 'Root Object' : 'Object'}
        </span>
        <span className="json-summary">
          {isEmpty ? ' (empty)' : ` (${keyCount} ${keyCount === 1 ? 'key' : 'keys'})`}
        </span>
      </div>
      <div className={`json-children ${isExpanded ? 'expanded-content' : ''}`}>
        {keys.map((key, index) => (
          <div key={key} className="json-item">
            <span className="json-key">{key}</span>
            <JsonViewer data={data[key]} level={level + 1} initialExpanded={false} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Main ObjectBrowser Component
const ObjectBrowser = ({ jsonObject }) => {
  const [activeTab, setActiveTab] = useState('browser'); // 'browser', 'json', 'yaml'

  const getFormattedJson = () => {
    return JSON.stringify(jsonObject, null, 2); // 2 spaces indentation
  };

  // Placeholder for YAML conversion (you'd use js-yaml here)
  const getYaml = () => {
    try {
      // return jsyaml.dump(jsonObject); // This is where js-yaml would go
      return "YAML conversion (requires js-yaml)";
    } catch (e) {
      return `Error converting to YAML: ${e.message}`;
    }
  };

  return (
    <div className="object-browser-container">
      <div className="tab-navbar">
        {/* Replace with RSuite Navbar components */}
        <button
          className={`tab-item ${activeTab === 'browser' ? 'active' : ''}`}
          onClick={() => setActiveTab('browser')}
        >
          Object Browser
        </button>
        <button
          className={`tab-item ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          JSON View
        </button>
        <button
          className={`tab-item ${activeTab === 'yaml' ? 'active' : ''}`}
          onClick={() => setActiveTab('yaml')}
        >
          YAML View
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'browser' && (
          <div className="object-browser-view">
            {/* InitialExpanded for the root object, and mark as root */}
            <JsonViewer data={jsonObject} initialExpanded={true} isRoot={true} />
          </div>
        )}
        {activeTab === 'json' && (
          <pre className="json-code">
            <code>{getFormattedJson()}</code>
          </pre>
        )}
        {activeTab === 'yaml' && (
          <pre className="yaml-code">
            <code>{getYaml()}</code>
          </pre>
        )}
      </div>
    </div>
  );
};

export default ObjectBrowser;

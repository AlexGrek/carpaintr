import React, { useEffect, useState } from "react";
import YAML from "yaml";
import {
    Drawer,
    Button,
    ButtonToolbar,
    Form,
    Toggle,
    Panel,
    Stack
} from "rsuite";

// Recursively renders and edits YAML nodes
function YamlNodeEditor({ node, path, onChange }) {
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
        return (
            <Panel bordered header={path[path.length - 1] || "Root"} style={{ marginBottom: 10 }}>
                {Object.entries(node).map(([key, value]) => (
                    <YamlNodeEditor
                        key={key}
                        node={value}
                        path={[...path, key]}
                        onChange={onChange}
                    />
                ))}
            </Panel>
        );
    }

    if (Array.isArray(node)) {
        return (
            <Panel bordered header={path[path.length - 1] || "Array"} style={{ marginBottom: 10 }}>
                {node.map((item, index) => (
                    <YamlNodeEditor
                        key={index}
                        node={item}
                        path={[...path, String(index)]}
                        onChange={onChange}
                    />
                ))}
            </Panel>
        );
    }

    const key = path[path.length - 1];

    return (
        <Stack spacing={10} style={{ padding: "4px 0" }} vertical>
            <Form>
                <Form.ControlLabel>{path.join(".")}</Form.ControlLabel>
                {typeof node === "boolean" ? (
                    <Toggle
                        checked={node}
                        onChange={(checked) => onChange(path, checked)}
                    />
                ) : (
                    <Form.Control
                        type={typeof node === "number" ? "number" : "text"}
                        value={node}
                        onChange={(val) =>
                            onChange(path, typeof node === "number" ? Number(val) : val)
                        }
                    />
                )}
            </Form>
        </Stack>
    );
}

// Helper to update nested value by path
function setDeepValue(obj, path, value) {
    const last = path[path.length - 1];
    const target = path.slice(0, -1).reduce((acc, key) => {
        const index = Number(key);
        if (!isNaN(index) && Array.isArray(acc)) return acc[index];
        return acc[key];
    }, obj);

    const lastIndex = Number(last);
    if (!isNaN(lastIndex) && Array.isArray(target)) {
        target[lastIndex] = value;
    } else {
        target[last] = value;
    }
}

export default function DrawerYamlEditor({ yamlString, open, onClose }) {
    const [doc, setDoc] = useState(null);
    const [parsedYaml, setParsedYaml] = useState(null);

    useEffect(() => {
        if (!open) return;

        const parsedDoc = YAML.parseDocument(yamlString, {
            keepSourceTokens: true
        });
        setDoc(parsedDoc);
        setParsedYaml(parsedDoc.toJS({}));
    }, [open, yamlString]);

    const handleChange = (path, value) => {
        setParsedYaml((prev) => {
            const copy = structuredClone(prev);
            setDeepValue(copy, path, value);
            return copy;
        });
    };

    const handleSave = () => {
        if (!doc) return;
        doc.contents = YAML.createNode(parsedYaml);
        onClose(String(doc));
    };

    const handleCancel = () => {
        onClose(yamlString);
    };

    return (
        <Drawer open={open} onClose={handleCancel} size="md">
            <Drawer.Header>
                <Drawer.Title>YAML Editor</Drawer.Title>
                <ButtonToolbar>
                    <Button appearance="primary" onClick={handleSave}>
                        Save
                    </Button>
                    <Button appearance="subtle" onClick={handleCancel}>
                        Cancel
                    </Button>
                </ButtonToolbar>
            </Drawer.Header>
            <Drawer.Body>
                {parsedYaml && (
                    <YamlNodeEditor node={parsedYaml} path={[]} onChange={handleChange} />
                )}
            </Drawer.Body>
        </Drawer>
    );
}

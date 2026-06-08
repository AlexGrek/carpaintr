import { useEffect, useState } from "react";
import { Drawer, Button } from "rsuite";
import { AddOutline } from "@rsuite/icons";
import jsyaml from "js-yaml";
import NamedItemEditor from "./NamedItemEditor";
import ErrorMessage from "../layout/ErrorMessage";
import "./styles.css";
import { useMediaQuery } from "react-responsive";

// The main drawer component that manages the overall state.
const YamlItemsEditorDrawer = ({ onClose, isOpen, value, onChange }) => {
  const [editedData, setEditedData] = useState(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const [errorText, setErrorText] = useState(null);

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    try {
      setEditedData(jsyaml.load(value));
    } catch (e) {
      reportError("Failed to deserialize yaml: " + e);
    }
  }, [value]);

  const handleSave = () => {
    try {
      const yamlString = jsyaml.dump(editedData);
      onChange(yamlString);
      handleClose();
    } catch (e) {
      setErrorText(`Failed to serialize data: ${e.message}`);
      console.error("YAML Save Error:", e);
    }
  };

  const handleValueChange = (name, newValue) => {
    setEditedData((prevData) => ({
      ...prevData,
      [name]: newValue,
    }));
  };

  const handleDelete = (name) => {
    setEditedData((prevData) => {
      const newData = { ...prevData };
      delete newData[name];
      return newData;
    });
  };

  const handleNameChange = (oldName, newName) => {
    if (
      !newName.trim() ||
      (newName !== oldName && Object.hasOwn(editedData, newName))
    ) {
      setErrorText(`Item name cannot be empty or a duplicate.`);
      return;
    }

    const dataAsArray = Object.entries(editedData);
    const itemIndex = dataAsArray.findIndex(([key]) => key === oldName);
    if (itemIndex === -1) return;

    const updatedArray = [
      ...dataAsArray.slice(0, itemIndex),
      [newName, dataAsArray[itemIndex][1]],
      ...dataAsArray.slice(itemIndex + 1),
    ];

    setEditedData(Object.fromEntries(updatedArray));
  };

  const handleAddItem = () => {
    const newKey = `newItem_${Date.now()}`;
    setEditedData((prevData) => ({
      ...prevData,
      [newKey]: { description: "A new item", value: "default" },
    }));
  };

  return (
    <Drawer
      size={isMobile ? "full" : "md"}
      placement="right"
      open={isOpen}
      onClose={handleClose}
    >
      <Drawer.Header>
        <Drawer.Title>YAML Editor</Drawer.Title>
        <Drawer.Actions>
          <Button onClick={handleSave} appearance="primary">
            Save
          </Button>
          <Button onClick={handleClose} appearance="subtle">
            Cancel
          </Button>
        </Drawer.Actions>
      </Drawer.Header>
      <Drawer.Body>
        <ErrorMessage
          errorText={errorText}
          onClose={() => setErrorText(null)}
        />
        {editedData &&
          Object.entries(editedData).map(([name, itemValue]) => (
            <NamedItemEditor
              key={name}
              name={name}
              value={itemValue}
              onValueChange={handleValueChange}
              onDelete={handleDelete}
              onNameChange={handleNameChange}
            />
          ))}
        <Button
          appearance="ghost"
          startIcon={<AddOutline />}
          onClick={handleAddItem}
          block
          style={{ marginTop: "1rem" }}
        >
          Add New Item
        </Button>
      </Drawer.Body>
    </Drawer>
  );
};

export default YamlItemsEditorDrawer;

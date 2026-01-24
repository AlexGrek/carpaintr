import { Panel, Stack, Input, IconButton } from "rsuite";
import { Trash } from "@rsuite/icons";
import ItemEditor from "./ItemEditor";

// Manages a single named block (e.g., "fabia" and its contents).
// It's stateless and calls parent handlers immediately.
const NamedItemEditor = ({
  name,
  value,
  onNameChange,
  onValueChange,
  onDelete,
}) => {
  return (
    <Panel bordered shaded style={{ marginBottom: "1rem" }}>
      <Stack
        justifyContent="space-between"
        alignItems="center"
        style={{ marginBottom: "1rem" }}
      >
        <Stack.Item grow={1}>
          <Input
            value={name}
            onChange={(newName) => onNameChange(name, newName)}
            style={{ fontWeight: "bold" }}
          />
        </Stack.Item>
        <Stack.Item>
          <IconButton
            icon={<Trash />}
            onClick={() => onDelete(name)}
            appearance="subtle"
            color="red"
            circle
          />
        </Stack.Item>
      </Stack>
      <ItemEditor
        value={value}
        onChange={(newValue) => onValueChange(name, newValue)}
      />
    </Panel>
  );
};

export default NamedItemEditor;

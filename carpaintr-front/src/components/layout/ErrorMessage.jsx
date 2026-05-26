import { Message, Divider, HStack, Button } from "rsuite";
import { useNavigate } from "react-router-dom";
import Trans from "../../localization/Trans";
import { isString } from "lodash";
import { LICENSE_STATUS_PATH } from "../../routes/paths";
import { registerTranslations } from "../../localization/LocaleContext";

registerTranslations("ua", {
  "License status": "Статус ліцензії",
});

const ErrorMessage = ({
  errorText,
  errorTitle = "Error",
  onClose = null,
  showSettingsButton = true,
  settingsPath = LICENSE_STATUS_PATH,
  settingsLabel = "License status",
  className = "pop-in-simple",
}) => {
  const navigate = useNavigate();

  // Return null if no error text provided
  if (!errorText) {
    return null;
  }

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleSettingsClick = () => {
    navigate(settingsPath);
  };

  const decodeErrorIfObject = (err) => {
    if (isString(err)) {
      return err; // do nothing
    } else {
      return JSON.stringify(err);
    }
  };

  return (
    <Message
      className={className}
      showIcon
      closable
      type="error"
      title={decodeErrorIfObject(errorTitle)}
    >
      {decodeErrorIfObject(errorText)}
      <Divider />
      <HStack justifyContent="flex-end" style={{ width: "100%" }}>
        {showSettingsButton && (
          <Button size="sm" appearance="link" onClick={handleSettingsClick}>
            <Trans>{settingsLabel}</Trans>
          </Button>
        )}
        <Button size="sm" appearance="primary" onClick={handleClose}>
          <Trans>Close</Trans>
        </Button>
      </HStack>
    </Message>
  );
};

export default ErrorMessage;

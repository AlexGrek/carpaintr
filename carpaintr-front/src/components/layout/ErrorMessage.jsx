import React from 'react';
import { Message, Divider, HStack, Button } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import Trans from '../../localization/Trans';
import { isString } from 'lodash';

const ErrorMessage = ({
  errorText,
  errorTitle = "Error",
  onClose = null,
  showSettingsButton = true,
  settingsPath = '/cabinet',
  className = 'fade-in-simple'
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
    }
    else {
      return JSON.stringify(err);
    }
  }

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
      <HStack justifyContent='flex-end' style={{ width: "100%" }}>
        {showSettingsButton && (
          <Button
            size="sm"
            appearance="link"
            onClick={handleSettingsClick}
          >
            <Trans>Settings</Trans>
          </Button>
        )}
        <Button
          size="sm"
          appearance="primary"
          onClick={handleClose}
        >
          <Trans>Close</Trans>
        </Button>
      </HStack>
    </Message>
  );
};

export default ErrorMessage;

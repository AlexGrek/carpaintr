/* eslint-disable react/display-name */
import React, { useState, useEffect, useCallback } from "react";
import { Button, Modal } from "rsuite";
import Trans from "../../localization/Trans";

// Confirmation Dialog Component
const ConfirmationDialog = React.memo(
  ({ show, onClose, onConfirm, message }) => {
    return (
      <Modal open={show} onClose={onClose} size="xs">
        <Modal.Header>
          <Modal.Title>
            <Trans>Confirmation</Trans>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{message}</Modal.Body>
        <Modal.Footer>
          <Button onClick={onConfirm} appearance="primary">
            <Trans>Confirm</Trans>
          </Button>
          <Button onClick={onClose} appearance="subtle">
            <Trans>Cancel</Trans>
          </Button>
        </Modal.Footer>
      </Modal>
    );
  },
);

export default ConfirmationDialog;

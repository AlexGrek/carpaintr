/* eslint-disable react/display-name */
import React from "react";
import { useMediaQuery } from "react-responsive";
import { IconButton, Stack } from "rsuite";
import Trans from "../../localization/Trans";
import PlusRoundIcon from "@rsuite/icons/PlusRound";
import FileDownloadIcon from "@rsuite/icons/FileDownload";
import TableIcon from "@rsuite/icons/Table";
import SaveIcon from "@rsuite/icons/Save";
import RemindOutlineIcon from "@rsuite/icons/RemindOutline";

// Top Panel Subcomponent
const TopPanel = React.memo(
  ({ onNew, onSave, onLoad, onPrint, showReportIssueForm, saveEnabled }) => {
    const isMobile = useMediaQuery({ maxWidth: 767 }); // Define breakpoint for mobile

    return (
      <Stack
        wrap
        justifyContent={isMobile ? "center" : "space-between"} // Center on mobile, space-between on desktop
        className="calc-buttons-panel-stack sticky top-0 bg-white p-4 z-10 shadow-md rounded-b-lg" // Sticky position, background, padding, shadow, rounded corners
        spacing={isMobile ? 5 : 10} // Smaller spacing on mobile
      >
        {!isMobile && (
          <h3 className="text-2xl font-semibold">
            <Trans>Cost of repair calculation</Trans>
          </h3>
        )}
        <Stack
          spacing={isMobile ? 5 : 10}
          justifyContent="center"
          alignItems="center"
        >
          {" "}
          {/* Center buttons horizontally */}
          <IconButton
            icon={<PlusRoundIcon />}
            appearance="primary"
            onClick={onNew}
            className="rounded-md"
          >
            {!isMobile && <Trans>New</Trans>}
          </IconButton>
          <IconButton
            icon={<SaveIcon />}
            onClick={onSave}
            className="rounded-md"
            disabled={!saveEnabled}
          >
            {!isMobile && <Trans>Save</Trans>}
          </IconButton>
          <IconButton
            icon={<FileDownloadIcon />}
            onClick={onLoad}
            className="rounded-md"
          >
            {!isMobile && <Trans>Recents</Trans>}
          </IconButton>
          <IconButton
            icon={<TableIcon />}
            onClick={onPrint}
            className="rounded-md"
          >
            {!isMobile && <Trans>Print</Trans>}
          </IconButton>
          {!isMobile && ( // Show report button only on desktop for now to save space
            <IconButton
              icon={<RemindOutlineIcon />}
              appearance="link"
              color="red"
              size="xs"
              onClick={showReportIssueForm}
              className="rounded-md"
            >
              <Trans>Report a problem</Trans>
            </IconButton>
          )}
        </Stack>
      </Stack>
    );
  },
);

export default TopPanel;

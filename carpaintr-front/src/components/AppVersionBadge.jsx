import { Tag, Whisper, Tooltip } from "rsuite";
import { useState, useEffect } from "react";
import Trans from "../localization/Trans";
import { registerTranslations } from "../localization/LocaleContext";

registerTranslations("ua", {
  "Application build version": "Версія збірки",
});

export default function AppVersionBadge() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (typeof __APP_VERSION__ === "string") {
      setVersion(__APP_VERSION__);
    }
  }, []);

  return (
    <Whisper
      trigger="hover"
      placement="top"
      speaker={
        <Tooltip>
          <Trans>Application build version</Trans>
        </Tooltip>
      }
    >
      <Tag
        style={{
          cursor: "default",
          fontFamily: "monospace",
          opacity: "0.6",
          marginTop: "12pt",
        }}
      >
        <span style={{ marginLeft: 8, fontSize: 12 }}>{version}</span>
      </Tag>
    </Whisper>
  );
}

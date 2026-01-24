import { useEffect, useState } from "react";
import { Loader, Panel, Button, Whisper, Tooltip } from "rsuite";
import { authFetch } from "../utils/authFetch";
import { useLocale } from "../localization/LocaleContext"; // Import useLocale and registerTranslations
import { parseISO, intervalToDuration } from "date-fns"; // Import intervalToDuration

const ServerLogs = () => {
  const [lines, setLines] = useState(100);
  const [log, setLog] = useState([]);
  const { str } = useLocale(); // Initialize useLocale hook
  const [frontend, setFrontend] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const response = await authFetch(
          `/api/v1/admin/logs${frontend}?lines=` + lines,
        );
        if (!response.ok) {
          throw new Error(`${str("Error: ")}${response.statusText}`);
        }
        const data = await response.json();
        setLog(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [str, lines, frontend]);

  const parseAndStyleLogLine = (line) => {
    const timestampRegex =
      /(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} UTC\])/;
    const userRegex = /(\[User: .+?\])/;

    const parts = line.split(timestampRegex);
    return parts.map((part, index) => {
      if (timestampRegex.test(part)) {
        const timestampStr = part
          .substring(1, part.length - 1)
          .replace(" UTC", "");

        let formattedTimeAgo = "";
        try {
          const dateInUTC = parseISO(timestampStr + "Z");
          const now = new Date();
          const duration = intervalToDuration({ start: dateInUTC, end: now });

          if (duration.years > 0) {
            formattedTimeAgo = `${duration.years}y ago`;
          } else if (duration.months > 0) {
            formattedTimeAgo = `${duration.months}m ago`;
          } else if (duration.days > 0) {
            formattedTimeAgo = `${duration.days}d ${duration.hours}h ago`;
          } else if (duration.hours > 0) {
            formattedTimeAgo = `${duration.hours}h ago`;
          } else if (duration.minutes > 0) {
            formattedTimeAgo = `${duration.minutes}m ago`;
          } else {
            formattedTimeAgo = `${duration.seconds}s ago`;
          }
        } catch (e) {
          formattedTimeAgo = "Invalid Date";
          console.error("Error parsing timestamp:", e);
        }

        return (
          <Whisper
            key={index}
            placement="top"
            controlId={`whisper-${index}`}
            trigger="hover"
            speaker={<Tooltip>{formattedTimeAgo}</Tooltip>}
          >
            <span style={{ color: "#888", marginRight: "5px", cursor: "help" }}>
              {part}
            </span>
          </Whisper>
        );
      } else {
        const userParts = part.split(userRegex);
        return userParts.map((userPart, userIndex) => {
          if (userRegex.test(userPart)) {
            return (
              <span
                key={`${index}-${userIndex}`}
                style={{
                  color: "#007bff",
                  fontWeight: "bold",
                  marginRight: "5px",
                }}
              >
                {userPart}
              </span>
            );
          } else {
            return <span key={`${index}-${userIndex}`}>{userPart}</span>;
          }
        });
      }
    });
  };

  return (
    <Panel shaded>
      <p>
        Showing last <b>{lines}</b> log lines
      </p>
      <Button
        onClick={() => setFrontend("_frontend")}
        disabled={frontend != ""}
        appearance="link"
      >
        See frontend failure logs
      </Button>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.85em",
          textAlign: "left",
          backgroundColor: "#f5f5f5",
          padding: "10px",
          borderRadius: "5px",
          maxHeight: "500px",
          overflowY: "auto",
        }}
      >
        {log.map((item, i) => {
          return (
            <p key={i} style={{ margin: "2px 0" }}>
              {parseAndStyleLogLine(item)}
            </p>
          );
        })}
        {loading && <Loader center content="Loading..." />}
        {!loading && log.length === 0 && <p>No logs to display.</p>}
      </div>
      <div style={{ marginTop: "10px", textAlign: "center" }}>
        <Button appearance="link" onClick={() => setLines(lines + 100)}>
          Load more...
        </Button>
      </div>
    </Panel>
  );
};

export default ServerLogs;

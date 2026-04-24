import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Loader, Modal, Panel, PanelGroup, Tag } from "rsuite";
import { useMediaQuery } from "react-responsive";
import PartLookup from "./PartLookup";
import ObjectBrowser from "../utility/ObjectBrowser";
import { ChevronRight, Layers } from "lucide-react";
import Trans from "../../localization/Trans";

const PartsCatalog = () => {
  const [parts, setParts] = useState([]);
  const [partsT2, setPartsT2] = useState([]);
  const [partsT2Errors, setPartsT2Errors] = useState([]);
  const [errorText, setErrorText] = useState(null);
  const [errorTitle, setErrorTitle] = useState("");
  const [chosenPart, setChosenPart] = useState(null);
  const [activeTab, setActiveTab] = useState("t1");
  const { str } = useLocale();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [isExpanded, setIsExpanded] = useState(false);

  const handleError = useCallback(
    (reason) => {
      console.error(reason);
      setErrorText(reason);
      setErrorTitle(str("Error"));
    },
    [str],
  );

  useEffect(() => {
    const fetchParts = (url, onSuccess) =>
      authFetch(url)
        .then((r) => {
          if (r.status === 403) { handleError("ERROR"); return null; }
          if (!r.ok) throw new Error(`HTTP error ${r.status}`);
          return r.json();
        })
        .then((d) => d && onSuccess(d))
        .catch(handleError);

    fetchParts("/api/v1/user/all_parts", setParts);
    fetchParts("/api/v1/user/all_parts_t2", (d) => {
      setPartsT2(d.data);
      setPartsT2Errors(d.errors);
    });
  }, [handleError]);

  const loading = parts.length === 0 && partsT2.length === 0;

  return (
    <div className="fade-in-simple">
      <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />

      {partsT2Errors.length > 0 && (
        <Panel shaded style={{ marginBottom: "1rem" }}>
          <span style={{ color: "#ef4444", fontWeight: 600 }}>Errors detected:</span>
          <pre style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>{JSON.stringify(partsT2Errors, null, 2)}</pre>
        </Panel>
      )}

      {loading && <Loader center content={str("Loading...")} />}

      {!loading && (
        <>
          {/* Inner tab switcher */}
          <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "10px", padding: "3px", gap: "2px", marginBottom: "1.25rem" }}>
            {[
              { key: "t1", label: `T1 (${parts.length})` },
              { key: "t2", label: `T2 (${partsT2.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: "6px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "color 0.15s, background 0.15s",
                  color: activeTab === key ? "#ea580c" : "#64748b",
                  background: activeTab === key ? "#ffffff" : "transparent",
                  boxShadow: activeTab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "t1" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {parts.map((part, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setChosenPart(part)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.65rem 0.9rem",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    outline: "2px solid transparent",
                    transition: "box-shadow 0.15s ease, outline-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(234,88,12,0.1)";
                    e.currentTarget.style.outlineColor = "rgba(234,88,12,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "";
                    e.currentTarget.style.outlineColor = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <Layers size={14} style={{ color: "#ea580c", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#0f172a", textTransform: "capitalize" }}>{part}</span>
                  </span>
                  <ChevronRight size={14} style={{ color: "#94a3b8" }} />
                </button>
              ))}
            </div>
          )}

          {activeTab === "t2" && (
            <PanelGroup accordion defaultActiveKey={0} bordered>
              {partsT2.map((part, i) => (
                <Panel
                  key={i}
                  eventKey={i}
                  header={
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {part.group && <Tag size="sm" color="orange" style={{ fontWeight: 600 }}>{part.group}</Tag>}
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{part.name || `Unknown part ${i}`}</span>
                      {part.zone && <Tag size="sm" color="cyan">{part.zone}</Tag>}
                    </span>
                  }
                >
                  <ObjectBrowser jsonObject={part} />
                </Panel>
              ))}
            </PanelGroup>
          )}
        </>
      )}

      <Modal
        size={isMobile || isExpanded ? "full" : "lg"}
        open={chosenPart !== null}
        onClose={() => { setChosenPart(null); setIsExpanded(false); }}
      >
        <Modal.Header>
          <Modal.Title style={{ fontWeight: 700, textTransform: "capitalize" }}>{chosenPart}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {chosenPart != null && (
            <PartLookup part={chosenPart} onExpand={() => setIsExpanded(true)} />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default PartsCatalog;

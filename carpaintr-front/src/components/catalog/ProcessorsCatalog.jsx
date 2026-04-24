import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../utils/authFetch";
import ErrorMessage from "../layout/ErrorMessage";
import { Loader } from "rsuite";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";
import { ChevronDown, ChevronRight, Code2 } from "lucide-react";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism.css";

registerTranslations("ua", {
  "No processors found": "Процесорів не знайдено",
  "processors": "процесорів",
});

const ProcessorsCatalog = () => {
  const [processors, setProcessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState(null);
  const [errorTitle, setErrorTitle] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const { str } = useLocale();

  const handleError = useCallback(
    (reason) => {
      console.error(reason);
      setErrorText(String(reason));
      setErrorTitle(str("Error"));
    },
    [str],
  );

  useEffect(() => {
    authFetch("/api/v1/user/processors_list")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        return r.json();
      })
      .then(setProcessors)
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [handleError]);

  const toggle = (name) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  if (loading) return <Loader center content={str("Loading...")} />;

  return (
    <div className="fade-in-simple">
      <ErrorMessage errorText={errorText} onClose={() => setErrorText(null)} title={errorTitle} />

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
          <Trans>Processors</Trans>
        </h2>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>
          {processors.length} <Trans>processors</Trans>
        </span>
      </div>

      {processors.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
          <Code2 size={40} style={{ marginBottom: "0.75rem", opacity: 0.4 }} />
          <p style={{ margin: 0 }}><Trans>No processors found</Trans></p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {processors.map(({ name, source }) => {
            const isOpen = expanded.has(name);
            return (
              <div
                key={name}
                style={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  outline: "2px solid transparent",
                  transition: "outline-color 0.15s ease, box-shadow 0.15s ease",
                  ...(isOpen ? { boxShadow: "0 4px 16px rgba(234,88,12,0.08)", outlineColor: "rgba(234,88,12,0.2)" } : {}),
                }}
              >
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => toggle(name)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    border: "none",
                    background: isOpen ? "#fff7ed" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  <Code2 size={16} style={{ color: "#ea580c", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: "0.9rem", fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>
                    {name}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {source.split("\n").length} lines
                  </span>
                  {isOpen
                    ? <ChevronDown size={15} style={{ color: "#ea580c", flexShrink: 0 }} />
                    : <ChevronRight size={15} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  }
                </button>

                {/* Source code */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    <pre style={{
                      margin: 0,
                      padding: "1rem 1.25rem",
                      fontSize: "0.78rem",
                      lineHeight: 1.6,
                      overflowX: "auto",
                      whiteSpace: "pre",
                      textAlign: "left",
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    }}>
                      <code
                        dangerouslySetInnerHTML={{
                          __html: highlight(source, languages.javascript, "javascript"),
                        }}
                      />
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProcessorsCatalog;

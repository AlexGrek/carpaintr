/* eslint-disable react/display-name */

import React, { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/authFetch";
import {
  VStack,
  Message,
  Placeholder,
  useToaster,
  Text,
} from "rsuite";
import { Wrench, ChevronRight } from "lucide-react";
import { capitalizeFirstLetter } from "../../utils/utils";
import ErrorMessage from "../layout/ErrorMessage";

const formatTimeAgo = (dateString, str) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString(str("locale_code") || "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#9ca3af",
  marginBottom: 6,
  paddingLeft: 2,
};

const projectCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.07)",
  background: "#fff",
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  userSelect: "none",
};

const projectCardHoverStyle = {
  border: "1px solid rgba(226,59,26,0.35)",
  boxShadow: "0 2px 10px rgba(226,59,26,0.10)",
  background: "#fff9f7",
};

const iconBubbleStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: "linear-gradient(135deg, #ffe0d8, #ffc9bc)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const ProjectCard = React.memo(({ file, onClick, str }) => {
  const [hovered, setHovered] = useState(false);
  const name = capitalizeFirstLetter(
    file.name.split("_").slice(0, -1).join(" ") || file.name
  );

  return (
    <div
      style={{ ...projectCardStyle, ...(hovered ? projectCardHoverStyle : {}) }}
      onClick={() => onClick(file.name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={iconBubbleStyle}>
        <Wrench size={18} color="#c63215" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </div>
        <Text as="span" style={{ fontSize: 12, color: "#9ca3af" }}>
          {formatTimeAgo(file.modified, str)}
        </Text>
      </div>
      <ChevronRight size={16} color={hovered ? "#c63215" : "#d1d5db"} style={{ flexShrink: 0 }} />
    </div>
  );
});

const SectionGroup = React.memo(({ label, files, onSelect, str }) => {
  if (!files.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={sectionLabelStyle}>{label}</div>
      <VStack spacing={6}>
        {files.map((file, index) => (
          <ProjectCard key={index} file={file} onClick={onSelect} str={str} />
        ))}
      </VStack>
    </div>
  );
});

const LoadCalculationMenu = React.memo(
  ({ show = true, onClose, onDataLoaded = null }) => {
    const { str } = useLocale();
    const [files24h, setFiles24h] = useState([]);
    const [files1w, setFiles1w] = useState([]);
    const [filesOlder, setFilesOlder] = useState([]);
    const [loading, setLoading] = useState(false);
    const [e, setE] = useState(null);
    const navigate = useNavigate();
    const toaster = useToaster();

    const fetchFiles = useCallback(async () => {
      setLoading(true);
      try {
        const response = await authFetch("/api/v1/user/calculationstore/list");
        if (response.ok) {
          const data = await response.json();
          setFiles24h(data.modified_last_24h || []);
          setFiles1w(data.modified_1w_excl_24h || []);
          setFilesOlder(data.older_than_1w || []);
          setE(null);
        } else {
          const errorData = await response.text();
          setE(errorData);
          setFiles24h([]);
          setFiles1w([]);
          setFilesOlder([]);
        }
      } catch (error) {
        console.error("Error fetching file list:", error);
        setE("Error fetching file list: " + error);
        setFiles24h([]);
        setFiles1w([]);
        setFilesOlder([]);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      if (show) {
        fetchFiles();
      }
    }, [show, fetchFiles]);

    const loadById = useCallback(
      async (id) => {
        if (!id) return;
        const filename = `${id}.json`;
        try {
          const res = await authFetch(
            `/api/v1/user/calculationstore?filename=${encodeURIComponent(filename)}`
          );
          if (!res.ok) {
            const txt = await res.text().catch(() => null);
            throw new Error(txt || `${res.status} ${res.statusText}`);
          }
          const data = await res.json();
          onDataLoaded(data);
        } catch (err) {
          if (err && err.name === "AbortError") return;
          toaster.push(
            <Message type="error" showIcon closable>
              {`Error loading calculation: ${err.message || String(err)}`}
            </Message>,
            { placement: "topEnd" }
          );
        }
      },
      [onDataLoaded, toaster]
    );

    const handleFileSelect = useCallback(
      (filename) => {
        if (!onDataLoaded) {
          navigate(`/app/calc2?id=${filename}`);
          onClose();
        } else {
          loadById(filename);
        }
      },
      [loadById, navigate, onClose, onDataLoaded]
    );

    const isEmpty = !files24h.length && !files1w.length && !filesOlder.length;

    return (
      <div style={{ paddingTop: 8 }}>
        <ErrorMessage errorText={e} onClose={() => setE(null)} />
        {loading ? (
          <Placeholder.Paragraph rows={6} active />
        ) : isEmpty ? (
          <Message type="info" showIcon style={{ marginTop: 16 }}>
            {str("No saved projects yet.")}
          </Message>
        ) : (
          <div>
            <SectionGroup
              label={str("Today")}
              files={files24h}
              onSelect={handleFileSelect}
              str={str}
            />
            <SectionGroup
              label={str("This week")}
              files={files1w}
              onSelect={handleFileSelect}
              str={str}
            />
            <SectionGroup
              label={str("Older")}
              files={filesOlder}
              onSelect={handleFileSelect}
              str={str}
            />
          </div>
        )}
      </div>
    );
  }
);

export default LoadCalculationMenu;

/* eslint-disable react/display-name */

import React, { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../localization/LocaleContext";
import { useMediaQuery } from "react-responsive";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/authFetch";
import {
  HStack,
  VStack,
  Text,
  Message,
  Stack,
  Placeholder,
  Panel,
  useToaster,
} from "rsuite";
import { Car } from "lucide-react";
import { capitalizeFirstLetter } from "../../utils/utils";
import ErrorMessage from "../layout/ErrorMessage";

// Helper function to format time ago
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
    // Fallback to full date for older than a week
    return date.toLocaleDateString(str("locale_code") || "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
};

// Load Calculation Drawer Component
const LoadCalculationMenu = React.memo(
  ({ show = true, onClose, onDataLoaded = null }) => {
    const { str } = useLocale();
    const isMobile = useMediaQuery({ maxWidth: 767 });
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
        fetchFiles(); // Fetch files only when the drawer opens
      }
    }, [show, fetchFiles]);

    const loadById = useCallback(
      async (id) => {
        if (!id) return;
        const filename = `${id}.json`;
        try {
          const res = await authFetch(
            `/api/v1/user/calculationstore?filename=${encodeURIComponent(filename)}`,
          );

          if (!res.ok) {
            const txt = await res.text().catch(() => null);
            throw new Error(txt || `${res.status} ${res.statusText}`);
          }

          const data = await res.json();
          onDataLoaded(data);
        } catch (err) {
          // ignore abort-like cases (if you use AbortController elsewhere)
          if (err && err.name === "AbortError") return;

          toaster.push(
            <Message type="error" showIcon closable>
              {`Error loading calculation: ${err.message || String(err)}`}
            </Message>,
            { placement: "topEnd" },
          );
        }
      },
      [onDataLoaded, toaster],
    );

    const handleFileSelect = useCallback(
      (filename) => {
        if (!onDataLoaded) {
          navigate(`/app/calc2?id=${filename}`); // Navigate to /app/calc2?id={filename}
          onClose();
        } else {
          loadById(filename);
        }
      },
      [loadById, navigate, onClose, onDataLoaded],
    );

    const renderFileList = useCallback(
      (files) => (
        <VStack spacing={10} alignItems="flex-start" className="w-full">
          {files.length > 0 ? (
            <VStack
              spacing={5}
              alignItems="flex-start"
              className="calc-file-load-stack"
            >
              {files.map((file, index) => (
                <div
                  key={index}
                  className="calc-file-load-entry"
                  onClick={() => handleFileSelect(file.name)}
                  style={{
                    justifyContent: "space-between",
                    padding: "8px 12px",
                  }}
                >
                  <HStack width="100%" justifyContent="space-between">
                    <p className="calc-file-load-entry-name">
                      <Car size={18} />
                      {capitalizeFirstLetter(
                        file.name.split("_").slice(0, -1).join(" "),
                      )}
                    </p>
                    <p className="calc-file-load-entry-date">
                      <Text as="sub">{formatTimeAgo(file.modified, str)}</Text>
                    </p>
                  </HStack>
                </div>
              ))}
            </VStack>
          ) : (
            <p />
          )}
        </VStack>
      ),
      [handleFileSelect, str],
    );

    return (
      <Panel>
        <ErrorMessage errorText={e} onClose={() => setE(null)} />
        {loading ? (
          <Placeholder.Paragraph rows={5} />
        ) : (
          <Stack
            wrap={isMobile} // Wrap on mobile to stack columns
            justifyContent={isMobile ? "flex-start" : "space-around"}
            alignItems={isMobile ? "flex-start" : "flex-start"}
            spacing={isMobile ? 20 : 30}
            className="w-full"
          >
            {renderFileList(files24h, str("Modified last 24h"))}
            {renderFileList(files1w, str("Modified 1 week excl 24h"))}
            {renderFileList(filesOlder, str("Older than 1 week"))}
          </Stack>
        )}
      </Panel>
    );
  },
);

export default LoadCalculationMenu;

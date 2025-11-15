import React, { useEffect, useState } from "react";
import { Modal, Button, Loader } from "rsuite";
import {
  FileText,
  Image as ImageIcon,
  FileArchive,
  Download,
} from "lucide-react";
import "./AttachmentList.css";
import { authFetch } from "../utils/authFetch";

const formatSize = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}Mb`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}kb`;
  return `${bytes}b`;
};

const isImage = (filename) => /\.(png|jpe?g|gif|bmp|webp)$/i.test(filename);
const isArchive = (filename) => /\.(zip|rar|7z|xlsx|docx)$/i.test(filename);
const isPDF = (filename) => /\.pdf$/i.test(filename);

const AttachmentList = ({ attachments }) => {
  const [metas, setMetas] = useState({});
  const [preview, setPreview] = useState(null); // { id, content, type, name }

  useEffect(() => {
    attachments.forEach(async (id) => {
      if (metas[id]) return;

      try {
        const res = await authFetch(`/api/v1/user/attachment_meta/${id}`);
        const meta = await res.json();
        setMetas((prev) => ({ ...prev, [id]: { meta } }));
      } catch {
        setMetas((prev) => ({ ...prev, [id]: { error: true } }));
      }
    });
  }, [attachments]);

  const handlePreview = async (id) => {
    const entry = metas[id];
    if (!entry || !entry.meta) return;
    const { fileName, size } = entry.meta;

    try {
      const res = await authFetch(`/api/v1/user/attachment/${id}`);
      const blob = await res.blob();

      const ext = fileName.split(".").pop().toLowerCase();
      const isImg = isImage(fileName);
      const isTxt = !isImg && !isPDF(fileName) && !isArchive(fileName);

      if (isImg || isTxt) {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview({
            id,
            name: fileName,
            type: isImg ? "image" : "text",
            content: reader.result,
            blob,
          });
        };
        if (isImg) reader.readAsDataURL(blob);
        else reader.readAsText(blob);
      } else {
        setPreview({
          id,
          name: fileName,
          type: "unsupported",
          blob,
        });
      }
    } catch (e) {
      alert("Failed to load preview");
    }
  };

  const saveFile = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="attachment-list">
      {attachments.map((id) => {
        const entry = metas[id];
        const isLoading = !entry || (!entry.meta && !entry.error);
        const meta = entry?.meta;

        const fileName = meta?.fileName || id;
        const fileSize = isLoading ? (
          <Loader size="xs" />
        ) : (
          formatSize(meta.size)
        );
        const largeImage =
          meta && isImage(meta.fileName) && meta.size < 4 * 1024 * 1024;

        return (
          <div
            key={id}
            className={`attachment-item ${largeImage ? "large-preview" : ""}`}
          >
            {largeImage ? (
              <img
                className="attachment-image"
                src={`/api/v1/user/attachment/${id}`}
                alt={meta.fileName}
                onClick={() => handlePreview(id)}
                style={{ maxWidth: 400, maxHeight: 400, cursor: "pointer" }}
              />
            ) : (
              <div
                className="attachment-icon"
                onClick={() => handlePreview(id)}
              >
                {meta ? (
                  isImage(meta.fileName) ? (
                    <ImageIcon size={18} />
                  ) : isArchive(meta.fileName) ? (
                    <FileArchive size={18} />
                  ) : (
                    <FileText size={18} />
                  )
                ) : (
                  <FileText size={18} />
                )}
              </div>
            )}
            <div className="attachment-info" onClick={() => handlePreview(id)}>
              <div className="attachment-name">{fileName}</div>
              <div className="attachment-size">{fileSize}</div>
            </div>
          </div>
        );
      })}

      <Modal open={!!preview} onClose={() => setPreview(null)} size="md">
        <Modal.Header>
          <Modal.Title>Preview: {preview?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {preview?.type === "image" && (
            <img
              src={preview.content}
              alt={preview.name}
              style={{ maxWidth: "100%" }}
            />
          )}
          {preview?.type === "text" && (
            <pre className="text-preview">{preview.content}</pre>
          )}
          {preview?.type === "unsupported" && (
            <div>No preview available for this file type.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => saveFile(preview.blob, preview.name)}
            appearance="primary"
            startIcon={<Download />}
          >
            Save
          </Button>
          <Button onClick={() => setPreview(null)} appearance="subtle">
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AttachmentList;

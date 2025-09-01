import React from "react";

/**
 * Small data card to visualize a vehicle-like object.
 * Only renders: make/model (if present), color (if present), VIN, class, body type, license plate.
 * No Tailwind, self-contained styles.
 */

const styles = {
  card: {
    width: 360,
    maxWidth: "100%",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    padding: 16,
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    background: "linear-gradient(180deg, #ffffff, #fafbfc)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "#111827",
    letterSpacing: 0.2,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#111827",
    border: "1px solid #e5e7eb",
  },
  body: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    rowGap: 8,
    columnGap: 12,
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 14,
    color: "#111827",
    wordBreak: "break-word",
  },
  divider: {
    height: 1,
    background: "#f0f2f5",
    margin: "12px 0",
    border: 0,
  },
  subtle: { color: "#9ca3af", fontStyle: "italic" },
};

function Field({ label, children }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{children}</div>
    </>
  );
}

export function CarCard({ data, className, style }) {
  const car = data?.car || {};
  const paint = data?.paint || {};

  const hasMakeModel = Boolean(car.make) || Boolean(car.model);
  const makeModel = [car.make, car.model].filter(Boolean).join(" ");

  const colorName = (paint.color || "").toString();
  const vin = (car.VIN || "").trim();
  const license = (car.licensePlate || "").trim();
  const carClass = (car.carClass || "").toString();
  const bodyType = (car.bodyType || "").toString();

  return (
    <div className={className} style={{ ...styles.card, ...style }}>
      <div style={styles.header}>
        <h3 style={styles.title}>{hasMakeModel ? makeModel : "Vehicle"}</h3>
        {carClass && (
          <div style={{ ...styles.badge, background: "#eef2ff", borderColor: "#c7d2fe" }}>
            Class {carClass}
          </div>
        )}
      </div>

      <div style={styles.badgeRow}>
        {bodyType && (
          <span style={{ ...styles.badge, background: "#ecfeff", borderColor: "#a5f3fc" }}>{bodyType}</span>
        )}
        {hasMakeModel && (
          <span style={{ ...styles.badge, background: "#fef3c7", borderColor: "#fde68a" }}>Make/Model</span>
        )}
        {colorName && (
          <span style={{ ...styles.badge, background: "#f0fdf4", borderColor: "#bbf7d0" }}>Color</span>
        )}
      </div>

      <hr style={styles.divider} />

      <div style={styles.body}>
        {hasMakeModel && (
          <Field label="Make / Model">{makeModel}</Field>
        )}

        {colorName && (
          <Field label="Color">{colorName}</Field>
        )}

        <Field label="VIN">{vin || <span style={styles.subtle}>—</span>}</Field>
        <Field label="License Plate">{license || <span style={styles.subtle}>—</span>}</Field>
      </div>
    </div>
  );
}
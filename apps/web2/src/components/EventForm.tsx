import { useState } from "react";
import { API_URL } from "../types/constants";

const FLOOR_SECTIONS: { label: string; id: number }[] = [
  { label: "Main", id: 1 },
  { label: "MainR", id: 2 },
  { label: "T 1", id: 3 },
  { label: "T 2", id: 4 },
  { label: "T 3", id: 5 },
];

const LCR_SECTIONS: { label: string; value: "left" | "center" | "right" }[] = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

type EventFormProps = {
  onSuccess?: () => Promise<void> | void;
  currentUser?: string;
};

export default function EventForm({ onSuccess, currentUser }: EventFormProps) {
  const [name, setName] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [screenId, setScreenId] = useState<number | null>(null); // Floor Section
  const [row, setRow] = useState("");
  const [section, setSection] = useState<"left" | "center" | "right">("center"); // L/C/R
  const [groupSize, setGroupSize] = useState(1);
  const [expectedPrice, setExpectedPrice] = useState<number | "">("");
  const [successMessage, setSuccessMessage] = useState("");

  const submitForm = async () => {
    if (!eventUrl.trim()) {
      setSuccessMessage("Event URL is required ❌");
      return;
    }
    if (screenId == null) {
      setSuccessMessage("Please select a Floor Section ❌");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/events/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          eventUrl: eventUrl.trim(),
          screenId,
          row,
          section,
          groupSize,
          expectedPrice: expectedPrice === "" ? undefined : Number(expectedPrice),
          userTag: currentUser ?? null,
        }),
      });

      if (res.ok) {
        setSuccessMessage("Event created successfully! ✅");
        // Clear fields
        setName("");
        setEventUrl("");
        setScreenId(null);
        setRow("");
        setSection("center");
        setGroupSize(1);
        setExpectedPrice("");

        try {
          await onSuccess?.();
        } catch (_) {
          // ignore callback errors to not block UX
        }

        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setSuccessMessage("Failed to create event ❌");
      }
    } catch (error) {
      console.error("Error submitting event:", error);
      setSuccessMessage("An error occurred ❌");
    }
  };

  return (
    <div style={styles.container}>
      <h2
        style={{
          color: "hsl(var(--foreground))",
          fontWeight: "bold",
          fontSize: "24px",
          textAlign: "center",
          paddingRight: "0px",
          width: "100%",
          maxWidth: 315,
          margin: "0 auto 8px",
        }}
      >
        Event Form
      </h2>
      <div style={{ width: "100%", maxWidth: 315, fontSize: 12, color: "#bbb", margin: "0 auto 8px", textAlign: "center" }}>
        Creating for user: <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{currentUser ?? "None selected"}</span>
      </div>

      <input
        type="text"
        placeholder="Event Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={styles.input}
      />

      <input
        type="text"
        placeholder="Event URL"
        value={eventUrl}
        onChange={(e) => setEventUrl(e.target.value)}
        style={styles.input}
      />

      {/* Floor Section buttons */}
      <div style={{ width: "100%", maxWidth: 285, marginBottom: 16 }}>
        {/*<div style={{ marginBottom: 6, fontSize: 14 }}>Floor Section</div>*/}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {FLOOR_SECTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScreenId(opt.id)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: screenId === opt.id ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
                color: screenId === opt.id ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                border: screenId === opt.id ? '2px solid hsl(var(--ring))' : '1px solid hsl(var(--border))',
                fontSize: 14,
                lineHeight: 1.2,
              }}
              aria-pressed={screenId === opt.id}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        placeholder="Row (e.g., M)"
        value={row}
        onChange={(e) => setRow(e.target.value.toUpperCase())}
        style={styles.input}
      />

      <input
        type="number"
        placeholder="Ticket Price"
        value={expectedPrice}
        onChange={(e) => setExpectedPrice(e.target.value === "" ? "" : Number(e.target.value))}
        style={styles.input}
      />

      {/* L/C/R Section buttons */}
      <div style={{ width: "100%", maxWidth: 285, marginBottom: 16 }}>
        {/* <div style={{ marginBottom: 6, fontSize: 14 }}>L/C/R Section</div> */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {LCR_SECTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSection(opt.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: section === opt.value ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
                color: section === opt.value ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                border: section === opt.value ? '2px solid hsl(var(--ring))' : '1px solid hsl(var(--border))',
              }}
              aria-pressed={section === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="number"
        placeholder="Group Size"
        value={groupSize}
        onChange={(e) => setGroupSize(Number(e.target.value))}
        style={styles.input}
        min={1}
      />

      <button onClick={submitForm} style={styles.button}>
        Submit
      </button>

      {successMessage && <p style={styles.successMessage}>{successMessage}</p>}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: 315,
    padding: "16px",
    margin: "0 auto",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  input: {
    width: "100%",
    maxWidth: 285,
    padding: "10px",
    fontSize: "16px",
    marginBottom: "16px",
    borderRadius: "5px",
    border: "1px solid hsl(var(--border))",
    textAlign: "left",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    maxWidth: 285,
    padding: "10px",
    fontSize: "16px",
    backgroundColor: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    border: "1px solid hsl(var(--ring))",
    borderRadius: "5px",
    cursor: "pointer",
    textAlign: "center",
    boxSizing: "border-box",
    marginTop: 4,
  },
  response: {
    marginTop: "20px",
    textAlign: "left",
    width: "100%",
    maxWidth: "285px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowX: "auto",
    boxSizing: "border-box",
  },
  successMessage: {
    color: "green",
    marginTop: "10px",
    fontSize: "16px",
    fontWeight: "bold",
  },
};
import { useState } from "react";
import { API_URL } from "../util/constants";

const FLOOR_SECTIONS: { label: string; id: number }[] = [
  { label: "Main Floor", id: 1 },
  { label: "Main Floor R", id: 2 },
  { label: "Tier 1", id: 3 },
  { label: "Tier 2", id: 4 },
  { label: "Tier 3", id: 5 },
];

export default function EventForm() {
  const [name, setName] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [screenId, setScreenId] = useState<number | null>(null); // Floor Section
  const [row, setRow] = useState("");
  const [section, setSection] = useState<"left" | "center" | "right">("center"); // L/C/R
  const [groupSize, setGroupSize] = useState(1);
  const [expectedPrice, setExpectedPrice] = useState<number | "">("");
  type CreateEventResponse = { message?: string; event?: unknown; error?: string } | null;
  const [response, setResponse] = useState<CreateEventResponse>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const submitForm = async () => {
    if (!eventUrl.trim()) {
      setSuccessMessage("Please enter the Event URL ❌");
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
      }),
    });

      const data = await res.json();
      setResponse(data);

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

        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setSuccessMessage("Failed to create event ❌");
      }
    } catch (error) {
      console.error("Error submitting event:", error);
      setSuccessMessage("An error occurred ❌");
    }
  };

  const isValid = name.trim() && eventUrl.trim() && screenId != null && section && groupSize >= 1 && expectedPrice !== "";

  return (
    <div style={styles.container}>
      <h2
        style={{
          color: "white",
          fontWeight: "bold",
          fontSize: "24px",
          textAlign: "center",
          paddingRight: 0,
        }}
      >
        Event Form
      </h2>

      <div style={{ width: "100%", maxWidth: 380, fontSize: 14, marginBottom: 4 }}>Event Name</div>
      <input
        type="text"
        placeholder="Event Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={styles.input}
      />

      <div style={{ width: "100%", maxWidth: 380, fontSize: 14, marginBottom: 4 }}>Event URL</div>
      <input
        type="text"
        placeholder="Event URL (e.g., https://my.arttix.org/35839/35884)"
        value={eventUrl}
        onChange={(e) => setEventUrl(e.target.value)}
        style={styles.input}
      />

      {/* Floor Section buttons */}
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 6, fontSize: 14 }}>Floor Section</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FLOOR_SECTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScreenId(opt.id)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                cursor: "pointer",
                background: screenId === opt.id ? "#eee" : "white",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 380, fontSize: 14, marginBottom: 4 }}>Row</div>
      <input
        type="text"
        placeholder="Row (e.g., M)"
        value={row}
        onChange={(e) => setRow(e.target.value.toUpperCase())}
        style={styles.input}
      />

      <div style={{ width: "100%", maxWidth: 380, fontSize: 14, marginBottom: 4 }}>Expected Price</div>
      <input
        type="number"
        placeholder="Expected Price"
        value={expectedPrice}
        onChange={(e) => setExpectedPrice(e.target.value === "" ? "" : Number(e.target.value))}
        style={styles.input}
        min={0}
        step="0.01"
      />

      <div style={{ width: "100%", maxWidth: 380, fontSize: 14, marginBottom: 4 }}>L/C/R Section</div>
      <select
        value={section}
        onChange={(e) => setSection(e.target.value as "left" | "center" | "right")}
        style={styles.input}
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </select>

      <div style={{ width: "100%", maxWidth: 380, fontSize: 14, marginBottom: 4 }}>Number of Seats</div>
      <input
        type="number"
        placeholder="Group Size"
        value={groupSize}
        onChange={(e) => setGroupSize(Number(e.target.value))}
        style={styles.input}
        min={1}
      />

      <button onClick={submitForm} style={styles.button} disabled={!isValid}>
        Submit
      </button>

      {successMessage && <p style={styles.successMessage}>{successMessage}</p>}
      {response && <pre style={styles.response}>{JSON.stringify(response, null, 2)}</pre>}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    padding: 16,
    margin: "0 auto",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  input: {
    width: "100%",
    maxWidth: 380,
    padding: "10px",
    fontSize: "16px",
    marginBottom: "10px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    textAlign: "left",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    maxWidth: 380,
    padding: "10px",
    fontSize: "16px",
    backgroundColor: "white",
    color: "black",
    border: "1px solid black",
    borderRadius: "5px",
    cursor: "pointer",
    textAlign: "center",
    boxSizing: "border-box",
  },
  response: {
    marginTop: "20px",
    textAlign: "left",
    width: "100%",
    maxWidth: 380,
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
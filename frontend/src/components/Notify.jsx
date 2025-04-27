import React, { useState } from "react";

// List of states + Washington D.C.
const states = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", 
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", 
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", 
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", 
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", 
  "West Virginia", "Wisconsin", "Wyoming", "Washington D.C."
];

function Notify() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!email || !email.includes("@") || !state) {
      alert("Please enter a valid email and select a state.");
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/api/notifyme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({"email": email, "location": state})
      });

      if (response.ok) {
        setIsSubmitted(true); // Update state to show success message
      } else {
        alert("Something went wrong. Please try again.");
        console.log(response);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <div
      style={{
        height: "90vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "2em", marginBottom: "20px", color: "#4CAF50" }}>
        Get Notified!
      </h1>
      <p style={{ fontSize: "1.2em", maxWidth: "600px", textAlign: "center" }}>
        Sign up to receive updates and notifications from WasteWatchers. Stay
        informed about new data releases, important trends, and alerts in your
        area!
      </p>

      {/* Form or success message */}
      {!isSubmitted ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "10px",
              fontSize: "1em",
              marginBottom: "10px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "300px",
            }}
          />
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{
              padding: "10px",
              fontSize: "1em",
              marginBottom: "10px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "300px",
            }}
          >
            <option value="">Select a State</option>
            {states.map((stateName, index) => (
              <option key={index} value={stateName}>
                {stateName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1em",
            }}
          >
            Submit
          </button>
        </form>
      ) : (
        <p style={{ fontSize: "1.5em", color: "#4CAF50", fontWeight: "bold" }}>
          You will now be informed!
        </p>
      )}
    </div>
  );
}

export default Notify;

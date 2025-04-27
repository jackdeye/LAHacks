import React from "react";

function Notify() {
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
      {/* You can later add a signup form here */}
    </div>
  );
}

export default Notify;

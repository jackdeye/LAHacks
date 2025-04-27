import React from "react";

function Information() {
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
        About WasteWatchers
      </h1>
      <p style={{ fontSize: "1.2em", maxWidth: "600px", textAlign: "center" }}>
        WasteWatchers helps communities stay informed about wastewater trends
        and risk levels. Our platform visualizes real-time data to assist public
        health efforts and raise awareness about local conditions.
      </p>
      {/* You can add more detailed information later */}
    </div>
  );
}

export default Information;

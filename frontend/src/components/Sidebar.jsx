import React from "react";

function Sidebar({ selectedState }) {
  return (
    <div
      style={{
        width: "33%", // 1/3 of page
        height: "100vh",
        backgroundColor: "white",
        color: "black",
        padding: "20px",
        boxShadow: "2px 0px 6px rgba(0,0,0,0.1)",
        flexDirection: "column",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        fontSize: "24px",
        fontWeight: "bold",
      }}
    >
      <div>MEOW</div>
      <div>{selectedState}</div>
      <div>Graphs / Stats Here</div>
    </div>
  );
}

export default Sidebar;

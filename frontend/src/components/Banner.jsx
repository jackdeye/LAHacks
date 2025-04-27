import React from "react";
import { Link } from "react-router-dom"; // 🌟 Import Link from react-router-dom
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faInfoCircle } from "@fortawesome/free-solid-svg-icons";

function Banner() {
  return (
    <div
      className="banner"
      style={{
        backgroundColor: "#4a90e2",
        height: "7vh",
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        fontSize: "1em",
        fontFamily: "Arial, sans-serif",
        fontWeight: "bold",
        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Left side: Home link */}
      <Link
        to="/"
        style={{
          color: "white",
          textDecoration: "none",
          fontSize: "1.5em",
          fontWeight: "bold",
        }}
      >
        WasteWatchers
      </Link>

      {/* Right side: Get Notified and Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: "0.6em",
        }}
      >
        <Link
          to="/signup"
          style={{
            color: "white",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: "normal",
            fontSize: "2em",
          }}
        >
          <FontAwesomeIcon icon={faBell} style={{ marginRight: "8px" }} />
        </Link>

        <Link
          to="/info"
          style={{
            color: "white",
            textDecoration: "none",
            fontWeight: "normal",
            fontSize: "2em",
          }}
        >
          <FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: "8px" }} />
        </Link>
      </div>
    </div>
  );
}

export default Banner;

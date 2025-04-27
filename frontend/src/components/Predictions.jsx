import { useState, useEffect } from 'react';

const buttonStyle = {
  padding: "10px",
  backgroundColor: "#4a90e2",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  outline: "none",
  transition: "opacity 0.3s ease",
};

function Predictions({ onWeekSelect }) {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleWeekClick = (weekNumber) => {
    if (!predictions) return;

    if (onWeekSelect) { // Check if the prop was actually passed
      const weekData = predictions.predictions.reduce((acc, state) => {
        const value = state[`week_${weekNumber}_prediction`];
        if (value !== null) {
          acc[state.state] = value;
        }
        return acc;
      }, {});
      onWeekSelect(weekNumber, weekData); // Call the passed-in function
    }
    console.log(`Week ${weekNumber} clicked.`);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Reset loading state on fetch
      setError(null); // Reset error state on fetch
      try {
        const response = await fetch('http://localhost:8000/api/predictions');
        if (!response.ok) {
          throw new Error(`Network response was not ok (${response.status})`);
        }
        const data = await response.json();
        // Ensure data has the expected structure before setting
        if (data && data.predictions) {
          setPredictions(data);
        } else {
          throw new Error("Fetched data format is incorrect");
        }
      } catch (err) {
        console.error("Fetch error:", err); // Log the error for debugging
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array means this runs once on mount

  if (loading) return <div>Loading predictions...</div>;
  if (error) return <div>Error loading predictions: {error}</div>;
  if (!predictions || !predictions.predictions) return <div>No prediction data available.</div>;


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Generate buttons dynamically if possible, or keep static if fixed */}
      <button
        style={buttonStyle}
        onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.target.style.opacity = "1")}
        onClick={() => handleWeekClick(1)}
      >
        Week 1
      </button>
      <button
        style={buttonStyle}
        onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.target.style.opacity = "1")}
        onClick={() => handleWeekClick(2)}
      >
        Week 2
      </button>
      <button
        style={buttonStyle}
        onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.target.style.opacity = "1")}
        onClick={() => handleWeekClick(3)}
      >
        Week 3
      </button>
      <button
        style={buttonStyle}
        onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.target.style.opacity = "1")}
        onClick={() => handleWeekClick(4)}
      >
        Week 4
      </button>
    </div>
  );
}

export default Predictions;

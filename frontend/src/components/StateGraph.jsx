import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  Label,
} from "recharts";
import { format, parseISO } from "date-fns"; // We'll use date-fns to format dates easily

const StateTimeSeriesGraph = ({ stateName }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stateName) return;

    const fetchData = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/state?state=${encodeURIComponent(stateName)}&history=true`
        );
        if (!response.ok) throw new Error("Failed to fetch data");

        const result = await response.json();

        const parsedData = result.map(item => ({
          ...item,
          ending_date: item.ending_date, // Keep full date string, we'll format later
        }));

        setData(parsedData);
      } catch (error) {
        console.error("Error fetching state data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stateName]);

  if (loading) return <div>Loading...</div>;
  if (!data.length) return <div>No data available.</div>;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="ending_date"
          tickFormatter={(tick) => format(parseISO(tick), "MMM yyyy")}
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10 }}>
          <Label
            angle={-90}
            position="insideLeft"
            style={{ textAnchor: 'middle', fontSize: 12 }}
          >
            WVAL
          </Label>
        </YAxis>
        <Tooltip
          labelFormatter={(label) => format(parseISO(label), "MMM dd, yyyy")}
          contentStyle={{
            fontSize: '10px',
            padding: '5px 8px',
            borderRadius: '4px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
          }}
          itemStyle={{
            fontSize: '10px',
            marginBottom: '2px',
          }}
          labelStyle={{
            fontSize: '10px',
            marginBottom: '4px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="state_territory_wval"
          stroke="#8884d8"
          name="State Value"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="national_wval"
          stroke="#82ca9d"
          name="National Average"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="regional_wval"
          stroke="#ffc658"
          name="Regional Average"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default StateTimeSeriesGraph;

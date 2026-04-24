import { useState, useEffect } from "react"
import axios from "axios"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

// Sample historical data for charts
const sampleHistory = [
  { time: "Day 1",  b1: 100, b2: 100, b3: 100, b4: 100 },
  { time: "Day 5",  b1: 98,  b2: 97,  b3: 99,  b4: 95  },
  { time: "Day 10", b1: 95,  b2: 94,  b3: 98,  b4: 88  },
  { time: "Day 15", b1: 92,  b2: 91,  b3: 96,  b4: 75  },
  { time: "Day 20", b1: 90,  b2: 89,  b3: 94,  b4: 60  },
  { time: "Day 25", b1: 87,  b2: 85,  b3: 90,  b4: 45  },
  { time: "Day 30", b1: 83,  b2: 80,  b3: 85,  b4: 35  },
  { time: "Day 34", b1: 80,  b2: 53,  b3: 0,   b4: 24  },
]

function HealthCard({ name, health, status, rms, threshold }) {
  const color =
    status === "healthy"  ? "#1D9E75" :
    status === "monitor"  ? "#378ADD" :
    status === "warning"  ? "#EF9F27" : "#E24B4A"

  const bg =
    status === "healthy"  ? "#E1F5EE" :
    status === "monitor"  ? "#E6F1FB" :
    status === "warning"  ? "#FAEEDA" : "#FAECE7"

  return (
    <div style={{
      background: "white",
      border: `2px solid ${color}`,
      borderRadius: "12px",
      padding: "20px",
      flex: 1,
      minWidth: "200px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{name}</h3>
        <span style={{
          background: bg,
          color: color,
          padding: "3px 10px",
          borderRadius: "99px",
          fontSize: "12px",
          fontWeight: 500,
          textTransform: "capitalize"
        }}>{status}</span>
      </div>

      {/* Health score circle */}
      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: bg,
          border: `4px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto"
        }}>
          <span style={{ fontSize: "22px", fontWeight: 700, color }}>{Math.round(health)}</span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#888" }}>Health Score</p>
      </div>

      <div style={{ fontSize: "12px", color: "#666" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>RMS Vibration</span>
          <span style={{ fontWeight: 500 }}>{rms}g</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Threshold</span>
          <span style={{ fontWeight: 500 }}>{threshold}g</span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [trained, setTrained] = useState(false)
  const [error, setError] = useState(null)

  // Check if API is running
  useEffect(() => {
    axios.get(`${API_URL}/health`)
      .then(res => setTrained(res.data.predictor_trained))
      .catch(() => setError("Cannot connect to API. Make sure the backend is running."))
  }, [])

  const trainModel = async () => {
    setLoading(true)
    setError(null)
    try {
      await axios.post(`${API_URL}/train`)
      setTrained(true)
    } catch (e) {
      setError("Training failed. Check your backend.")
    }
    setLoading(false)
  }

  const runPrediction = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use the failure readings to demo the alert
      const res = await axios.post(`${API_URL}/predict`, {
        machine_id: "machine_001",
        timestamp: "2003-11-25T23:39:56",
        bearing1_rms: 0.172,
        bearing2_rms: 0.165,
        bearing3_rms: 0.5936,
        bearing4_rms: 0.210
      })
      setHealth(res.data)
    } catch (e) {
      setError("Prediction failed. Make sure model is trained.")
    }
    setLoading(false)
  }

  const runHealthyPrediction = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${API_URL}/predict`, {
        machine_id: "machine_001",
        timestamp: "2003-10-22T12:06:24",
        bearing1_rms: 0.1289,
        bearing2_rms: 0.1312,
        bearing3_rms: 0.1300,
        bearing4_rms: 0.1100
      })
      setHealth(res.data)
    } catch (e) {
      setError("Prediction failed. Make sure model is trained.")
    }
    setLoading(false)
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#F8F9FA", minHeight: "100vh", padding: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>OpenPMX</h1>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>
            Open-source predictive maintenance platform
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {!trained && (
            <button onClick={trainModel} disabled={loading} style={{
              background: "#1D9E75", color: "white", border: "none",
              padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
              fontSize: "14px", fontWeight: 500
            }}>
              {loading ? "Training..." : "Train Model"}
            </button>
          )}
          {trained && (
            <>
              <button onClick={runHealthyPrediction} disabled={loading} style={{
                background: "#1D9E75", color: "white", border: "none",
                padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: 500
              }}>
                {loading ? "Loading..." : "Simulate Healthy"}
              </button>
              <button onClick={runPrediction} disabled={loading} style={{
                background: "#E24B4A", color: "white", border: "none",
                padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: 500
              }}>
                {loading ? "Loading..." : "Simulate Failure"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: "#FAECE7", border: "1px solid #E24B4A",
          borderRadius: "8px", padding: "12px 16px",
          color: "#712B13", marginBottom: "16px", fontSize: "14px"
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Alert banner */}
      {health?.alert && (
        <div style={{
          background: "#FAECE7", border: "2px solid #E24B4A",
          borderRadius: "8px", padding: "16px",
          marginBottom: "16px", display: "flex",
          alignItems: "center", gap: "12px"
        }}>
          <span style={{fontSize:"24px"}}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: "#712B13" }}>CRITICAL ALERT — {health.machine_id}</div>
            <div style={{ fontSize: "14px", color: "#712B13" }}>{health.message}</div>
          </div>
        </div>
      )}

      {/* Healthy banner */}
      {health && !health.alert && (
        <div style={{
          background: "#E1F5EE", border: "2px solid #1D9E75",
          borderRadius: "8px", padding: "16px",
          marginBottom: "16px", display: "flex",
          alignItems: "center", gap: "12px"
        }}>
          <span style={{fontSize:"24px"}}>✅</span>
          <div>
            <div style={{ fontWeight: 600, color: "#085041" }}>ALL SYSTEMS HEALTHY — {health.machine_id}</div>
            <div style={{ fontSize: "14px", color: "#085041" }}>{health.message}</div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{
        background: "white", borderRadius: "12px", padding: "16px",
        marginBottom: "16px", display: "flex", gap: "24px",
        alignItems: "center", fontSize: "14px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>🟢</span>
          <span style={{ color: "#666" }}>API Status:</span>
          <span style={{ color: "#1D9E75", fontWeight: 500 }}>Connected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>🔄</span>
          <span style={{ color: "#666" }}>Model:</span>
          <span style={{ fontWeight: 500, color: trained ? "#1D9E75" : "#EF9F27" }}>
            {trained ? "Trained & Ready" : "Not Trained"}
          </span>
        </div>
        {health && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#666" }}>Overall Health:</span>
            <span style={{ fontWeight: 600, fontSize: "16px",
              color: health.overall_health >= 75 ? "#1D9E75" :
                     health.overall_health >= 50 ? "#378ADD" :
                     health.overall_health >= 25 ? "#EF9F27" : "#E24B4A"
            }}>
              {health.overall_health}/100
            </span>
          </div>
        )}
      </div>

      {/* Bearing health cards */}
      {health && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
          {Object.entries(health.bearings).map(([name, data]) => (
            <HealthCard
              key={name}
              name={name.replace("bearing", "Bearing ")}
              health={data.health_score}
              status={data.status}
              rms={data.rms}
              threshold={data.threshold}
            />
          ))}
        </div>
      )}

      {/* Degradation chart */}
      <div style={{ background: "white", borderRadius: "12px", padding: "20px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600 }}>
          Bearing Degradation History
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sampleHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" fontSize={12} />
            <YAxis domain={[0, 100]} fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="b1" stroke="#1D9E75" name="Bearing 1" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="b2" stroke="#378ADD" name="Bearing 2" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="b3" stroke="#E24B4A" name="Bearing 3" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="b4" stroke="#EF9F27" name="Bearing 4" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
const WS_URL = API_URL.replace("http", "ws").replace("https", "wss")

function HealthCard({ name, health, status, rms, threshold }) {
  const color =
    status === "healthy" ? "#1D9E75" :
    status === "monitor" ? "#378ADD" :
    status === "warning" ? "#EF9F27" : "#E24B4A"

  const bg =
    status === "healthy" ? "#E1F5EE" :
    status === "monitor" ? "#E6F1FB" :
    status === "warning" ? "#FAEEDA" : "#FAECE7"

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
          background: bg, color: color,
          padding: "3px 10px", borderRadius: "99px",
          fontSize: "12px", fontWeight: 500, textTransform: "capitalize"
        }}>{status}</span>
      </div>
      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: bg, border: `4px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
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
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const wsRef = useRef(null)
  const pingRef = useRef(null)

  useEffect(() => {
    connectWebSocket()
    checkHealth()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (pingRef.current) clearInterval(pingRef.current)
    }
  }, [])

  const loadHistory = async () => {
    try {
      const histRes = await axios.get(`${API_URL}/history/machine_001`)
      if (histRes.data.readings.length > 0) {
        const historyData = histRes.data.readings.map(r => ({
          time: new Date(r.timestamp).toLocaleTimeString(),
          overall: r.overall_health,
          b1: r.bearing1_health,
          b2: r.bearing2_health,
          b3: r.bearing3_health,
          b4: r.bearing4_health,
        }))
        setHistory(historyData)
        console.log("History loaded:", historyData.length, "readings")
      }
    } catch (e) {
      console.error("Failed to load history:", e)
    }
  }

  const checkHealth = async () => {
    try {
      const res = await axios.get(`${API_URL}/health`)
      setTrained(res.data.predictor_trained)
      if (res.data.predictor_trained) {
        await loadHistory()
      }
    } catch (e) {
      setError("Cannot connect to API. Make sure the backend is running.")
    }
  }

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        console.log("WebSocket connected!")
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping")
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === "connected") {
          setTrained(data.predictor_trained)
          if (data.predictor_trained) {
            loadHistory()
          }
        } else if (data.type === "reading") {
          setHealth(data)
          setLastUpdate(new Date().toLocaleTimeString())
          setTrained(true)
          const newPoint = {
            time: new Date(data.timestamp).toLocaleTimeString(),
            overall: data.overall_health,
            b1: data.bearings.bearing1.health_score,
            b2: data.bearings.bearing2.health_score,
            b3: data.bearings.bearing3.health_score,
            b4: data.bearings.bearing4.health_score,
          }
          setHistory(prev => {
            const updated = [...prev, newPoint]
            return updated.slice(-50)
          })
        } else if (data.type === "pong") {
          console.log("Ping/pong OK")
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (pingRef.current) clearInterval(pingRef.current)
        setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = () => {
        setConnected(false)
      }
    } catch (e) {
      setConnected(false)
    }
  }

  const trainModel = async () => {
    setLoading(true)
    setError(null)
    try {
      await axios.post(`${API_URL}/train`)
      setTrained(true)
      await loadHistory()
    } catch (e) {
      setError("Training failed. Check your backend.")
    }
    setLoading(false)
  }

  const runPrediction = async (scenario) => {
    setLoading(true)
    setError(null)
    setHealth(null)
    const readings = scenario === "failure"
      ? { machine_id: "machine_001", timestamp: "2003-11-25T23:39:56", bearing1_rms: 0.172, bearing2_rms: 0.165, bearing3_rms: 0.5936, bearing4_rms: 0.210 }
      : { machine_id: "machine_001", timestamp: "2003-10-22T12:06:24", bearing1_rms: 0.1289, bearing2_rms: 0.1312, bearing3_rms: 0.1300, bearing4_rms: 0.1100 }

    try {
      const res = await axios.post(`${API_URL}/predict`, readings)
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
              <button onClick={() => runPrediction("healthy")} disabled={loading} style={{
                background: "#1D9E75", color: "white", border: "none",
                padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: 500
              }}>
                {loading ? "Loading..." : "Simulate Healthy"}
              </button>
              <button onClick={() => runPrediction("failure")} disabled={loading} style={{
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
          <span style={{ fontSize: "24px" }}>⚠️</span>
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
          <span style={{ fontSize: "24px" }}>✅</span>
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
        alignItems: "center", fontSize: "14px", flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#1D9E75" : "#E24B4A", display: "inline-block" }}></span>
          <span style={{ color: "#666" }}>WebSocket:</span>
          <span style={{ color: connected ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>
            {connected ? "Live" : "Reconnecting..."}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
        {lastUpdate && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#666" }}>Last update:</span>
            <span style={{ fontWeight: 500 }}>{lastUpdate}</span>
          </div>
        )}
      </div>

      {/* Bearing health cards */}
      {health && health.bearings && (
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

      {/* Real-time degradation chart */}
      <div style={{ background: "white", borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
            Real-time Health History
          </h2>
          <span style={{ fontSize: "12px", color: "#888" }}>
            {history.length > 0 ? `${history.length} readings` : "Waiting for data..."}
          </span>
        </div>
        {history.length > 0 ? (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg width="100%" height="300" viewBox={`0 0 ${Math.max(history.length * 20, 600)} 300`}>
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(v => (
                <g key={v}>
                  <line
                    x1="40" y1={260 - v * 2.2}
                    x2={Math.max(history.length * 20, 600)} y2={260 - v * 2.2}
                    stroke="#f0f0f0" strokeWidth="1"
                  />
                  <text x="35" y={264 - v * 2.2} fontSize="10" fill="#888" textAnchor="end">{v}</text>
                </g>
              ))}

              {/* Lines for each bearing */}
              {["b1", "b2", "b3", "b4"].map((key, idx) => {
                const colors = ["#1D9E75", "#378ADD", "#E24B4A", "#EF9F27"]
                const points = history.map((h, i) => `${40 + i * 20},${260 - (h[key] || 0) * 2.2}`).join(" ")
                return (
                  <polyline
                    key={key}
                    points={points}
                    fill="none"
                    stroke={colors[idx]}
                    strokeWidth="2"
                  />
                )
              })}

              {/* Legend */}
              {["Bearing 1", "Bearing 2", "Bearing 3", "Bearing 4"].map((name, idx) => {
                const colors = ["#1D9E75", "#378ADD", "#E24B4A", "#EF9F27"]
                return (
                  <g key={name}>
                    <line x1={50 + idx * 100} y1="15" x2={75 + idx * 100} y2="15" stroke={colors[idx]} strokeWidth="2" />
                    <text x={80 + idx * 100} y="19" fontSize="11" fill="#666">{name}</text>
                  </g>
                )
              })}
            </svg>
          </div>
        ) : (
          <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px" }}>
            {trained ? `History loaded: ${history.length} readings — send new readings to see chart` : "Train the model first, then send readings"}
          </div>
        )}
      </div>

    </div>
  )
}
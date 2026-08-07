import { useState, useEffect, useRef } from "react"
import axios from "axios"

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
  const [csvLoading, setCsvLoading] = useState(false)
  const [trained, setTrained] = useState(false)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [csvResult, setCsvResult] = useState(null)
  const [oee, setOee] = useState(null)
  const [downtime, setDowntime] = useState([])
  const wsRef = useRef(null)
  const pingRef = useRef(null)

  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [emailConfig, setEmailConfig] = useState({
  emails: "",
  smtp_server: "smtp.gmail.com",
  smtp_port: 465,
  smtp_username: "",
  smtp_password: "",
  use_ssl: true
})


const [emailSaved, setEmailSaved] = useState(false)

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
      }
    } catch (e) {
      console.error("Failed to load history:", e)
    }
  }

  const loadOEE = async () => {
    try {
      const oeeRes = await axios.get(`${API_URL}/oee/machine_001`)
      setOee(oeeRes.data)
      const dtRes = await axios.get(`${API_URL}/downtime/machine_001`)
      setDowntime(dtRes.data.downtime_events)
    } catch (e) {
      console.error("Failed to load OEE:", e)
    }
  }

  const saveEmailConfig = async () => {
  try {
    const emails = emailConfig.emails.split(",").map(e => e.trim()).filter(e => e)
    await axios.post(`${API_URL}/configure-alerts`, {
      ...emailConfig,
      emails,
      smtp_port: parseInt(emailConfig.smtp_port)
    })
    setEmailSaved(true)
    setTimeout(() => setEmailSaved(false), 3000)
  } catch (e) {
    setError("Failed to save email configuration")
  }
}

const sendTestAlert = async () => {
  try {
    const emails = emailConfig.emails.split(",").map(e => e.trim()).filter(e => e)
    if (emails.length === 0) {
      setError("Please enter at least one email address")
      return
    }
    await axios.post(`${API_URL}/test-alert?email=${emails[0]}`)
    alert("Test alert sent! Check your inbox.")
  } catch (e) {
    setError("Failed to send test alert. Check your email configuration.")
  }
}
  
  const checkHealth = async () => {
    try {
      const res = await axios.get(`${API_URL}/health`)
      setTrained(res.data.predictor_trained)
      if (res.data.predictor_trained) {
        await loadHistory()
        await loadOEE()
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
          if (data.predictor_trained) loadHistory()
        } else if (data.type === "reading") {
          setHealth(data)
          setLastUpdate(new Date().toLocaleTimeString())
          setTrained(true)
          loadOEE()
          const newPoint = {
            time: new Date(data.timestamp).toLocaleTimeString(),
            overall: data.overall_health,
            b1: data.bearings.bearing1.health_score,
            b2: data.bearings.bearing2.health_score,
            b3: data.bearings.bearing3.health_score,
            b4: data.bearings.bearing4.health_score,
          }
          setHistory(prev => [...prev, newPoint].slice(-50))
        } else if (data.type === "pong") {
          console.log("Ping/pong OK")
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (pingRef.current) clearInterval(pingRef.current)
        setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = () => setConnected(false)

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

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setCsvLoading(true)
    setError(null)
    setCsvResult(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await axios.post(`${API_URL}/upload-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      setTrained(true)
      setCsvResult(res.data)
      await loadHistory()
    } catch (e) {
      setError(e.response?.data?.detail || "CSV upload failed. Check your file format.")
    }
    setCsvLoading(false)
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
<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
  {!trained && (
    <>
      <button onClick={trainModel} disabled={loading} style={{
        background: "#1D9E75", color: "white", border: "none",
        padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
        fontSize: "14px", fontWeight: 500
      }}>
        {loading ? "Training..." : "Train on NASA Data"}
      </button>
      <label style={{
        background: "#378ADD", color: "white", border: "none",
        padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
        fontSize: "14px", fontWeight: 500, display: "inline-block"
      }}>
        {csvLoading ? "Uploading..." : "📂 Upload Your CSV"}
        <input
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleCSVUpload}
        />
      </label>
    </>
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
  {/* Alert Settings — always visible */}
  <button onClick={() => setShowEmailConfig(!showEmailConfig)} style={{
    background: "white", color: "#555", border: "1px solid #ddd",
    padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
    fontSize: "14px", fontWeight: 500
  }}>
    ⚙️ Alert Settings
  </button>
</div>

      {/* CSV Upload Result */}
      {csvResult && (
        <div style={{
          background: "#E1F5EE", border: "2px solid #1D9E75",
          borderRadius: "8px", padding: "16px", marginBottom: "16px"
        }}>
          <div style={{ fontWeight: 600, color: "#085041", marginBottom: "8px" }}>
            ✅ Model trained on your data!
          </div>
          <div style={{ fontSize: "13px", color: "#085041" }}>
            <div>📊 Detected columns: <strong>{csvResult.columns_detected?.join(", ")}</strong></div>
            <div>📁 Total rows: <strong>{csvResult.total_rows}</strong></div>
            <div>🎯 Training rows: <strong>{csvResult.training_rows}</strong></div>
            <div style={{ marginTop: "8px" }}>
              Overall health: <strong>{csvResult.latest_health?.overall_health}/100</strong>
            </div>
          </div>
        </div>
      )}

      
      
      
      {/* Error banner */}
{/* Email Configuration Panel */}
{showEmailConfig && (
  <div style={{
    background: "white", border: "1px solid #ddd",
    borderRadius: "12px", padding: "20px", marginBottom: "16px"
  }}>
    <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600 }}>
      ⚙️ Alert Email Configuration
    </h2>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "4px" }}>
          Recipient Emails (comma separated)
        </label>
        <input
          type="text"
          placeholder="maintenance@factory.com, manager@factory.com"
          value={emailConfig.emails}
          onChange={e => setEmailConfig({...emailConfig, emails: e.target.value})}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box"
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "4px" }}>
          SMTP Server
        </label>
        <input
          type="text"
          value={emailConfig.smtp_server}
          onChange={e => setEmailConfig({...emailConfig, smtp_server: e.target.value})}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box"
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "4px" }}>
          SMTP Port
        </label>
        <input
          type="number"
          value={emailConfig.smtp_port}
          onChange={e => setEmailConfig({...emailConfig, smtp_port: e.target.value})}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box"
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "4px" }}>
          Email Username
        </label>
        <input
          type="email"
          placeholder="your.email@gmail.com"
          value={emailConfig.smtp_username}
          onChange={e => setEmailConfig({...emailConfig, smtp_username: e.target.value})}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box"
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "4px" }}>
          App Password
        </label>
        <input
          type="password"
          placeholder="Gmail app password (no spaces)"
          value={emailConfig.smtp_password}
          onChange={e => setEmailConfig({...emailConfig, smtp_password: e.target.value})}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box"
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={emailConfig.use_ssl}
          onChange={e => setEmailConfig({...emailConfig, use_ssl: e.target.checked})}
          id="use_ssl"
        />
        <label htmlFor="use_ssl" style={{ fontSize: "13px", color: "#666" }}>
          Use SSL (recommended for Gmail)
        </label>
      </div>

    </div>

    <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
      <button onClick={saveEmailConfig} style={{
        background: "#1D9E75", color: "white", border: "none",
        padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
        fontSize: "14px", fontWeight: 500
      }}>
        💾 Save Configuration
      </button>
      <button onClick={sendTestAlert} style={{
        background: "#378ADD", color: "white", border: "none",
        padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
        fontSize: "14px", fontWeight: 500
      }}>
        📧 Send Test Alert
      </button>
    </div>

    {emailSaved && (
      <div style={{ marginTop: "12px", color: "#1D9E75", fontSize: "13px", fontWeight: 500 }}>
        ✅ Email configuration saved successfully!
      </div>
    )}

    <div style={{ marginTop: "12px", padding: "10px", background: "#F8F9FA", borderRadius: "6px", fontSize: "12px", color: "#666" }}>
      <strong>Gmail setup:</strong> Use your Gmail address as username. For password, create an App Password at 
      <a href="https://myaccount.google.com/apppasswords" target="_blank" style={{ color: "#378ADD" }}> myaccount.google.com/apppasswords</a>. 
      Remove spaces from the 16-character password before entering.
    </div>
  </div>
)}


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


      {/* OEE Widget */}
{oee && (
  <div style={{ background: "white", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
    <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600 }}>
      Overall Equipment Effectiveness (OEE) — Last 24 hours
    </h2>
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
      
      {/* OEE Score */}
      <div style={{
        flex: 1, minWidth: "140px", textAlign: "center",
        background: oee.oee >= 85 ? "#E1F5EE" : oee.oee >= 60 ? "#FAEEDA" : "#FAECE7",
        borderRadius: "12px", padding: "20px"
      }}>
        <div style={{
          fontSize: "42px", fontWeight: 700,
          color: oee.oee >= 85 ? "#1D9E75" : oee.oee >= 60 ? "#EF9F27" : "#E24B4A"
        }}>{oee.oee}%</div>
        <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>OEE Score</div>
        <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
          {oee.oee >= 85 ? "World class" : oee.oee >= 60 ? "Average" : "Needs improvement"}
        </div>
      </div>

      {/* Availability */}
      <div style={{
        flex: 1, minWidth: "140px", textAlign: "center",
        background: "#E6F1FB", borderRadius: "12px", padding: "20px"
      }}>
        <div style={{ fontSize: "42px", fontWeight: 700, color: "#378ADD" }}>{oee.availability}%</div>
        <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>Availability</div>
        <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
          Uptime: {Math.round(oee.uptime_minutes / 60)}h {Math.round(oee.uptime_minutes % 60)}m
        </div>
      </div>

      {/* Downtime */}
      <div style={{
        flex: 1, minWidth: "140px", textAlign: "center",
        background: oee.total_downtime_minutes > 0 ? "#FAECE7" : "#E1F5EE",
        borderRadius: "12px", padding: "20px"
      }}>
        <div style={{
          fontSize: "42px", fontWeight: 700,
          color: oee.total_downtime_minutes > 0 ? "#E24B4A" : "#1D9E75"
        }}>
          {Math.round(oee.total_downtime_minutes)}m
        </div>
        <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>Total Downtime</div>
        <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
          {oee.downtime_events_count} event{oee.downtime_events_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Machine Status */}
      <div style={{
        flex: 1, minWidth: "140px", textAlign: "center",
        background: oee.machine_currently_down ? "#FAECE7" : "#E1F5EE",
        borderRadius: "12px", padding: "20px"
      }}>
        <div style={{ fontSize: "36px", marginBottom: "8px" }}>
          {oee.machine_currently_down ? "🔴" : "🟢"}
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600,
          color: oee.machine_currently_down ? "#E24B4A" : "#1D9E75"
        }}>
          {oee.machine_currently_down ? "Machine Down" : "Machine Running"}
        </div>
      </div>

    </div>

    {/* Downtime events table */}
    {downtime.length > 0 && (
      <div>
        <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px" }}>Recent Downtime Events</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#F8F9FA" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #eee" }}>Start Time</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #eee" }}>Duration</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #eee" }}>Cause</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #eee" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {downtime.slice(0, 5).map((event, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 12px" }}>
                  {new Date(event.start_time).toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {event.duration_minutes ? `${Math.round(event.duration_minutes)} min` : "Ongoing"}
                </td>
                <td style={{ padding: "8px 12px", color: "#666" }}>
                  {event.cause?.substring(0, 40)}...
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{
                    background: event.resolved ? "#E1F5EE" : "#FAECE7",
                    color: event.resolved ? "#085041" : "#712B13",
                    padding: "2px 8px", borderRadius: "99px", fontSize: "11px"
                  }}>
                    {event.resolved ? "Resolved" : "Active"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
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
              {["Bearing 1", "Bearing 2", "Bearing 3", "Bearing 4"].map((name, idx) => {
                const colors = ["#1D9E75", "#378ADD", "#E24B4A", "#EF9F27"]
                return (
                  <g key={name}>
                    <line x1={50 + idx * 110} y1="15" x2={75 + idx * 110} y2="15" stroke={colors[idx]} strokeWidth="2" />
                    <text x={80 + idx * 110} y="19" fontSize="11" fill="#666">{name}</text>
                  </g>
                )
              })}
            </svg>
          </div>
        ) : (
          <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px" }}>
            {trained ? "Send sensor readings to see real-time chart" : "Train the model first, then send readings"}
          </div>
        )}
      </div>

    </div>
  )
}
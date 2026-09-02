import { useState, useEffect, useRef } from "react"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ?
    'http://localhost:8000' :
    `http://${window.location.hostname}:8000`)
const WS_URL = API_URL.replace("http", "ws").replace("https", "wss")

// Detect mobile
const isMobile = () => window.innerWidth < 768

function HealthCard({ name, health, status, rms, threshold }) {
  const color =
    status === "healthy" ? "#1D9E75" :
    status === "monitor" ? "#378ADD" :
    status === "warning" ? "#EF9F27" : "#E24B4A"

  const bg =
    status === "healthy" ? "#E1F5EE" :
    status === "monitor" ? "#E6F1FB" :
    status === "warning" ? "#FAEEDA" : "#FAECE7"

  const mobile = isMobile()

  return (
    <div style={{
      background: "white",
      border: `2px solid ${color}`,
      borderRadius: "12px",
      padding: mobile ? "12px" : "20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h3 style={{ margin: 0, fontSize: mobile ? "13px" : "16px", fontWeight: 600 }}>{name}</h3>
        <span style={{
          background: bg, color: color,
          padding: "2px 8px", borderRadius: "99px",
          fontSize: "11px", fontWeight: 500, textTransform: "capitalize"
        }}>{status}</span>
      </div>
      <div style={{ textAlign: "center", margin: "12px 0" }}>
        <div style={{
          width: mobile ? "60px" : "80px",
          height: mobile ? "60px" : "80px",
          borderRadius: "50%",
          background: bg, border: `4px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto"
        }}>
          <span style={{ fontSize: mobile ? "18px" : "22px", fontWeight: 700, color }}>{Math.round(health)}</span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#888" }}>Health Score</p>
      </div>
      <div style={{ fontSize: "11px", color: "#666" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
          <span>RMS</span>
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
  const [updateInfo, setUpdateInfo] = useState(null)
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
  const [showCostCalc, setShowCostCalc] = useState(false)
  const [costConfig, setCostConfig] = useState({
    hourly_rate: 1000,
    repair_cost: 5000
  })
  const [costSavings, setCostSavings] = useState(null)
  const [showMachineManager, setShowMachineManager] = useState(false)
  const [machines, setMachines] = useState([])
  const [selectedMachine, setSelectedMachine] = useState("machine_001")
  const [newMachine, setNewMachine] = useState({ machine_id: "", name: "", location: "" })
  const [mobile, setMobile] = useState(isMobile())
  const wsRef = useRef(null)
  const pingRef = useRef(null)

  // Handle resize
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    connectWebSocket()
    checkHealth()
    checkForUpdates()
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

  const loadMachines = async () => {
    try {
      const res = await axios.get(`${API_URL}/machines`)
      setMachines(res.data.machines)
    } catch (e) {
      console.error("Failed to load machines:", e)
    }
  }

  const checkHealth = async () => {
    try {
      const res = await axios.get(`${API_URL}/health`)
      setTrained(res.data.predictor_trained)
      if (res.data.predictor_trained) {
        await loadHistory()
        await loadOEE()
        await loadMachines()
      }
    } catch (e) {
      setError("Cannot connect to API. Make sure the backend is running.")
    }
  }

  const checkForUpdates = async () => {
    try {
      const res = await axios.get(`${API_URL}/check-updates`)
      if (res.data.update_available) {
        setUpdateInfo(res.data)
      }
    } catch (e) {
      console.log("Update check failed:", e)
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
          if (ws.readyState === WebSocket.OPEN) ws.send("ping")
        }, 30000)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === "connected") {
          setTrained(data.predictor_trained)
          if (data.predictor_trained) {
            loadHistory()
            loadOEE()
            loadMachines()
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
          setHistory(prev => [...prev, newPoint].slice(-50))
          loadOEE()
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
      await loadOEE()
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
      setError(e.response?.data?.detail || "CSV upload failed.")
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

  const saveEmailConfig = async () => {
    try {
      const emails = emailConfig.emails.split(",").map(e => e.trim()).filter(e => e)
      await axios.post(`${API_URL}/configure-alerts`, {
        ...emailConfig, emails, smtp_port: parseInt(emailConfig.smtp_port)
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
      if (emails.length === 0) { setError("Please enter at least one email address"); return }
      await axios.post(`${API_URL}/test-alert?email=${emails[0]}`)
      alert("Test alert sent! Check your inbox.")
    } catch (e) {
      setError("Failed to send test alert.")
    }
  }

  const generateWorkOrder = async () => {
    if (!health) { setError("Run a prediction first before generating a work order"); return }
    try {
      const readings = {
        machine_id: health.machine_id || "machine_001",
        timestamp: health.timestamp || new Date().toISOString(),
        bearing1_rms: health.bearings?.bearing1?.rms || 0.13,
        bearing2_rms: health.bearings?.bearing2?.rms || 0.13,
        bearing3_rms: health.bearings?.bearing3?.rms || 0.13,
        bearing4_rms: health.bearings?.bearing4?.rms || 0.13,
      }
      const res = await axios.post(`${API_URL}/generate-work-order`, readings, { responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `work-order-${Date.now()}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      setError("Failed to generate work order.")
    }
  }

  const calculateSavings = async () => {
    try {
      const res = await axios.get(`${API_URL}/oee/machine_001`)
      const oeeData = res.data
      const downtimeHours = oeeData.total_downtime_minutes / 60
      const downtimeCost = downtimeHours * costConfig.hourly_rate
      const repairCosts = oeeData.downtime_events_count * costConfig.repair_cost
      const totalSavings = downtimeCost + repairCosts
      setCostSavings({
        downtime_hours: downtimeHours.toFixed(1),
        downtime_cost: downtimeCost.toFixed(0),
        alerts_count: oeeData.downtime_events_count,
        repair_costs: repairCosts.toFixed(0),
        total_savings: totalSavings.toFixed(0),
        oee: oeeData.oee
      })
    } catch (e) {
      setError("Failed to calculate savings.")
    }
  }

  const generateMonthlyReport = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/generate-monthly-report?machine_id=machine_001&hourly_rate=${costConfig.hourly_rate}&repair_cost=${costConfig.repair_cost}`,
        {},
        { responseType: "blob" }
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `openpmx-monthly-report-${new Date().toISOString().slice(0,7)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      setError("Failed to generate monthly report.")
    }
  }

  const registerMachine = async () => {
    if (!newMachine.machine_id || !newMachine.name) { setError("Machine ID and name are required"); return }
    try {
      await axios.post(`${API_URL}/machines`, null, {
        params: { machine_id: newMachine.machine_id, name: newMachine.name, location: newMachine.location }
      })
      setNewMachine({ machine_id: "", name: "", location: "" })
      await loadMachines()
    } catch (e) {
      setError("Failed to register machine")
    }
  }

  const deleteMachine = async (machine_id) => {
    try {
      await axios.delete(`${API_URL}/machines/${machine_id}`)
      await loadMachines()
    } catch (e) {
      setError("Failed to delete machine")
    }
  }

  const btnStyle = {
    border: "none", cursor: "pointer", borderRadius: "8px",
    padding: mobile ? "8px 14px" : "10px 20px",
    fontSize: mobile ? "12px" : "14px", fontWeight: 500
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#F8F9FA", minHeight: "100vh", padding: mobile ? "12px" : "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: mobile ? "20px" : "24px", fontWeight: 700 }}>OpenPMX</h1>
          {!mobile && <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>Open-source predictive maintenance platform</p>}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {!trained && (
              <button onClick={trainModel} disabled={loading} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>
                {loading ? "Training..." : "Train Model"}
              </button>
          )}
            {/* CSV upload always visible */}
            <label style={{ ...btnStyle, background: "#378ADD", color: "white", display: "inline-block" }}>
              {csvLoading ? "Uploading..." : "📂 Upload CSV"}
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSVUpload} />
            </label>
          {trained && (
            <>
              <button onClick={() => runPrediction("healthy")} disabled={loading} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>
                {loading ? "..." : "✅ Healthy"}
              </button>
              <button onClick={() => runPrediction("failure")} disabled={loading} style={{ ...btnStyle, background: "#E24B4A", color: "white" }}>
                {loading ? "..." : "⚠️ Failure"}
              </button>
              <button onClick={generateWorkOrder} style={{ ...btnStyle, background: "#7F77DD", color: "white" }}>
                📋 {!mobile && "Work Order"}
              </button>
              <button onClick={generateMonthlyReport} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>
                📊 {!mobile && "Monthly Report"}
              </button>
              
            </>
          )}
          <button onClick={() => setShowEmailConfig(!showEmailConfig)} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
            ⚙️ {!mobile && "Alerts"}
          </button>
          <button onClick={() => setShowCostCalc(!showCostCalc)} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
            💰 {!mobile && "Savings"}
          </button>
          <button onClick={() => setShowMachineManager(!showMachineManager)} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
            🏭 {!mobile && "Machines"}
          </button>
        </div>
      </div>

      {/* CSV Result */}
      {csvResult && (
        <div style={{ background: "#E1F5EE", border: "2px solid #1D9E75", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
          <div style={{ fontWeight: 600, color: "#085041", marginBottom: "6px" }}>✅ Model trained on your data!</div>
          <div style={{ fontSize: "13px", color: "#085041" }}>
            <div>📊 Columns: <strong>{csvResult.columns_detected?.join(", ")}</strong></div>
            <div>📁 Rows: <strong>{csvResult.total_rows}</strong> | Overall health: <strong>{csvResult.latest_health?.overall_health}/100</strong></div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ background: "#FAECE7", border: "1px solid #E24B4A", borderRadius: "8px", padding: "12px 16px", color: "#712B13", marginBottom: "16px", fontSize: "13px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Update available banner */}
      {updateInfo && (
        <div style={{
          background: "#E6F1FB", border: "2px solid #378ADD",
          borderRadius: "8px", padding: "12px 16px",
          marginBottom: "16px", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🆕</span>
            <div>
              <div style={{ fontWeight: 600, color: "#0C447C", fontSize: "14px" }}>
                Update available — v{updateInfo.latest_version}
              </div>
              <div style={{ fontSize: "12px", color: "#378ADD" }}>
                You are on v{updateInfo.current_version}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <a href={updateInfo.release_url} target="_blank" rel="noreferrer"
              style={{ background: "#378ADD", color: "white", padding: "8px 16px",
                      borderRadius: "6px", textDecoration: "none", fontSize: "13px",
                      fontWeight: 500 }}>
              Download Update
            </a>
            <button onClick={() => setUpdateInfo(null)}
              style={{ background: "none", border: "1px solid #378ADD",
                      color: "#378ADD", padding: "8px 16px", borderRadius: "6px",
                      cursor: "pointer", fontSize: "13px" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Alert banner */}
      {health?.alert && (
        <div style={{ background: "#FAECE7", border: "2px solid #E24B4A", borderRadius: "8px", padding: "14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: "#712B13", fontSize: mobile ? "13px" : "15px" }}>CRITICAL ALERT — {health.machine_id}</div>
            <div style={{ fontSize: "13px", color: "#712B13" }}>{health.message}</div>
          </div>
        </div>
      )}

      {/* Healthy banner */}
      {health && !health.alert && (
        <div style={{ background: "#E1F5EE", border: "2px solid #1D9E75", borderRadius: "8px", padding: "14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>✅</span>
          <div>
            <div style={{ fontWeight: 600, color: "#085041", fontSize: mobile ? "13px" : "15px" }}>ALL SYSTEMS HEALTHY — {health.machine_id}</div>
            <div style={{ fontSize: "13px", color: "#085041" }}>{health.message}</div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{ background: "white", borderRadius: "12px", padding: "10px 16px", marginBottom: "16px", display: "flex", gap: "16px", alignItems: "center", fontSize: mobile ? "12px" : "14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#1D9E75" : "#E24B4A", display: "inline-block" }}></span>
          <span style={{ color: connected ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>{connected ? "Live" : "Reconnecting..."}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ color: "#666" }}>Model:</span>
          <span style={{ fontWeight: 500, color: trained ? "#1D9E75" : "#EF9F27" }}>{trained ? "Ready" : "Not Trained"}</span>
        </div>
        {health && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "#666" }}>Health:</span>
            <span style={{ fontWeight: 600, color: health.overall_health >= 75 ? "#1D9E75" : health.overall_health >= 50 ? "#378ADD" : health.overall_health >= 25 ? "#EF9F27" : "#E24B4A" }}>
              {health.overall_health}/100
            </span>
          </div>
        )}
        {lastUpdate && <span style={{ color: "#888", fontSize: "11px" }}>Updated: {lastUpdate}</span>}
      </div>

      {/* Bearing health cards */}
      {health && health.bearings && (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {Object.entries(health.bearings).map(([name, data]) => (
            <HealthCard key={name} name={name.replace("bearing", "B")} health={data.health_score} status={data.status} rms={data.rms} threshold={data.threshold} />
          ))}
        </div>
      )}

      {/* Email Config Panel */}
      {showEmailConfig && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>⚙️ Alert Email Configuration</h2>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div style={{ gridColumn: mobile ? "1" : "1 / -1" }}>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Recipient Emails (comma separated)</label>
              <input type="text" placeholder="maintenance@factory.com" value={emailConfig.emails} onChange={e => setEmailConfig({...emailConfig, emails: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>SMTP Server</label>
              <input type="text" value={emailConfig.smtp_server} onChange={e => setEmailConfig({...emailConfig, smtp_server: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Port</label>
              <input type="number" value={emailConfig.smtp_port} onChange={e => setEmailConfig({...emailConfig, smtp_port: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Email Username</label>
              <input type="email" placeholder="your.email@gmail.com" value={emailConfig.smtp_username} onChange={e => setEmailConfig({...emailConfig, smtp_username: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>App Password</label>
              <input type="password" placeholder="Gmail app password" value={emailConfig.smtp_password} onChange={e => setEmailConfig({...emailConfig, smtp_password: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={saveEmailConfig} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>💾 Save</button>
            <button onClick={sendTestAlert} style={{ ...btnStyle, background: "#378ADD", color: "white" }}>📧 Test Alert</button>
          </div>
          {emailSaved && <div style={{ marginTop: "10px", color: "#1D9E75", fontSize: "13px" }}>✅ Saved!</div>}
        </div>
      )}

      {/* Cost Calculator Panel */}
      {showCostCalc && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>💰 Cost Savings Calculator</h2>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Machine Hourly Rate ($/hr)</label>
              <input type="number" value={costConfig.hourly_rate} onChange={e => setCostConfig({...costConfig, hourly_rate: parseFloat(e.target.value)})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Average Repair Cost ($)</label>
              <input type="number" value={costConfig.repair_cost} onChange={e => setCostConfig({...costConfig, repair_cost: parseFloat(e.target.value)})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
          </div>
          <button onClick={calculateSavings} style={{ ...btnStyle, background: "#1D9E75", color: "white", marginBottom: "12px" }}>Calculate Savings</button>
          {costSavings && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "10px", marginBottom: "12px" }}>
                <div style={{ background: "#E1F5EE", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#1D9E75" }}>${parseInt(costSavings.total_savings).toLocaleString()}</div>
                  <div style={{ fontSize: "11px", color: "#085041" }}>Total Savings</div>
                </div>
                <div style={{ background: "#E6F1FB", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#378ADD" }}>${parseInt(costSavings.downtime_cost).toLocaleString()}</div>
                  <div style={{ fontSize: "11px", color: "#0C447C" }}>Downtime Cost</div>
                </div>
                <div style={{ background: "#EEEDFE", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#7F77DD" }}>${parseInt(costSavings.repair_costs).toLocaleString()}</div>
                  <div style={{ fontSize: "11px", color: "#3C3489" }}>Repair Costs</div>
                </div>
                <div style={{ background: "#FAEEDA", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#EF9F27" }}>{costSavings.oee}%</div>
                  <div style={{ fontSize: "11px", color: "#633806" }}>OEE Score</div>
                </div>
              </div>
              <div style={{ background: "#F8F9FA", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#666" }}>
                💡 OpenPMX prevented an estimated <strong>${parseInt(costSavings.total_savings).toLocaleString()}</strong> in costs. ROI is immediate at $0 licensing cost.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Machine Manager Panel */}
      {showMachineManager && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>🏭 Machine Fleet Manager</h2>
          {machines.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px" }}>Active Machines ({machines.length})</h3>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "8px" }}>
                {machines.map(m => (
                  <div key={m.machine_id} onClick={() => setSelectedMachine(m.machine_id)}
                    style={{ border: `2px solid ${selectedMachine === m.machine_id ? "#1D9E75" : m.status === "critical" ? "#E24B4A" : "#ddd"}`, borderRadius: "8px", padding: "10px", cursor: "pointer" }}>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>{m.name}</div>
                    <div style={{ fontSize: "11px", color: "#666" }}>{m.location}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 700, color: m.overall_health >= 75 ? "#1D9E75" : m.overall_health >= 50 ? "#378ADD" : m.overall_health >= 25 ? "#EF9F27" : "#E24B4A" }}>
                        {m.overall_health !== null ? `${m.overall_health}/100` : "N/A"}
                      </span>
                      <button onClick={e => { e.stopPropagation(); deleteMachine(m.machine_id) }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: "14px" }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px" }}>Add New Machine</h3>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
            <input type="text" placeholder="Machine ID" value={newMachine.machine_id} onChange={e => setNewMachine({...newMachine, machine_id: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <input type="text" placeholder="Machine Name" value={newMachine.name} onChange={e => setNewMachine({...newMachine, name: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <input type="text" placeholder="Location" value={newMachine.location} onChange={e => setNewMachine({...newMachine, location: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
          </div>
          <button onClick={registerMachine} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>+ Add Machine</button>
        </div>
      )}

      {/* OEE Widget */}
      {oee && (
        <div style={{ background: "white", borderRadius: "12px", padding: mobile ? "14px" : "20px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: mobile ? "14px" : "16px", fontWeight: 600 }}>
            Overall Equipment Effectiveness — Last 24 hours
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "10px", marginBottom: "14px" }}>
            <div style={{ textAlign: "center", background: oee.oee >= 85 ? "#E1F5EE" : oee.oee >= 60 ? "#FAEEDA" : "#FAECE7", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: mobile ? "28px" : "36px", fontWeight: 700, color: oee.oee >= 85 ? "#1D9E75" : oee.oee >= 60 ? "#EF9F27" : "#E24B4A" }}>{oee.oee}%</div>
              <div style={{ fontSize: "12px", color: "#666" }}>OEE Score</div>
              <div style={{ fontSize: "11px", color: "#888" }}>{oee.oee >= 85 ? "World class" : oee.oee >= 60 ? "Average" : "Needs improvement"}</div>
            </div>
            <div style={{ textAlign: "center", background: "#E6F1FB", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: mobile ? "28px" : "36px", fontWeight: 700, color: "#378ADD" }}>{oee.availability}%</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Availability</div>
              <div style={{ fontSize: "11px", color: "#888" }}>{Math.round(oee.uptime_minutes / 60)}h uptime</div>
            </div>
            <div style={{ textAlign: "center", background: oee.total_downtime_minutes > 0 ? "#FAECE7" : "#E1F5EE", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: mobile ? "28px" : "36px", fontWeight: 700, color: oee.total_downtime_minutes > 0 ? "#E24B4A" : "#1D9E75" }}>{Math.round(oee.total_downtime_minutes)}m</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Downtime</div>
              <div style={{ fontSize: "11px", color: "#888" }}>{oee.downtime_events_count} events</div>
            </div>
            <div style={{ textAlign: "center", background: oee.machine_currently_down ? "#FAECE7" : "#E1F5EE", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "32px" }}>{oee.machine_currently_down ? "🔴" : "🟢"}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: oee.machine_currently_down ? "#E24B4A" : "#1D9E75" }}>
                {oee.machine_currently_down ? "Machine Down" : "Running"}
              </div>
            </div>
          </div>
          {downtime.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px" }}>Recent Downtime Events</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#F8F9FA" }}>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Start Time</th>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Duration</th>
                    {!mobile && <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Cause</th>}
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {downtime.slice(0, 5).map((event, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px" }}>{new Date(event.start_time).toLocaleString()}</td>
                      <td style={{ padding: "8px" }}>{event.duration_minutes ? `${Math.round(event.duration_minutes)}m` : "Ongoing"}</td>
                      {!mobile && <td style={{ padding: "8px", color: "#666" }}>{event.cause?.substring(0, 30)}...</td>}
                      <td style={{ padding: "8px" }}>
                        <span style={{ background: event.resolved ? "#E1F5EE" : "#FAECE7", color: event.resolved ? "#085041" : "#712B13", padding: "2px 8px", borderRadius: "99px", fontSize: "11px" }}>
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

      {/* Real-time chart */}
      <div style={{ background: "white", borderRadius: "12px", padding: mobile ? "14px" : "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ margin: 0, fontSize: mobile ? "14px" : "16px", fontWeight: 600 }}>Real-time Health History</h2>
          <span style={{ fontSize: "12px", color: "#888" }}>{history.length > 0 ? `${history.length} readings` : "Waiting for data..."}</span>
        </div>
        {history.length > 0 ? (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg width="100%" height={mobile ? "200" : "300"} viewBox={`0 0 ${Math.max(history.length * 20, 600)} ${mobile ? 200 : 300}`}>
              {[0, 25, 50, 75, 100].map(v => (
                <g key={v}>
                  <line x1="40" y1={mobile ? (180 - v * 1.6) : (260 - v * 2.2)} x2={Math.max(history.length * 20, 600)} y2={mobile ? (180 - v * 1.6) : (260 - v * 2.2)} stroke="#f0f0f0" strokeWidth="1" />
                  <text x="35" y={mobile ? (184 - v * 1.6) : (264 - v * 2.2)} fontSize="10" fill="#888" textAnchor="end">{v}</text>
                </g>
              ))}
              {["b1", "b2", "b3", "b4"].map((key, idx) => {
                const colors = ["#1D9E75", "#378ADD", "#E24B4A", "#EF9F27"]
                const maxY = mobile ? 180 : 260
                const scale = mobile ? 1.6 : 2.2
                const points = history.map((h, i) => `${40 + i * 20},${maxY - (h[key] || 0) * scale}`).join(" ")
                return <polyline key={key} points={points} fill="none" stroke={colors[idx]} strokeWidth="2" />
              })}
              {["B1", "B2", "B3", "B4"].map((name, idx) => {
              const colors = ["#1D9E75", "#378ADD", "#E24B4A", "#EF9F27"]
              const fullNames = ["Bearing 1", "Bearing 2", "Bearing 3", "Bearing 4"]
              return (
                <g key={name}>
                  <rect x={45 + idx * (mobile ? 75 : 120)} y="6" width="12" height="12" rx="2" fill={colors[idx]} />
                  <text x={62 + idx * (mobile ? 75 : 120)} y="17" fontSize={mobile ? "11" : "13"} fill="#444" fontWeight="500">
                    {mobile ? name : fullNames[idx]}
                  </text>
                </g>
              )
            })}
            </svg>
          </div>
        ) : (
          <div style={{ height: mobile ? "150px" : "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px" }}>
            {trained ? "Send sensor readings to see chart" : "Train the model first"}
          </div>
        )}
      </div>

    </div>
  )
}
import { useState, useEffect, useRef } from "react"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ?
    'http://localhost:8000' :
    `http://${window.location.hostname}:8000`)
const WS_URL = API_URL.replace("http", "ws").replace("https", "wss")

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
  const [selectedMachine, setSelectedMachine] = useState(localStorage.getItem('openpmx_selected_machine') || "machine_001")
  const [newMachine, setNewMachine] = useState({ machine_id: "", name: "", location: "" })
  const [mobile, setMobile] = useState(isMobile())
  const [updateInfo, setUpdateInfo] = useState(null)

  // Auth states
  const [token, setToken] = useState(localStorage.getItem('openpmx_token') || null)
  const [user, setUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: "", password: "" })
  const [loginError, setLoginError] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [showUserManager, setShowUserManager] = useState(false)
  const [users, setUsers] = useState([])
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "viewer" })
  const [plcTags, setPLCTags] = useState([])
  const [browsingTags, setBrowsingTags] = useState(false)
  const [tagSearch, setTagSearch] = useState("")

  const [showPLCConfig, setShowPLCConfig] = useState(false)
  const [plcConfig, setPLCConfig] = useState({
    plc_type: "simulation",
    plc_ip: "",
    plc_slot: 0,
    opcua_endpoint: "",
    modbus_port: 502,
    tags: {
      bearing1_rms: "",
      bearing2_rms: "",
      bearing3_rms: "",
      bearing4_rms: ""
    }
  })
  const wsRef = useRef(null)
  const pingRef = useRef(null)

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  })
  const [passwordMessage, setPasswordMessage] = useState(null)

  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState([])
  const [showAckModal, setShowAckModal] = useState(false)
  const [ackForm, setAckForm] = useState({ alert_id: null, note: "" })


  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    verifyToken()
    connectWebSocket()
    checkHealth()
    checkForUpdates()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (pingRef.current) clearInterval(pingRef.current)
    }
  }, [])

  useEffect(() => {
  if (trained) {
    loadHistory()
    loadOEE()
    setHistory([])
    setHealth(null)
  }
}, [selectedMachine])


  // ─── Auth functions ───

  const login = async () => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const formData = new FormData()
      formData.append("username", loginForm.username)
      formData.append("password", loginForm.password)
      const res = await axios.post(`${API_URL}/auth/login`, formData)
      const { access_token, username, role, email } = res.data
      localStorage.setItem('openpmx_token', access_token)
      setToken(access_token)
      setUser({ username, role, email })
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    } catch (e) {
      setLoginError("Incorrect username or password")
    }
    setLoginLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('openpmx_token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  const verifyToken = async () => {
    if (!token) return
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      const res = await axios.get(`${API_URL}/auth/me`)
      setUser(res.data)
    } catch (e) {
      logout()
    }
  }

  const changePassword = async () => {
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    setPasswordMessage({ type: "error", text: "New passwords don't match" })
    return
  }
  if (passwordForm.new_password.length < 6) {
    setPasswordMessage({ type: "error", text: "Password must be at least 6 characters" })
    return
  }
  try {
    await axios.post(`${API_URL}/auth/change-password`, {
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password
    })
    setPasswordMessage({ type: "success", text: "Password changed successfully!" })
    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" })
    setTimeout(() => {
      setShowPasswordChange(false)
      setPasswordMessage(null)
    }, 2000)
  } catch (e) {
    setPasswordMessage({ type: "error", text: e.response?.data?.detail || "Failed to change password" })
  }
}


const loadUnacknowledgedAlerts = async () => {
  try {
    const res = await axios.get(`${API_URL}/alerts/${selectedMachine}/unacknowledged`)
    setUnacknowledgedAlerts(res.data.alerts)
  } catch (e) {
    console.error("Failed to load alerts:", e)
  }
}

const acknowledgeAlert = async () => {
  try {
    await axios.post(
      `${API_URL}/alerts/${ackForm.alert_id}/acknowledge?acknowledged_by=${user.username}&note=${ackForm.note}`
    )
    setShowAckModal(false)
    setAckForm({ alert_id: null, note: "" })
    await loadUnacknowledgedAlerts()
  } catch (e) {
    setError("Failed to acknowledge alert")
  }
}


  const loadUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/users`)
      setUsers(res.data.users)
    } catch (e) {
      console.error("Failed to load users:", e)
    }
  }

  const createUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.email) {
      setError("Username, email and password are required")
      return
    }
    try {
      await axios.post(`${API_URL}/auth/users`, newUser)
      setNewUser({ username: "", email: "", password: "", role: "viewer" })
      await loadUsers()
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create user")
    }
  }

  const deleteUser = async (username) => {
    try {
      await axios.delete(`${API_URL}/auth/users/${username}`)
      await loadUsers()
    } catch (e) {
      setError("Failed to delete user")
    }
  }

  // ─── Data functions ───

  const loadHistory = async () => {
    try {
      const histRes = await axios.get(`${API_URL}/history/${selectedMachine}`)
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
      const oeeRes = await axios.get(`${API_URL}/oee/${selectedMachine}`)
      setOee(oeeRes.data)
      const dtRes = await axios.get(`${API_URL}/downtime/${selectedMachine}`)
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
        await loadUnacknowledgedAlerts()
        await loadMachines()
      }
    } catch (e) {
      setError("Cannot connect to API. Make sure the backend is running.")
    }
  }

  const checkForUpdates = async () => {
    try {
      const res = await axios.get(`${API_URL}/check-updates`)
      if (res.data.update_available) setUpdateInfo(res.data)
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
            loadUnacknowledgedAlerts()
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
          loadUnacknowledgedAlerts()
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

  // ─── Action functions ───

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
        {}, { responseType: "blob" }
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

    const loadPLCConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/plc-config`)
      setPLCConfig(res.data)
    } catch (e) {
      console.error("Failed to load PLC config:", e)
    }
  }

  const savePLCConfig = async () => {
    try {
      await axios.post(`${API_URL}/plc-config`, plcConfig)
      alert("PLC configuration saved! Edge agent will apply changes automatically within 30 seconds.")
    } catch (e) {
      setError("Failed to save PLC configuration")
    }
  }

  const browsePLCTags = async () => {
    if (!plcConfig.plc_ip && plcConfig.plc_type !== "simulation") {
      setError("Enter PLC IP address first")
      return
    }
    setBrowsingTags(true)
    setPLCTags([])
    setError(null)
    try {
      const res = await axios.post(`${API_URL}/browse-plc-tags`, plcConfig)
      console.log("Browse tags response:", res.data)
      
      if (res.data && res.data.tags) {
        setPLCTags([...res.data.tags])
        console.log("Browse tags response:", res.data)
      } else {
        setError("No tags returned from PLC")
      }
    } catch (e) {
      console.error("Error:", e)
      setError(e.response?.data?.detail || "Failed to connect to PLC")
    }
    setBrowsingTags(false)
  }

  const btnStyle = {
    border: "none", cursor: "pointer", borderRadius: "8px",
    padding: mobile ? "8px 14px" : "10px 20px",
    fontSize: mobile ? "12px" : "14px", fontWeight: 500
  }

  // ─── Login page ───
  if (!token || !user) {
    return (
      <div style={{
        fontFamily: "system-ui, sans-serif",
        background: "linear-gradient(135deg, #f0fdf8 0%, #e8f5ff 100%)",
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px"
      }}>
        <div style={{
          background: "white", borderRadius: "16px", padding: "40px",
          width: "100%", maxWidth: "400px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "28px", fontWeight: 700, color: "#1D9E75" }}>OpenPMX</h1>
            <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>Predictive Maintenance Platform</p>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "6px" }}>Username</label>
            <input type="text" placeholder="admin" value={loginForm.username}
              onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "6px" }}>Password</label>
            <input type="password" placeholder="••••••••" value={loginForm.password}
              onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box" }} />
          </div>

          {loginError && (
            <div style={{ background: "#FAECE7", border: "1px solid #E24B4A", borderRadius: "8px", padding: "10px 14px", color: "#712B13", fontSize: "13px", marginBottom: "16px" }}>
              ⚠️ {loginError}
            </div>
          )}

          <button onClick={login} disabled={loginLoading} style={{
            width: "100%", background: "#1D9E75", color: "white",
            border: "none", padding: "12px", borderRadius: "8px",
            fontSize: "15px", fontWeight: 600, cursor: "pointer"
          }}>
            {loginLoading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    )
  }

  // ─── Main dashboard ───
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#F8F9FA", minHeight: "100vh", padding: mobile ? "12px" : "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: mobile ? "20px" : "24px", fontWeight: 700 }}>OpenPMX</h1>
          {!mobile && <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>Open-source predictive maintenance platform</p>}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>

          {/* Admin only — Train model */}

          {user?.role === "admin" && (
            <button onClick={() => { setShowPLCConfig(!showPLCConfig); loadPLCConfig() }}
              style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
              🔌 {!mobile && "PLC"}
            </button>
          )}

          {!trained && user?.role === "admin" && (
            <button onClick={trainModel} disabled={loading} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>
              {loading ? "Training..." : "Train Model"}
            </button>
          )}

          {/* Admin only — Upload CSV */}
          {!trained && user?.role === "admin" && (
            <label style={{ ...btnStyle, background: "#378ADD", color: "white", display: "inline-block" }}>
              {csvLoading ? "Uploading..." : "📂 Upload CSV"}
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSVUpload} />
            </label>
          )}

          {/* Admin and Technician — Simulate + Work Order */}
          {trained && (user?.role === "admin" || user?.role === "technician") && (
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
            </>
          )}

          {/* Admin and Technician — Monthly Report */}
          {trained && (user?.role === "admin" || user?.role === "technician") && (
            <button onClick={generateMonthlyReport} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>
              📊 {!mobile && "Report"}
            </button>
          )}

          {/* Admin and Technician — Alert Settings */}
          {(user?.role === "admin" || user?.role === "technician") && (
            <button onClick={() => setShowEmailConfig(!showEmailConfig)} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
              ⚙️ {!mobile && "Alerts"}
            </button>
          )}

          {/* Admin and Technician — Cost Savings */}
          {(user?.role === "admin" || user?.role === "technician") && (
            <button onClick={() => setShowCostCalc(!showCostCalc)} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
              💰 {!mobile && "Savings"}
            </button>
          )}

          {/* Admin only — Machines */}
          {user?.role === "admin" && (
            <button onClick={() => setShowMachineManager(!showMachineManager)} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
              🏭 {!mobile && "Machines"}
            </button>
          )}

          {/* Admin only — Users */}
          {user?.role === "admin" && (
            <button onClick={() => { setShowUserManager(!showUserManager); loadUsers() }} style={{ ...btnStyle, background: "white", color: "#555", border: "1px solid #ddd" }}>
              👥 {!mobile && "Users"}
            </button>
          )}

          {/* User info and logout — always visible */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setShowPasswordChange(!showPasswordChange)} style={{
              ...btnStyle, background: "#F8F9FA", color: "#555", border: "1px solid #ddd"
            }}>
              👤 {user?.username} ({user?.role})
            </button>
            <button onClick={logout} style={{ ...btnStyle, background: "#FAECE7", color: "#712B13", border: "1px solid #E24B4A" }}>
              Sign Out
            </button>
          </div>

        </div>
      </div>

      {/* Update banner */}
      {updateInfo && (
        <div style={{ background: "#E6F1FB", border: "2px solid #378ADD", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🆕</span>
            <div>
              <div style={{ fontWeight: 600, color: "#0C447C", fontSize: "14px" }}>Update available — v{updateInfo.latest_version}</div>
              <div style={{ fontSize: "12px", color: "#378ADD" }}>You are on v{updateInfo.current_version}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <a href={updateInfo.release_url} target="_blank" rel="noreferrer"
              style={{ background: "#378ADD", color: "white", padding: "8px 16px", borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: 500 }}>
              Download Update
            </a>
            <button onClick={() => setUpdateInfo(null)}
              style={{ background: "none", border: "1px solid #378ADD", color: "#378ADD", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      {/* Alert banner */}
      {health?.alert && (
        <div style={{ background: "#FAECE7", border: "2px solid #E24B4A", borderRadius: "8px", padding: "14px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: "#712B13", fontSize: mobile ? "13px" : "15px" }}>CRITICAL ALERT — {health.machine_id}</div>
              <div style={{ fontSize: "13px", color: "#712B13" }}>{health.message}</div>
              {unacknowledgedAlerts.length > 0 && (
                <div style={{ fontSize: "11px", color: "#712B13", marginTop: "4px" }}>
                  {unacknowledgedAlerts.length} unacknowledged alert{unacknowledgedAlerts.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
          {unacknowledgedAlerts.length > 0 && (user?.role === "admin" || user?.role === "technician") && (
            <button onClick={() => {
              setAckForm({ alert_id: unacknowledgedAlerts[0].id, note: "" })
              setShowAckModal(true)
            }} style={{
              background: "#E24B4A", color: "white", border: "none",
              padding: "8px 16px", borderRadius: "6px", cursor: "pointer",
              fontSize: "13px", fontWeight: 500
            }}>
              ✅ Acknowledge
            </button>
          )}
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
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ color: "#666" }}>Machine:</span>
        <span style={{ fontWeight: 500, color: "#1D9E75" }}>{selectedMachine}</span>
      </div>

      {/* Bearing health cards */}
      {health && health.bearings && (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {Object.entries(health.bearings).map(([name, data]) => (
            <HealthCard key={name} name={name.replace("bearing", "Bearing ")} health={data.health_score} status={data.status} rms={data.rms} threshold={data.threshold} />
          ))}
        </div>
      )}

      {/* Email Config Panel */}
      {showEmailConfig && (user?.role === "admin" || user?.role === "technician") && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>⚙️ Alert Email Configuration</h2>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div style={{ gridColumn: mobile ? "1" : "1 / -1" }}>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Recipient Emails (comma separated)</label>
              <input type="text" placeholder="maintenance@factory.com" value={emailConfig.emails}
                onChange={e => setEmailConfig({...emailConfig, emails: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>SMTP Server</label>
              <input type="text" value={emailConfig.smtp_server}
                onChange={e => setEmailConfig({...emailConfig, smtp_server: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Port</label>
              <input type="number" value={emailConfig.smtp_port}
                onChange={e => setEmailConfig({...emailConfig, smtp_port: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Email Username</label>
              <input type="email" placeholder="your.email@gmail.com" value={emailConfig.smtp_username}
                onChange={e => setEmailConfig({...emailConfig, smtp_username: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>App Password</label>
              <input type="password" placeholder="Gmail app password" value={emailConfig.smtp_password}
                onChange={e => setEmailConfig({...emailConfig, smtp_password: e.target.value})}
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
      {showCostCalc && (user?.role === "admin" || user?.role === "technician") && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>💰 Cost Savings Calculator</h2>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Machine Hourly Rate ($/hr)</label>
              <input type="number" value={costConfig.hourly_rate}
                onChange={e => setCostConfig({...costConfig, hourly_rate: parseFloat(e.target.value)})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Average Repair Cost ($)</label>
              <input type="number" value={costConfig.repair_cost}
                onChange={e => setCostConfig({...costConfig, repair_cost: parseFloat(e.target.value)})}
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

      {/* Machine Manager Panel — admin only */}
      {showMachineManager && user?.role === "admin" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>🏭 Machine Fleet Manager</h2>
          {machines.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px" }}>Active Machines ({machines.length})</h3>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "8px" }}>
                {machines.map(m => (
                  <div key={m.machine_id} onClick={() => {
                      setSelectedMachine(m.machine_id)
                      localStorage.setItem('openpmx_selected_machine', m.machine_id)
                      setShowMachineManager(false)
                    }}
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
            <input type="text" placeholder="Machine ID" value={newMachine.machine_id}
              onChange={e => setNewMachine({...newMachine, machine_id: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <input type="text" placeholder="Machine Name" value={newMachine.name}
              onChange={e => setNewMachine({...newMachine, name: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <input type="text" placeholder="Location" value={newMachine.location}
              onChange={e => setNewMachine({...newMachine, location: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
          </div>
          <button onClick={registerMachine} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>+ Add Machine</button>
        </div>
      )}

      {/* User Manager Panel — admin only */}
      {showUserManager && user?.role === "admin" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>👥 User Management</h2>
          {users.length > 0 && (
            <div style={{ marginBottom: "16px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#F8F9FA" }}>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Username</th>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Email</th>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Role</th>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Last Login</th>
                    <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.username} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px", fontWeight: 500 }}>{u.username}</td>
                      <td style={{ padding: "8px", color: "#666" }}>{u.email}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{
                          background: u.role === "admin" ? "#FAECE7" : u.role === "technician" ? "#E6F1FB" : "#E1F5EE",
                          color: u.role === "admin" ? "#712B13" : u.role === "technician" ? "#0C447C" : "#085041",
                          padding: "2px 8px", borderRadius: "99px", fontSize: "11px"
                        }}>{u.role}</span>
                      </td>
                      <td style={{ padding: "8px", color: "#666", fontSize: "11px" }}>
                        {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {u.username !== user.username && (
                          <button onClick={() => deleteUser(u.username)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: "14px" }}>
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px" }}>Add New User</h3>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
            <input type="text" placeholder="Username" value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <input type="email" placeholder="Email" value={newUser.email}
              onChange={e => setNewUser({...newUser, email: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <input type="password" placeholder="Password" value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }} />
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}
              style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }}>
              <option value="viewer">Viewer — read only</option>
              <option value="technician">Technician — view + work orders</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          <button onClick={createUser} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>+ Add User</button>
        </div>
      )}

    {/* Password Change Panel */}
    {showPasswordChange && (
      <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>🔑 Change Password</h2>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Current Password</label>
            <input type="password" placeholder="Current password"
              value={passwordForm.current_password}
              onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>New Password</label>
            <input type="password" placeholder="New password (min 6 chars)"
              value={passwordForm.new_password}
              onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Confirm Password</label>
            <input type="password" placeholder="Confirm new password"
              value={passwordForm.confirm_password}
              onChange={e => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
          </div>
        </div>

        <button onClick={changePassword} style={{ ...btnStyle, background: "#1D9E75", color: "white" }}>
          🔑 Change Password
        </button>

        {passwordMessage && (
          <div style={{
            marginTop: "10px", padding: "8px 12px", borderRadius: "6px", fontSize: "13px",
            background: passwordMessage.type === "success" ? "#E1F5EE" : "#FAECE7",
            color: passwordMessage.type === "success" ? "#085041" : "#712B13"
          }}>
            {passwordMessage.type === "success" ? "✅" : "⚠️"} {passwordMessage.text}
          </div>
        )}
      </div>
    )}


      {/* PLC Configuration Panel — admin only */}
      {showPLCConfig && user?.role === "admin" && (
        <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 600 }}>🔌 PLC Configuration</h2>

          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>PLC Type</label>
              <select value={plcConfig.plc_type}
                onChange={e => setPLCConfig({...plcConfig, plc_type: e.target.value})}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }}>
                <option value="simulation">Simulation (testing)</option>
                <option value="allen_bradley">Allen-Bradley (EtherNet/IP)</option>
                <option value="siemens">Siemens S7</option>
                <option value="modbus">Modbus TCP</option>
                <option value="opcua">OPC-UA</option>
              </select>
            </div>

            {plcConfig.plc_type !== "simulation" && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>PLC IP Address</label>
                <input type="text" placeholder="192.168.1.10" value={plcConfig.plc_ip}
                  onChange={e => setPLCConfig({...plcConfig, plc_ip: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
            )}

            {plcConfig.plc_type === "allen_bradley" && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>PLC Slot</label>
                <input type="number" value={plcConfig.plc_slot}
                  onChange={e => setPLCConfig({...plcConfig, plc_slot: parseInt(e.target.value)})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
            )}

            {plcConfig.plc_type === "opcua" && (
              <div style={{ gridColumn: mobile ? "1" : "1 / -1" }}>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>OPC-UA Endpoint</label>
                <input type="text" placeholder="opc.tcp://192.168.1.10:4840" value={plcConfig.opcua_endpoint}
                  onChange={e => setPLCConfig({...plcConfig, opcua_endpoint: e.target.value})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
            )}

            {plcConfig.plc_type === "modbus" && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>Modbus Port</label>
                <input type="number" value={plcConfig.modbus_port}
                  onChange={e => setPLCConfig({...plcConfig, modbus_port: parseInt(e.target.value)})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
            )}
          </div>

      {/* Tag configuration */}
      {plcConfig.plc_type !== "simulation" && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>Sensor Tag Mapping</h3>
            <button onClick={browsePLCTags} disabled={browsingTags} style={{
              ...btnStyle, background: "#378ADD", color: "white", fontSize: "12px", padding: "6px 12px"
            }}>
              {browsingTags ? "Connecting..." : "🔍 Browse Tags"}
            </button>
          </div>

        {/* Tag search */}
        {plcTags.length > 0 && (
          <input
            type="text"
            placeholder="Search tags..."
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box", marginBottom: "8px" }}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "8px" }}>
          {Object.entries(plcConfig.tags).map(([key, value]) => (
            <div key={key}>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "3px" }}>
                {key.replace("_rms", "").replace("bearing", "Bearing ")} Sensor Tag
              </label>
              {plcTags.length > 0 ? (
                <select
                  value={value}
                  onChange={e => setPLCConfig({...plcConfig, tags: {...plcConfig.tags, [key]: e.target.value}})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }}
                >
                  <option value="">-- Select tag --</option>
                  {plcTags
                    .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                    .map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.type})
                      </option>
                    ))
                  }
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={
                    plcConfig.plc_type === "allen_bradley" ? "Machine_Insight" :
                    plcConfig.plc_type === "modbus" ? "40001" :
                    plcConfig.plc_type === "opcua" ? "ns=2;s=Machine_Insight" : ""
                  }
                  value={value}
                  onChange={e => setPLCConfig({...plcConfig, tags: {...plcConfig.tags, [key]: e.target.value}})}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box" }}
                />
              )}
            </div>
          ))}
        </div>

        {plcTags.length > 0 && (
          <div style={{ background: "#E1F5EE", padding: "8px", borderRadius: "6px", fontSize: "12px", color: "#085041", marginBottom: "8px" }}>
            ✅ {plcTags.length} tags loaded — select tags for each sensor below
          </div>
        )}

        {plcTags.length === 0 && (
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
            Click "Browse Tags" to load available tags from your PLC, or type tag names manually.
          </div>
        )}

        {plcTags.length === 0 && (
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
            Click "Browse Tags" to load available tags from your PLC, or type tag names manually.
          </div>
        )}
      </div>
    )}

          <button onClick={savePLCConfig} style={{ ...btnStyle, background: "#1D9E75", color: "white", marginBottom: "12px" }}>
            💾 Save PLC Configuration
          </button>

          <div style={{ background: "#F8F9FA", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#666" }}>
            <strong>How to apply:</strong> Configuration is applied automatically — the edge agent detects changes within 30 seconds. No manual steps needed.
            <br/><br/>
            <strong>Allen-Bradley:</strong> Tag format: <code>Program:MainProgram.TagName</code><br/>
            <strong>Modbus:</strong> Register number (e.g. 40001)<br/>
            <strong>OPC-UA:</strong> Node ID format: <code>ns=2;s=TagName</code>
          </div>
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
            <svg width="100%" height={mobile ? "220" : "320"} viewBox={`0 0 ${Math.max(history.length * 20, 600)} ${mobile ? 220 : 320}`}>
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
              {["Bearing 1", "Bearing 2", "Bearing 3", "Bearing 4"].map((name, idx) => {
                const colors = ["#1D9E75", "#378ADD", "#E24B4A", "#EF9F27"]
                return (
                  <g key={name}>
                    <rect x={45 + idx * (mobile ? 75 : 120)} y="6" width="12" height="12" rx="2" fill={colors[idx]} />
                    <text x={62 + idx * (mobile ? 75 : 120)} y="17" fontSize={mobile ? "11" : "13"} fill="#444" fontWeight="500">
                      {mobile ? name.replace("Bearing ", "B") : name}
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

      {/* Acknowledge Modal */}
      {showAckModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "white", borderRadius: "16px", padding: "24px",
            width: "100%", maxWidth: "400px", margin: "24px"
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600 }}>
              ✅ Acknowledge Alert
            </h2>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
              Acknowledging as: <strong>{user?.username}</strong>
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                Note (optional)
              </label>
              <textarea
                placeholder="What action are you taking?"
                value={ackForm.note}
                onChange={e => setAckForm({...ackForm, note: e.target.value})}
                rows={3}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: "6px",
                  border: "1px solid #ddd", fontSize: "13px",
                  boxSizing: "border-box", resize: "vertical"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={acknowledgeAlert} style={{
                flex: 1, background: "#1D9E75", color: "white", border: "none",
                padding: "10px", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: 500
              }}>
                ✅ Confirm Acknowledge
              </button>
              <button onClick={() => setShowAckModal(false)} style={{
                flex: 1, background: "white", color: "#555",
                border: "1px solid #ddd", padding: "10px", borderRadius: "8px",
                cursor: "pointer", fontSize: "14px"
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
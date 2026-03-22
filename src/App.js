import bg from "./assets/background.jpg";
import React, { useEffect, useState } from "react";

import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, getDocs } from "firebase/firestore";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const REASONS = [
  "Study",
  "Borrow Books",
  "Return Books",
  "Research",
  "Group Study",
  "Internet Use",
  "Printing",
  "Other"
];

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);

        const ref = doc(db, "users", u.email);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, { role: "user" });
          setRole("user");
        } else {
          setRole(snap.data().role);
        }
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const result = await signInWithPopup(auth, provider);
    if (!result.user.email.endsWith("@neu.edu.ph")) {
      alert("Only NEU accounts allowed!");
      signOut(auth);
    }
  };

  const logout = () => signOut(auth);

  if (!user) {
    return (
      <div style={styles.hero}>
        <div style={styles.overlay}>
          <h1>📚 NEU Library System</h1>
          <button style={styles.button} onClick={login}>
            Login with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <Sidebar setPage={setPage} role={role} />

      <div style={styles.main}>
        <Header user={user} logout={logout} />

        {page === "dashboard" && <Dashboard />}
        {page === "log" && <UserPanel user={user} />}
      </div>
    </div>
  );
}

function Sidebar({ setPage, role }) {
  return (
    <div style={styles.sidebar}>
      <h2 style={styles.sidebarTitle}>📚 NEU</h2>

      <button style={styles.sidebarButton} onClick={() => setPage("dashboard")}>
        Dashboard
      </button>

      {role === "user" && (
        <button style={styles.sidebarButton} onClick={() => setPage("log")}>
          Log Visit
        </button>
      )}
    </div>
  );
}

function Header({ user, logout }) {
  return (
    <div style={styles.header}>
      <span>{user.email}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function Dashboard() {
  const [visits, setVisits] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [filterType, setFilterType] = useState("day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [visits, filterType, startDate, endDate, reasonFilter]);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, "visits"));
    const data = snap.docs.map(doc => ({
      ...doc.data(),
      date: doc.data().date?.toDate()
    }));
    setVisits(data);
  };

  const applyFilter = () => {
    const now = new Date();
    let result = visits;

    if (filterType === "day") {
      result = result.filter(v =>
        v.date?.toDateString() === now.toDateString()
      );
    }

    if (filterType === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);

      result = result.filter(v =>
        v.date >= weekAgo && v.date <= now
      );
    }

    if (filterType === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      result = result.filter(v =>
        v.date >= start && v.date <= end
      );
    }

    if (reasonFilter !== "") {
      result = result.filter(v => v.reason === reasonFilter);
    }

    setFiltered(result);
  };

  const reasonCount = {};
  filtered.forEach(v => {
    reasonCount[v.reason] = (reasonCount[v.reason] || 0) + 1;
  });

  const chartData = {
    labels: Object.keys(reasonCount),
    datasets: [
      {
        label: "Visits by Reason",
        data: Object.values(reasonCount)
      }
    ]
  };

  return (
    <div>
      <h2>Dashboard</h2>

      {/* 🔽 FILTERS */}
      <div style={styles.filterBar}>
  <button style={styles.filterButton} onClick={() => setFilterType("day")}>
    Today
  </button>

  <button style={styles.filterButton} onClick={() => setFilterType("week")}>
    This Week
  </button>

  <button style={styles.filterButton} onClick={() => setFilterType("custom")}>
    Custom
  </button>

  {filterType === "custom" && (
    <>
      <input
        style={styles.input}
        type="date"
        onChange={e => setStartDate(e.target.value)}
      />
      <input
        style={styles.input}
        type="date"
        onChange={e => setEndDate(e.target.value)}
      />
    </>
  )}

  <select
    style={styles.select}
    onChange={e => setReasonFilter(e.target.value)}
  >
    <option value="">All Reasons</option>
    {REASONS.map((r, i) => (
      <option key={i} value={r}>{r}</option>
    ))}
  </select>
</div>

      {/* 📊 CARDS */}
      <div style={styles.cards}>
        <Card title="Total Visits" value={filtered.length} />
        <Card title="Students" value={filtered.filter(v => !v.employee).length} />
        <Card title="Employees" value={filtered.filter(v => v.employee).length} />
      </div>

      {/* 📊 CHART */}
      <div style={{ width: 500, marginTop: 30 }}>
        <Bar data={chartData} />
      </div>
    </div>
  );
}

function UserPanel({ user }) {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [college, setCollege] = useState("");
  const [employee, setEmployee] = useState(false);

  const logVisit = async () => {
    const finalReason = reason === "Other" ? customReason : reason;

    await addDoc(collection(db, "visits"), {
      email: user.email,
      reason: finalReason,
      college,
      employee,
      date: new Date()
    });

    alert("Visit logged!");
  };

  return (
    <div style={styles.form}>
      <h3>Log Visit</h3>

<select style={styles.select} onChange={e => setReason(e.target.value)}>
  <option value="">Select Reason</option>
  {REASONS.map((r, i) => (
    <option key={i} value={r}>{r}</option>
  ))}
</select>

{reason === "Other" && (
  <input
    style={styles.input}
    placeholder="Enter custom reason"
    onChange={e => setCustomReason(e.target.value)}
  />
)}

<input
  style={styles.input}
  placeholder="College"
  onChange={e => setCollege(e.target.value)}
/>

<select
  style={styles.select}
  onChange={e => setEmployee(e.target.value === "true")}
>
  <option value="false">Student</option>
  <option value="true">Employee</option>
</select>

<button style={styles.button} onClick={logVisit}>
  Submit
</button>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={styles.card}>
      <h4 style={styles.cardTitle}>{title}</h4>
      <p style={styles.cardValue}>{value}</p>
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    fontFamily: "Segoe UI, sans-serif",
    background: "#f4f6f9",
    minHeight: "100vh"
  },

  hero: {
    height: "100vh",
    backgroundImage: `url(${bg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  overlay: {
    background: "rgba(0,0,0,0.6)",
    padding: 50,
    borderRadius: 15,
    textAlign: "center",
    color: "white",
    backdropFilter: "blur(8px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
  },

  button: {
    padding: "12px 20px",
    background: "#00c853",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
    marginTop: 15,
    transition: "0.3s"
  },

  sidebar: {
    width: 220,
    background: "#1e272e",
    color: "white",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 15,
    boxShadow: "2px 0 10px rgba(0,0,0,0.1)"
  },

  sidebarTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20
  },

  sidebarButton: {
    padding: 10,
    border: "none",
    background: "#485460",
    color: "white",
    borderRadius: 8,
    cursor: "pointer",
    transition: "0.2s"
  },

  main: {
    flex: 1,
    padding: 30
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    background: "white",
    padding: 15,
    borderRadius: 10,
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)"
  },

  cards: {
    display: "flex",
    gap: 20,
    marginTop: 20
  },

  card: {
    background: "white",
    padding: 25,
    borderRadius: 15,
    width: 180,
    textAlign: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    transition: "0.3s"
  },

  cardTitle: {
    fontSize: 14,
    color: "#777"
  },

  cardValue: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 10,
    color: "#2c3e50"
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxWidth: 350,
    background: "white",
    padding: 25,
    borderRadius: 15,
    boxShadow: "0 5px 20px rgba(0,0,0,0.1)"
  },

  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc"
  },

  select: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc"
  },

  filterBar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 20,
    background: "white",
    padding: 15,
    borderRadius: 10,
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)"
  },

  filterButton: {
    padding: "8px 12px",
    border: "none",
    background: "#0984e3",
    color: "white",
    borderRadius: 6,
    cursor: "pointer"
  }
};
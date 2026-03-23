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

  console.log("APP RENDER", user);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      try {
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
      } catch (err) {
        console.error("Auth error:", err);
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

  console.log("Dashboard loaded", visits, filtered);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [visits, filterType, startDate, endDate, reasonFilter]);

  const fetchData = async () => {
    try {
      const snap = await getDocs(collection(db, "visits"));

      const data = snap.docs.map(doc => ({
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));

      setVisits(data);
    } catch (error) {
      console.error("Firestore error:", error);
    }
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
    labels: Object.keys(reasonCount).length ? Object.keys(reasonCount) : ["No Data"],
    datasets: [
      {
        label: "Visits by Reason",
        data: Object.values(reasonCount).length ? Object.values(reasonCount) : [0]
      }
    ]
  };

  return (
    <div>
      <h2>Dashboard</h2>

      {/* FILTERS */}
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
            <input style={styles.input} type="date" onChange={e => setStartDate(e.target.value)} />
            <input style={styles.input} type="date" onChange={e => setEndDate(e.target.value)} />
          </>
        )}

        <select style={styles.select} onChange={e => setReasonFilter(e.target.value)}>
          <option value="">All Reasons</option>
          {REASONS.map((r, i) => (
            <option key={i} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* CARDS */}
      <div style={styles.cards}>
        <Card title="Total Visits" value={filtered.length} />
        <Card title="Students" value={filtered.filter(v => !v.employee).length} />
        <Card title="Employees" value={filtered.filter(v => v.employee).length} />
      </div>

      {/* SAFE CHART */}
      <div style={{ width: 500, marginTop: 30 }}>
        {filtered.length > 0 ? (
          <Bar data={chartData} />
        ) : (
          <p>No data available</p>
        )}
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

      <input style={styles.input} placeholder="College" onChange={e => setCollege(e.target.value)} />

      <select style={styles.select} onChange={e => setEmployee(e.target.value === "true")}>
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
    backgroundImage: bg ? `url(${bg})` : "none",
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
    color: "white"
  },
  button: {
    padding: "12px 20px",
    background: "#00c853",
    color: "white",
    border: "none",
    borderRadius: 8
  },
  sidebar: {
    width: 220,
    background: "#1e272e",
    color: "white",
    padding: 20
  },
  sidebarTitle: {
    fontSize: 22
  },
  sidebarButton: {
    padding: 10,
    marginTop: 10,
    background: "#485460",
    color: "white",
    border: "none"
  },
  main: {
    flex: 1,
    padding: 30
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20
  },
  cards: {
    display: "flex",
    gap: 20
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 10
  },
  cardTitle: {
    fontSize: 14
  },
  cardValue: {
    fontSize: 24
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 300
  },
  input: {
    padding: 10
  },
  select: {
    padding: 10
  },
  filterBar: {
    display: "flex",
    gap: 10,
    marginBottom: 20
  },
  filterButton: {
    padding: 8,
    background: "#0984e3",
    color: "white",
    border: "none"
  }
};
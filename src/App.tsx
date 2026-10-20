import { ManagePage, RemindersPage } from "./enhancements";
import React, { Component, useEffect, useState } from "react";

import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Menu,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { type Experience } from "./domain";
import {
  exportReport,
  listExperiences,
  live,
  sendFeedback,
  track,
} from "./store";
import { Home, Library, Detail, Share, RoadmapPage, About } from "./pages";
import "./styles.css";
import { AppContext, useApp, Brand, ButtonLink } from "./ui";
function Feedback({ close }: { close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useApp();
  const [id] = useState(() => crypto.randomUUID());
  const dialog = React.useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await sendFeedback(data, id);
            toast(
              live
                ? "Feedback saved privately. Thank you."
                : "Feedback saved in this browser only. Thank you.",
            );
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="section-heading">
          <h2>Help shape EchoPath</h2>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Close feedback"
          >
            <X />
          </button>
        </div>
        <p className="muted">
          Anonymous feedback.{" "}
          {live
            ? "Only the project team can review it."
            : "Demo: stored in this browser only."}{" "}
          Please omit personal or confidential information.
        </p>
        {[
          ["usefulness", "How useful was EchoPath?"],
          ["findability", "Was the information easy to find?"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <select name={name} defaultValue="" required>
              <option value="" disabled>
                Select a rating
              </option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "— Not at all" : n === 5 ? "— Very much" : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          What was confusing or frustrating?
          <textarea name="confusing" maxLength={3000} />
        </label>
        <label>
          What would you improve?
          <textarea name="improve" maxLength={3000} />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Send feedback"}
          <ArrowRight size={16} />
        </button>
      </form>
    </dialog>
  );
}
export class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="container empty">
        <h1>Something interrupted this page.</h1>
        <p>Reload to try again. Your saved browser data is preserved.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload EchoPath
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const location = useLocation();
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setExperiences(await listExperiences());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 5500);
      return () => clearTimeout(t);
    }
  }, [message]);
  return (
    <AppContext.Provider
      value={{ experiences, loading, error, refresh, toast: setMessage }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header>
        <div className="nav-shell">
          <Brand />
          <nav
            onClick={() => setMenu(false)}
            aria-label="Main navigation"
            className={menu ? "open" : ""}
          >
            <NavLink to="/experiences">
              <BookOpen size={16} />
              Explore experiences
            </NavLink>
            <NavLink to="/roadmap">
              <Compass size={16} />
              My roadmap
            </NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
          <Link className="button nav-cta" to="/share">
            <Plus size={17} />
            Share experience
          </Link>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
            aria-expanded={menu}
          >
            <Menu />
          </button>
        </div>
      </header>
      <div className="mode-bar">
        <span className="status-dot" />
        {live
          ? "Community mode · published submissions only"
          : "Demo workspace · fictional examples & browser-local saves"}
        <span className="mode-right">
          Built for the MSBA community <Sparkles size={13} />
        </span>
      </div>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/experiences" element={<Library />} />
          <Route path="/experiences/:id" element={<Detail />} />
          <Route path="/share" element={<Share />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route
            path="*"
            element={
              <div className="container empty">
                <h1>This path hasn’t been mapped.</h1>
                <ButtonLink to="/experiences">Explore experiences</ButtonLink>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>
        <div className="container">
          <div className="footer-top">
            <div>
              <Brand />
              <p>Real experiences. Smarter next steps.</p>
            </div>
            <div>
              <Link to="/about">Our story</Link>
              <Link to="/reminders">Reminders</Link>
              <Link to="/manage">Manage contribution</Link>
              <button
                onClick={() => {
                  track("feedback_open");
                  setFeedback(true);
                }}
              >
                <MessageSquare size={15} />
                Give feedback
              </button>
              <button onClick={exportReport}>Export local report</button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} EchoPath · A student-developed
              prototype.
            </span>
            <span>Independent project. Not an official USC service.</span>
          </div>
        </div>
      </footer>
      {message && (
        <div className="toast" role="status">
          <Check size={19} />
          {message}
          <button
            onClick={() => setMessage("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {feedback && <Feedback close={() => setFeedback(false)} />}
    </AppContext.Provider>
  );
}

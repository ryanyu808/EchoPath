const localDateTime = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Sparkles } from "lucide-react";
import { type Experience, submissionSchema, type Submission } from "./domain";
import {
  type Synthesis,
  type Reminder,
  reminderEligible,
  reminderSchema,
} from "../supabase/functions/_shared/alignment";
import { useApp } from "./ui";
import {
  approveDemo,
  enrollReminder,
  hashLink,
  helpfulFeedback,
  live,
  manageContribution,
  managementLink,
  manageReminder,
  newToken,
  recoverLegacyDemo,
  reminderMessage,
  simulateReminder,
  synthesize,
  type PrivateContribution,
} from "./store";
import { contributionLabels, PublicReview } from "./contribution";
export function Helpful({
  type,
  id,
}: {
  type: "experience" | "synthesis";
  id: string;
}) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const { toast } = useApp();
  return (
    <section
      className="helpful-panel"
      aria-label={`Helpfulness feedback for ${type}`}
    >
      <h3>Was this helpful?</h3>
      {sent ? (
        <p role="status">
          <CheckCircle2 size={16} />
          Thanks. Your feedback is private
          {live ? "." : " and saved only in this browser."}
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (answer === null || busy) return;
            setBusy(true);
            setError("");
            try {
              await helpfulFeedback(
                { target_type: type, target_id: id, helpful: answer, comment },
                requestId,
              );
              setSent(true);
              toast("Helpfulness feedback saved privately.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="helpful-options">
            <button
              type="button"
              className="button secondary"
              aria-pressed={answer === true}
              onClick={() => setAnswer(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className="button secondary"
              aria-pressed={answer === false}
              onClick={() => setAnswer(false)}
            >
              No
            </button>
          </div>
          {answer !== null && (
            <>
              <label>
                Optional comment
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  rows={2}
                />
              </label>
              <p className="small muted">
                Please omit personal and confidential information. Comments are
                not public.
              </p>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save helpfulness feedback"}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
export function SynthesisPanel({
  sources,
  total,
}: {
  sources: Experience[];
  total: number;
}) {
  const [result, setResult] = useState<Synthesis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = (id: string) =>
    sources.find((e) => e.id === id)?.company ?? "Source";
  return (
    <section className="synthesis-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={16} />
            SKILLS-FIRST DISCOVERY
          </div>
          <h2>AI Insights Across Experiences</h2>
        </div>
      </div>
      <p className="small muted">
        Explore the skills, tools and advice behind the matching records.{" "}
        {live
          ? "Live AI is used only when configured; otherwise counts and excerpts are rule-based."
          : "Demo synthesis uses deterministic aggregation of fictional and approved local records. No AI request is made."}
      </p>
      {total > 20 && (
        <p className="small muted">
          Summarizing the first 20 of {total} matches. Refine your filters for a
          narrower view.
        </p>
      )}
      {!sources.length ? (
        <p className="notice">
          No matching approved experiences. Broaden your search; there is no
          evidence to synthesize.
        </p>
      ) : (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setResult(await synthesize(sources));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sparkles size={16} />
          {busy ? "Preparing insights…" : "Synthesize matching experiences"}
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="synthesis-result">
          <div className="tags">
            <span>{result.mode}</span>
            <span>
              {result.source_count} contributing{" "}
              {result.source_count === 1 ? "experience" : "experiences"}
            </span>
          </div>
          <p className="notice">{result.limitation}</p>
          <div className="synthesis-counts">
            {[
              ["Frequently mentioned skills", result.skills],
              ["Common tools", result.tools],
            ].map(([title, items]) => (
              <div key={String(title)}>
                <h3>{String(title)}</h3>
                <div className="tags">
                  {(items as Synthesis["skills"]).map((s) => (
                    <span key={s.tag}>
                      {s.tag} · {s.count}/{result.source_count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {[
            ["Typical responsibilities", result.responsibilities],
            ["Challenges across the sources", result.challenges],
            ["Preparation advice", result.advice],
          ].map(([title, items]) => (
            <details key={String(title)} open={title === "Preparation advice"}>
              <summary>{String(title)}</summary>
              <ul>
                {(items as Synthesis["advice"]).map((p, i) => (
                  <li key={i}>
                    <p>{p.text}</p>
                    <div className="source-links">
                      {p.source_ids.map((id) => (
                        <Link key={id} to={`/experiences/${id}`}>
                          {label(id)} ↗
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <details>
            <summary>Differences between experiences</summary>
            <ul>
              {result.differences.map((d) => (
                <li key={d.source_id}>
                  {d.text}{" "}
                  <Link to={`/experiences/${d.source_id}`}>View source ↗</Link>
                </li>
              ))}
            </ul>
          </details>
          <div className="source-links">
            <BookOpen size={16} />
            {result.source_ids.map((id) => (
              <Link key={id} to={`/experiences/${id}`}>
                {label(id)}
              </Link>
            ))}
          </div>
          <Helpful key={result.id} type="synthesis" id={result.id} />
        </div>
      )}
    </section>
  );
}

export function ManagePage() {
  const { toast, refresh } = useApp();
  const initial = hashLink();
  const [id, setId] = useState(initial.id ?? "");
  const [token, setToken] = useState(initial.token ?? "");
  const [record, setRecord] = useState<PrivateContribution | null>(null);
  const [original, setOriginal] = useState<Submission | null>(null);
  const [candidate, setCandidate] = useState<Submission | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState<
    { id: string; token: string; role: string }[]
  >([]);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await manageContribution(id, token, "read");
      setRecord(r);
      setOriginal(submissionSchema.parse(r.original));
      setCandidate(submissionSchema.parse(r.public_candidate));
      setReviewed(r.privacy_reviewed);
    } catch (e) {
      setRecord(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initial.id && initial.token) {
      void manageContribution(initial.id, initial.token, "read")
        .then((r) => {
          setRecord(r);
          setOriginal(submissionSchema.parse(r.original));
          setCandidate(submissionSchema.parse(r.public_candidate));
          setReviewed(r.privacy_reviewed);
        })
        .catch((e) => setError((e as Error).message));
    }
  }, [initial.id, initial.token]);
  async function action(op: "edit" | "withdraw") {
    if (!record || !original || !candidate || busy) return;
    setBusy(true);
    setError("");
    try {
      await manageContribution(
        id,
        token,
        op,
        record.revision,
        original,
        candidate,
        reviewed,
      );
      await refresh();
      const r = await manageContribution(id, token, "read");
      setRecord(r);
      setOriginal(submissionSchema.parse(r.original));
      setCandidate(submissionSchema.parse(r.public_candidate));
      setReviewed(r.privacy_reviewed);
      toast(
        op === "withdraw"
          ? "Contribution withdrawn from public discovery."
          : "Edits saved privately. Previous publication and insights were invalidated.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <div className="page-heading">
        <div className="eyebrow">YOUR CONTRIBUTION, YOUR CHOICE</div>
        <h1>Manage your experience.</h1>
        <p>
          Your private link grants access to one contribution. Never share its
          token.
        </p>
      </div>
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label>
          Contribution ID
          <input required value={id} onChange={(e) => setId(e.target.value)} />
        </label>
        <label>
          Management token
          <input
            required
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button className="button" disabled={busy}>
          Open private contribution <ArrowRight size={16} />
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {record && original && candidate && (
        <section className="form-card management-card">
          <div className="section-heading">
            <h2>{original.role_title}</h2>
            <span className="badge">
              {record.status} · revision {record.revision}
            </span>
          </div>
          <p className="notice">
            {live
              ? "Private contribution management."
              : "Demo: saved only in this browser. Moderator approval below is a simulation."}{" "}
            Editing removes the previous public copy and requires renewed
            review. Withdrawal prevents future search, synthesis and roadmap
            use. Downloaded or cached copies may remain elsewhere.
          </p>
          <details>
            <summary>Review and edit original answers (private)</summary>
            <div className="form-fields">
              {Object.entries(contributionLabels).map(([key, label]) => (
                <label key={key}>
                  Original: {label}
                  <textarea
                    rows={2}
                    value={String(original[key as keyof Submission] ?? "")}
                    maxLength={5000}
                    onChange={(e) => {
                      const value =
                        key === "year"
                          ? Number(e.target.value)
                          : e.target.value;
                      setOriginal({ ...original, [key]: value });
                      setReviewed(false);
                    }}
                  />
                </label>
              ))}
              <p className="small muted">
                Changes to originals do not silently rewrite the public
                candidate. Review and edit the public version below to reflect
                what you want shared.
              </p>
            </div>
          </details>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={original.consent_to_publish}
              onChange={(e) => {
                setOriginal({
                  ...original,
                  consent_to_publish: e.target.checked,
                });
                setReviewed(false);
              }}
            />
            <span>
              I consent to anonymous publication of the reviewed public version.
            </span>
          </label>
          <PublicReview
            value={candidate}
            onChange={setCandidate}
            reviewed={reviewed}
            onReview={setReviewed}
          />
          <div className="management-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => void action("edit")}
            >
              Save changes & sharing choice
            </button>
            <button
              className="button secondary"
              disabled={busy || record.status === "withdrawn"}
              onClick={() => void action("withdraw")}
            >
              Withdraw contribution
            </button>
            {!live && record.status === "pending" && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await approveDemo(id, token);
                    await refresh();
                    await load();
                    toast("Simulated approval completed in this browser only.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Simulate moderator approval
              </button>
            )}
            {record.status === "published" && (
              <Link className="text-link" to={`/experiences/${id}`}>
                View public experience ↗
              </Link>
            )}
          </div>
        </section>
      )}
      {!live && !record && (
        <div className="notice">
          <p>
            Older browser-local contributions are preserved privately and need a
            renewed public-version review.
          </p>
          <button
            className="text-link"
            onClick={async () => {
              try {
                setLegacy(await recoverLegacyDemo());
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Recover legacy demo contributions
          </button>
          {legacy.map((r) => (
            <p key={r.id}>
              <a href={managementLink(r.id, r.token)}>
                {r.role} · save this private link
              </a>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function RemindersPage() {
  const { toast } = useApp();
  const links = hashLink();
  const [id, setId] = useState(links.id ?? "");
  const [token, setToken] = useState(links.token ?? "");
  const [input, setInput] = useState({
    experience_type: "Internship" as Reminder["experience_type"],
    end_date: new Date().toISOString().slice(0, 10),
    email: "",
    consent: false,
  });
  const [requestId] = useState(() => crypto.randomUUID());
  const [enrollmentToken] = useState(newToken);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [clock, setClock] = useState(() => localDateTime(new Date()));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (links.id && links.token)
      void manageReminder(links.id, links.token, "read")
        .then(setReminder)
        .catch((e) => setError((e as Error).message));
  }, [links.id, links.token]);
  async function op(operation: "read" | "unsubscribe" | "complete") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await manageReminder(id, token, operation);
      setReminder(r);
      if (operation !== "read")
        toast(
          operation === "unsubscribe"
            ? "Reminder opted out."
            : "Reminder marked complete; further dispatch is suppressed.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <div className="page-heading">
        <div className="eyebrow">DON’T LET YOUR LESSONS DISAPPEAR</div>
        <h1>A nudge at the right time.</h1>
        <p>
          Opt in before your internship or consulting project ends. Your contact
          email stays private.
        </p>
      </div>
      {!reminder ? (
        <>
          <form
            className="form-card form-fields"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                const parsed = reminderSchema.parse(input);
                await enrollReminder(parsed, requestId, enrollmentToken);
                setId(requestId);
                setToken(enrollmentToken);
                setReminder(
                  await manageReminder(requestId, enrollmentToken, "read"),
                );
                setMessage(
                  live
                    ? "Enrollment saved privately. Email and scheduler configuration determine delivery."
                    : "Demo enrollment saved in this browser only. No email was sent.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Remind me to share my experience</h2>
            <label>
              Experience type
              <select
                value={input.experience_type}
                onChange={(e) =>
                  setInput({
                    ...input,
                    experience_type: e.target
                      .value as Reminder["experience_type"],
                  })
                }
              >
                {["Internship", "Consulting Project", "Full-Time", "Other"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Expected end date
              <input
                type="date"
                required
                value={input.end_date}
                onChange={(e) =>
                  setInput({ ...input, end_date: e.target.value })
                }
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                required
                maxLength={254}
                value={input.email}
                onChange={(e) => setInput({ ...input, email: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={input.consent}
                onChange={(e) =>
                  setInput({ ...input, consent: e.target.checked })
                }
              />
              <span>
                I consent to an experience-debrief reminder at this email. I can
                opt out using my private management link.
              </span>
            </label>
            <p className="small muted">
              Reminders become eligible at 09:00 UTC on the expected end date.{" "}
              {live
                ? "Delivery requires a configured sender and scheduled dispatcher."
                : "Demo mode: enrollment, preview, eligibility and dispatch are browser-local simulations only."}
            </p>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Schedule my reminder"}
              <ArrowRight size={16} />
            </button>
          </form>
          <details className="form-card">
            <summary>Open an existing private reminder</summary>
            <form
              className="form-fields"
              onSubmit={(e) => {
                e.preventDefault();
                void op("read");
              }}
            >
              <label>
                Reminder ID
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                />
              </label>
              <label>
                Reminder management token
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <button className="button" disabled={busy}>
                Open reminder
              </button>
            </form>
          </details>
        </>
      ) : (
        <section className="form-card reminder-card">
          <div className="section-heading">
            <h2>Your reminder</h2>
            <span className="badge">{reminder.status}</span>
          </div>
          <p>
            {reminder.experience_type} · ends {reminder.end_date}
          </p>
          <p className="small muted">Private recipient: {reminder.email}</p>
          <label>
            Save your private reminder link
            <input
              readOnly
              value={managementLink(id, token, "/reminders")}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="notice">
            <strong>Reminder preview</strong>
            <pre>{reminderMessage(reminder, location.origin, token).text}</pre>
            <p>Preview only. This does not send email.</p>
          </div>
          {!live && (
            <div className="simulation-controls">
              <h3>Demonstration clock & dispatch</h3>
              <p className="small muted">
                This clock affects the simulation only. Nothing is emailed.
              </p>
              <label>
                Simulation date and time
                <input
                  type="datetime-local"
                  value={clock}
                  onChange={(e) => setClock(e.target.value)}
                />
              </label>
              <p>
                Eligibility:{" "}
                <strong>
                  {reminderEligible(reminder, new Date(clock))
                    ? "Due for simulated dispatch"
                    : "Not due or suppressed"}
                </strong>{" "}
                · Attempts: {reminder.attempts}/3
              </p>
              <div className="management-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    setClock(
                      localDateTime(
                        new Date(Date.parse(reminder.next_attempt_at) + 60000),
                      ),
                    )
                  }
                >
                  Advance demo clock to next due time
                </button>
                {[false, true].map((fail) => (
                  <button
                    key={String(fail)}
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const result = await simulateReminder(
                          id,
                          token,
                          new Date(clock),
                          fail,
                        );
                        setReminder(result.reminder);
                        setMessage(result.message);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {fail
                      ? "Simulate provider failure"
                      : "Simulate dispatch — no email"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="management-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void op("unsubscribe")}
            >
              Unsubscribe reminder
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void op("complete")}
            >
              Mark experience debrief complete
            </button>
            <Link
              className="text-link"
              to={`/share#reminder=${id}&token=${token}`}
            >
              Share now & suppress reminder <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

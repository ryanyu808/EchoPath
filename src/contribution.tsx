import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type Submission, submissionSchema, experienceTypes } from "./domain";
import {
  sensitiveWarnings,
  publicFields,
} from "../supabase/functions/_shared/alignment";
import { useApp, ButtonLink } from "./ui";
import {
  approveDemo,
  hashLink,
  live,
  managementLink,
  newToken,
  publicCandidate,
  readLocal,
  saveLocal,
  submitExperience,
  track,
} from "./store";
import { demoExperiences } from "./data";
export const blankContribution: Submission = {
  experience_type: "Internship",
  role_title: "",
  company: "",
  industry: "",
  role_category: "Analytics",
  year: new Date().getFullYear(),
  duration: "",
  work_arrangement: "",
  responsibilities: "",
  projects: "",
  typical_day: "",
  tools: "",
  challenges: "",
  solutions: "",
  valuable_skills: "",
  lessons_learned: "",
  advice: "",
  outcomes: "",
  culture: "",
  contributor_display_name: "",
  anonymity_preference: "Anonymous",
  consent_to_publish: false,
};
export const contributionLabels: Record<string, string> = {
  experience_type: "Experience type",
  role_title: "Role title",
  company: "Company or organization",
  industry: "Industry",
  role_category: "Role category",
  year: "Year",
  duration: "Duration",
  work_arrangement: "Work arrangement",
  responsibilities: "What were your main responsibilities?",
  projects: "What projects did you work on?",
  typical_day: "What did a typical day or week look like?",
  tools: "What tools and technologies did you use?",
  challenges: "What was your biggest challenge?",
  solutions: "How did you overcome it?",
  valuable_skills: "What skills did you develop or use?",
  lessons_learned: "What do you wish you had known before starting?",
  advice:
    "What advice would you give someone preparing for a similar opportunity?",
  outcomes: "What business outcomes did your work support?",
  culture: "What was the culture and work environment like?",
};
export function PublicReview({
  value,
  onChange,
  reviewed,
  onReview,
}: {
  value: Submission;
  onChange: (v: Submission) => void;
  reviewed: boolean;
  onReview: (v: boolean) => void;
}) {
  const warnings = sensitiveWarnings(value);
  return (
    <div className="public-review">
      <h3>Your anonymous public version</h3>
      <p className="small muted">
        Seekers see only this reviewed version after approval. Your original
        answers stay private. Names, contacts, clients and indirect identifiers
        need your review; automated checks are not a guarantee.
      </p>
      <div className="submission-preview">
        <h3>{value.role_title || "Your role"}</h3>
        <p>
          {value.company} · {value.industry} · {value.year}
        </p>
        {publicFields
          .filter(
            (k) =>
              ![
                "role_title",
                "company",
                "industry",
                "year",
                "experience_type",
                "role_category",
              ].includes(k) && value[k],
          )
          .map((k) => (
            <div key={k}>
              <h4>{contributionLabels[k]}</h4>
              <p>{String(value[k])}</p>
            </div>
          ))}
        <p>
          <strong>Shared by:</strong> Anonymous contributor
        </p>
      </div>
      <details>
        <summary>Edit the public wording</summary>
        <div className="form-fields">
          {publicFields
            .filter((k) => k !== "year" && k !== "experience_type")
            .map((k) => (
              <label key={k}>
                Public: {contributionLabels[k]}
                <textarea
                  value={String(value[k] ?? "")}
                  rows={2}
                  maxLength={
                    ["role_title", "company"].includes(k)
                      ? 120
                      : k === "industry" || k === "role_category"
                        ? 100
                        : k === "duration" || k === "work_arrangement"
                          ? 80
                          : 5000
                  }
                  onChange={(e) => {
                    onChange({ ...value, [k]: e.target.value });
                    onReview(false);
                  }}
                />
              </label>
            ))}
        </div>
      </details>
      {warnings.length > 0 && (
        <div className="notice" role="status">
          <strong>Review before sharing</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p>
            Use a range (“roughly 10–20%”) or qualitative wording (“improved
            efficiency”) if a figure is confidential. Remove client and
            identifying details.
          </p>
        </div>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => onReview(e.target.checked)}
        />
        <span>
          I reviewed this public version for identifying and confidential
          information, including any flagged exact figures.
        </span>
      </label>
    </div>
  );
}
export function Share() {
  const { toast, refresh } = useApp();
  const navigate = useNavigate();
  const key = live ? "draft-live-v2" : "draft-demo-v2";
  const [draft, setDraft] = useState<Submission>(() => ({
    ...blankContribution,
    ...readLocal<Partial<Submission>>(key, {}),
  }));
  const [step, setStep] = useState(0);
  const [candidate, setCandidate] = useState<Submission | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [draftError, setDraftError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    id: string;
    status: string;
    processing: string;
  } | null>(null);
  const [token] = useState(newToken);
  const [requestId] = useState(() => crypto.randomUUID());
  const [timing] = useState(() => {
    const saved = readLocal<{ flow_id: string; started_at: number } | null>(
      key + "-timing",
      null,
    );
    return saved &&
      typeof saved.flow_id === "string" &&
      typeof saved.started_at === "number"
      ? saved
      : { flow_id: crypto.randomUUID(), started_at: Date.now() };
  });
  const started = useRef(timing.started_at);
  const flowId = useRef(timing.flow_id);
  const began = useRef(false);
  const lock = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!began.current) {
      began.current = true;
      if (
        !readLocal<{ event: string; flow_id?: string }[]>("events", []).some(
          (e) => e.event === "submission_start" && e.flow_id === flowId.current,
        )
      )
        track("submission_start", { flow_id: flowId.current });
    }
  }, []);
  useEffect(() => {
    try {
      saveLocal(key, draft);
      saveLocal(key + "-timing", timing);
    } catch (e) {
      setTimeout(() => setDraftError((e as Error).message), 0);
    }
  }, [draft, key, timing]);
  const requiredSteps = [
    ["experience_type", "role_title", "company", "industry"],
    ["tools", "responsibilities", "valuable_skills"],
    ["advice"],
    [],
  ];
  function update(k: string, value: unknown) {
    setDraft((d) => ({ ...d, [k]: value }));
    setCandidate(null);
    setReviewed(false);
    setErrors((e) => ({ ...e, [k]: "" }));
  }
  function validate() {
    const parse = submissionSchema.safeParse(draft);
    const next: Record<string, string> = {};
    if (!parse.success)
      for (const issue of parse.error.issues) {
        const k = String(issue.path[0]);
        if (step === 3 || requiredSteps[step].includes(k))
          next[k] = issue.message;
      }
    if (step === 3 && draft.consent_to_publish && !reviewed)
      next.review =
        "Review the anonymized public version before requesting publication.";
    const publicParse = submissionSchema.safeParse(
      candidate ?? publicCandidate(draft),
    );
    if (step === 3 && draft.consent_to_publish && !publicParse.success)
      next.public =
        "The public version needs a role, company, industry, responsibilities, tools, skills and advice. Review its fields.";
    setErrors(next);
    return !Object.keys(next).length;
  }
  function move(n: number) {
    setStep(n);
    setFailure("");
    setTimeout(() => titleRef.current?.focus(), 0);
  }
  function field(k: keyof Submission, required = false) {
    const options =
      k === "experience_type"
        ? [...experienceTypes]
        : k === "role_category"
          ? [
              "Analytics",
              "Consulting",
              "Data Science",
              "Product",
              "Marketing",
              "Business Intelligence",
              "Operations",
              "Other",
            ]
          : k === "work_arrangement"
            ? ["", "Remote", "Hybrid", "On-site"]
            : null;
    return (
      <label key={k}>
        {contributionLabels[k]}
        {required ? (
          <span className="required"> *</span>
        ) : (
          <small className="optional"> Optional</small>
        )}
        {options ? (
          <select
            value={String(draft[k] ?? "")}
            onChange={(e) => update(k, e.target.value)}
          >
            {options.map((v) => (
              <option key={v} value={v}>
                {v || "Not specified"}
              </option>
            ))}
          </select>
        ) : ["role_title", "company", "industry", "year", "duration"].includes(
            k,
          ) ? (
          <input
            type={k === "year" ? "number" : "text"}
            min={k === "year" ? 2000 : undefined}
            max={k === "year" ? 2100 : undefined}
            maxLength={k === "duration" ? 80 : 120}
            value={String(draft[k] ?? "")}
            onChange={(e) =>
              update(k, k === "year" ? Number(e.target.value) : e.target.value)
            }
            aria-invalid={!!errors[k]}
          />
        ) : (
          <textarea
            rows={k === "tools" || k === "valuable_skills" ? 2 : 3}
            maxLength={5000}
            value={String(draft[k] ?? "")}
            onChange={(e) => update(k, e.target.value)}
            aria-invalid={!!errors[k]}
            placeholder={
              k === "tools"
                ? "SQL, Python, Tableau…"
                : k === "outcomes"
                  ? "Describe the impact; use ranges or qualitative wording when figures are sensitive."
                  : undefined
            }
          />
        )}
        {errors[k] && <small className="error">{errors[k]}</small>}
      </label>
    );
  }
  async function submit() {
    if (lock.current || !validate()) return;
    lock.current = true;
    setBusy(true);
    setFailure("");
    try {
      const links = hashLink();
      const value = await submitExperience(
        submissionSchema.parse(draft),
        requestId,
        {
          token,
          publicVersion: candidate ?? publicCandidate(draft),
          reviewed,
          reminderId: links.reminder,
          reminderToken: links.token,
        },
      );
      setSuccess(value);
      track("submission_success", {
        flow_id: flowId.current,
        duration_ms: Date.now() - started.current,
      });
      saveLocal(key, {});
      saveLocal(key + "-timing", null);
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="container page narrow">
        <div className="success-panel">
          <CheckCircle2 size={45} />
          <h1>
            {live
              ? "Your contribution is saved privately."
              : "Your local demo submission is saved."}
          </h1>
          <p>
            {success.status === "draft"
              ? "You chose to keep this contribution private. It is not in the library."
              : "Your reviewed public version is pending approval. The original is private."}{" "}
            {!live &&
              "Everything is stored in this browser only; nothing was shared with a server."}
          </p>
          <div className="notice">{success.processing}</div>
          <label className="management-link">
            Save your private management link
            <input
              readOnly
              value={managementLink(success.id, token)}
              onFocus={(e) => e.target.select()}
            />
            <small>
              Anyone with this link can manage this contribution. Tokens are not
              recoverable from public data.
            </small>
          </label>
          <ButtonLink to={`/manage#id=${success.id}&token=${token}`}>
            Manage, edit or withdraw
          </ButtonLink>
          {!live && success.status === "pending" && (
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await approveDemo(success.id, token);
                  await refresh();
                  toast(
                    "Simulated moderator approval. Public version is available in this browser only.",
                  );
                  navigate(`/experiences/${success.id}`);
                } catch (e) {
                  setFailure((e as Error).message);
                }
              }}
            >
              Simulate approval & view insights <Sparkles size={16} />
            </button>
          )}
          {failure && (
            <p className="error" role="alert">
              {failure}
            </p>
          )}
          <Link className="text-link" to="/experiences">
            Explore the library
          </Link>
        </div>
      </div>
    );
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow">PAY YOUR EXPERIENCE FORWARD</div>
        <h1>Your story. Someone’s head start.</h1>
        <p>
          A short guided debrief. Five minutes is our target, not a verified
          completion time.
        </p>
      </div>
      <div className="share-layout">
        <aside className="share-sidebar">
          <div className="form-steps">
            {[
              "The basics",
              "The work",
              "Your perspective",
              "Privacy & preview",
            ].map((label, i) => (
              <div
                key={label}
                className={i === step ? "current" : i < step ? "done" : ""}
              >
                <span>{i < step ? <Check size={16} /> : i + 1}</span>
                <div>
                  <small>STEP {i + 1}</small>
                  <strong>{label}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className="notice">
            <ShieldCheck size={24} />
            <strong>Share insight, protect privacy.</strong>
            <p>
              Your original stays private. Review the anonymous version, then
              choose whether to request publication. Drafts autosave in this
              browser profile; avoid sensitive information.
            </p>
          </div>
          {!live && (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setDraft({
                  ...demoExperiences[0],
                  consent_to_publish: false,
                  contributor_display_name: "",
                  anonymity_preference: "Anonymous",
                });
                setCandidate(null);
                setReviewed(false);
                setErrors({});
                toast(
                  "Fictional example filled. Choose sharing and review before submitting.",
                );
              }}
            >
              Fill fictional demo example <Sparkles size={15} />
            </button>
          )}
          <Link className="text-link" to="/reminders">
            Still in your experience? Set a reminder <ArrowRight size={15} />
          </Link>
        </aside>
        <form
          className="form-card"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) {
              if (validate()) move(step + 1);
            } else void submit();
          }}
        >
          <div className="form-heading">
            <span>STEP {step + 1} OF 4 · DRAFT SAVES LOCALLY</span>
            <h2 ref={titleRef} tabIndex={-1}>
              {
                [
                  "Let’s start with the basics.",
                  "What did you actually work on?",
                  "What would you pass on?",
                  "Choose what others can see.",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "A little context helps someone find your path.",
                  "Tools, skills, and your real work matter most.",
                  "One useful piece of advice can be a head start.",
                  "Private originals are never shown to seekers.",
                ][step]
              }
            </p>
          </div>
          <div className="form-fields">
            {step === 0 ? (
              <>
                <div className="form-grid">
                  {(
                    [
                      "experience_type",
                      "role_title",
                      "company",
                      "industry",
                    ] as const
                  ).map((k) => field(k, true))}
                </div>
                <details>
                  <summary>Add dates and work context (optional)</summary>
                  <div className="form-grid">
                    {(
                      [
                        "role_category",
                        "year",
                        "duration",
                        "work_arrangement",
                      ] as const
                    ).map((k) => field(k))}
                  </div>
                </details>
              </>
            ) : step === 1 ? (
              <>
                {field("tools", true)}
                {field("responsibilities", true)}
                {field("valuable_skills", true)}
                <details>
                  <summary>
                    Add projects and day-to-day detail (optional)
                  </summary>
                  <div className="form-fields">
                    {field("projects")}
                    {field("typical_day")}
                  </div>
                </details>
              </>
            ) : step === 2 ? (
              <>
                {field("advice", true)}
                {field("outcomes")}
                {field("culture")}
                <details>
                  <summary>Add challenges and lessons (optional)</summary>
                  <div className="form-fields">
                    {field("challenges")}
                    {field("solutions")}
                    {field("lessons_learned")}
                  </div>
                </details>
              </>
            ) : (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draft.consent_to_publish}
                    onChange={(e) => {
                      setDraft({
                        ...draft,
                        consent_to_publish: e.target.checked,
                      });
                      setReviewed(false);
                    }}
                  />
                  <span>
                    I consent to anonymous publication of the reviewed public
                    version. Leave unchecked to keep this contribution private.
                  </span>
                </label>
                <PublicReview
                  value={candidate ?? publicCandidate(draft)}
                  onChange={setCandidate}
                  reviewed={reviewed}
                  onReview={setReviewed}
                />
                {errors.review && (
                  <p role="alert" className="error">
                    {errors.review}
                  </p>
                )}
                {errors.public && (
                  <p role="alert" className="error">
                    {errors.public}
                  </p>
                )}
                <div className="notice">
                  {live
                    ? "Publication requires trusted moderation. When enabled, AI processes only the anonymized candidate, never the private original."
                    : "Demo mode: browser-local storage, template extraction and simulated moderation only. No AI request or shared-server save."}
                </div>
              </>
            )}
          </div>
          {draftError && (
            <p className="error" role="status">
              Draft autosave: {draftError}
            </p>
          )}
          {failure && (
            <p className="error" role="alert">
              {failure}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="text-link"
              onClick={() => (step ? move(step - 1) : navigate("/experiences"))}
            >
              <ArrowLeft size={16} />
              {step ? "Back" : "Cancel"}
            </button>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : step === 3 ? "Submit experience" : "Continue"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

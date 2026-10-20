import { Helpful, SynthesisPanel } from "./enhancements";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Filter,
  GitBranch,
  Layers3,
  MapPin,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { ButtonLink, ExperienceCard, Tags, useApp } from "./ui";
import {
  displayName,
  experienceTypes,
  filterExperiences,
  goalSchema,
  insightSchema,
  split,
  type Experience,
  type Goal,
  type Roadmap,
  skillTags,
} from "./domain";
import { generateRoadmap, live, loadRoadmap, saveLocal, track } from "./store";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow">
      <span />
      {children}
    </div>
  );
}
function LoadState() {
  const { error, refresh } = useApp();
  return error ? (
    <div role="alert" className="empty">
      <h3>We couldn’t load the library</h3>
      <p>{error}</p>
      <button className="button" onClick={() => void refresh()}>
        Try again
      </button>
    </div>
  ) : (
    <div
      className="card-grid"
      aria-label="Loading experiences"
      aria-busy="true"
    >
      {[1, 2, 3].map((n) => (
        <div key={n} className="skeleton" />
      ))}
    </div>
  );
}
export function Home() {
  const { experiences, loading, error } = useApp();
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <Eyebrow>YOUR NEXT CHAPTER STARTS HERE</Eyebrow>
          <h1>
            Learn from the paths
            <br />
            already <span>taken.</span>
            <svg viewBox="0 0 250 14" aria-hidden="true">
              <path d="M3 10 Q115 -3 245 6" />
            </svg>
          </h1>
          <p>
            Discover real internship and consulting project experiences from
            students who’ve been there. Explore the skills, challenges, and
            lessons that can help you prepare for what’s next.
          </p>
          <div className="hero-actions">
            <ButtonLink to="/experiences">Explore experiences</ButtonLink>
            <ButtonLink to="/share" secondary>
              Share your experience
            </ButtonLink>
          </div>
          <div className="community-note">
            <div className="avatars">
              <span>↗</span>
              <span>⌘</span>
              <span>✧</span>
            </div>
            <div>
              Built for the <strong>USC Marshall MSBA</strong> community
              <br />
              <small>Shared knowledge. A clearer way forward.</small>
            </div>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Product preview: discover an experience and turn its lessons into a preparation plan"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="preview-label">
            <span className="status-dot" /> A little insight. A big head start.
          </div>
          <div className="preview-window">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
              <small>YOUR EXPERIENCE LIBRARY</small>
              <BookOpen size={15} />
            </div>
            <div className="preview-content">
              <div className="preview-head">
                <span className="company-icon tone-1">NL</span>
                <div>
                  <strong>Business Analytics Intern</strong>
                  <small>Northstar Labs · Fictional example</small>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <p>“Agree on a metric definition before writing a query.”</p>
              <Tags values={["SQL", "Python", "Tableau"]} />
              <div className="preview-insight">
                <Sparkles size={18} />
                <div>
                  <strong>From experience to insight</strong>
                  <small>Skills, practical lessons, and your next steps.</small>
                </div>
              </div>
            </div>
          </div>
          <div className="floating-card">
            <span className="floating-icon">
              <Compass size={23} />
            </span>
            <div>
              <small>YOUR NEXT STEP</small>
              <strong>A plan with a purpose.</strong>
              <span>Experience → preparation → possibility</span>
            </div>
            <CheckCircle2 size={19} />
          </div>
          <div className="art-caption">
            A glimpse of what’s possible <span>↗</span>
          </div>
        </div>
      </section>
      <section className="value-strip">
        <div className="container">
          <span>
            Less guesswork.
            <br />
            <strong>More perspective.</strong>
          </span>
          <div>
            <BookOpen />
            <p>
              Beyond the job description
              <small>See what the work actually looks like.</small>
            </p>
          </div>
          <div>
            <Layers3 />
            <p>
              Lessons you can build on
              <small>Tools, challenges, and honest takeaways.</small>
            </p>
          </div>
          <div>
            <Compass />
            <p>
              Preparation with direction
              <small>Turn shared insights into a personal plan.</small>
            </p>
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <Eyebrow>THE EXPERIENCE LIBRARY</Eyebrow>
            <h2>A look inside someone’s next step.</h2>
            <p className="muted">
              Different paths. Practical perspectives. Find the one that speaks
              to you.
            </p>
          </div>
          <Link className="text-link" to="/experiences">
            View all experiences <ArrowRight size={17} />
          </Link>
        </div>
        {loading || error ? (
          <LoadState />
        ) : (
          <div className="card-grid">
            {experiences.slice(0, 3).map((e) => (
              <ExperienceCard key={e.id} e={e} />
            ))}
          </div>
        )}
        {!live && (
          <p className="sample-note">
            Explore fictional examples created for this prototype. These are not
            verified student or alumni accounts.
          </p>
        )}
      </section>
      <section className="how-section">
        <div className="container section">
          <Eyebrow>A CLEARER PATH FORWARD</Eyebrow>
          <h2>A shared experience can change your next one.</h2>
          <div className="steps-grid">
            {[
              [
                BookOpen,
                "01",
                "Explore real experiences.",
                "Find roles, industries, and projects that match your curiosity.",
              ],
              [
                Sparkles,
                "02",
                "Discover skills and lessons.",
                "Go beyond the title to understand the tools, challenges, and takeaways.",
              ],
              [
                Compass,
                "03",
                "Build your preparation roadmap.",
                "Turn what you learn into practical, weekly steps toward your goals.",
              ],
            ].map(([Icon, n, title, body]) => {
              const I = Icon as typeof BookOpen;
              return (
                <div key={String(n)}>
                  <div className="step-icon">
                    <I />
                    <span>{String(n)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="contribute-banner">
          <div>
            <span>YOUR EXPERIENCE HAS A NEXT CHAPTER.</span>
            <h2>
              You’ve been there.
              <br />
              Help someone get there.
            </h2>
            <p>
              The small things you learned could make a big difference
              <br />
              for the student who follows your path.
            </p>
          </div>
          <ButtonLink to="/share">Share your experience</ButtonLink>
          <GitBranch className="banner-art" size={220} />
        </div>
      </section>
    </>
  );
}

export function Library() {
  const { experiences, loading, error } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const filters = Object.fromEntries(
    ["experience_type", "industry", "role_category", "skills", "year"].map(
      (k) => [k, params.get(k) ?? ""],
    ),
  );
  const sort = params.get("sort") ?? "recent";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const results = filterExperiences(experiences, q, filters, sort);
  const active = !!q || Object.values(filters).some(Boolean);
  const discoveryKey = JSON.stringify([q, ...Object.values(filters)]);
  const discoveryFlow = useRef(crypto.randomUUID());
  const resultCount = results.length;
  useEffect(() => {
    if (active) {
      const t = setTimeout(
        () =>
          track("experience_search", {
            flow_id: discoveryFlow.current,
            results_count: resultCount,
          }),
        600,
      );
      return () => clearTimeout(t);
    }
  }, [discoveryKey, active, resultCount]);
  const options = (key: keyof Experience) =>
    [
      ...new Set(
        experiences.flatMap((e) => [
          String(e[key]),
          ...(key === "role_category"
            ? (e.insights?.role_categories ?? [])
            : key === "industry"
              ? (e.insights?.industries ?? [])
              : []),
        ]),
      ),
    ].sort();
  return (
    <div className="container page">
      <div className="page-heading">
        <Eyebrow>LEARN FROM WHAT CAME BEFORE</Eyebrow>
        <h1>Find a path that inspires yours.</h1>
        <p>
          Explore the work behind the title. Take the next step with a little
          more perspective.
        </p>
      </div>
      <div className="library-layout">
        <aside className="filter-panel">
          <div className="section-heading">
            <strong>
              <Filter size={17} /> Refine your search
            </strong>
            {active && (
              <button className="text-link" onClick={() => setParams({})}>
                Reset
              </button>
            )}
          </div>
          {[
            [
              "skills",
              "Skills",
              [...new Set(experiences.flatMap((e) => skillTags(e)))].sort(),
            ],
            ["experience_type", "Experience type", [...experienceTypes]],
            ["industry", "Industry", options("industry")],
            ["role_category", "Role category", options("role_category")],
            ["year", "Year", options("year").reverse()],
          ].map(([key, label, values]) => (
            <label key={String(key)}>
              {String(label)}
              <select
                value={filters[String(key)]}
                onChange={(e) => update(String(key), e.target.value)}
              >
                <option value="">
                  All {String(label).toLowerCase()}
                  {key === "industry" ? " categories" : ""}
                </option>
                {(values as string[]).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          <div className="filter-help">
            <Compass size={24} />
            <h4>Make it your next step.</h4>
            <p>
              Found an interesting path? Turn its lessons into your preparation
              plan.
            </p>
            <Link to="/roadmap">
              Build a roadmap <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
        <div className="library-results">
          <div className="search-box">
            <Search size={21} />
            <input
              aria-label="Search experiences"
              placeholder="Search roles, companies, skills, or lessons…"
              value={q}
              onChange={(e) => update("q", e.target.value)}
            />
            {q && (
              <button aria-label="Clear search" onClick={() => update("q", "")}>
                <X size={18} />
              </button>
            )}
            <kbd>EXPLORE</kbd>
          </div>
          <div className="results-toolbar">
            <p>
              <strong>{results.length}</strong>{" "}
              {results.length === 1 ? "experience" : "experiences"}
              {!live && <span> · Demo library</span>}
            </p>
            <label>
              Sort by{" "}
              <select
                aria-label="Sort experiences"
                value={sort}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="recent">Most recent</option>
                <option value="company">Company name</option>
                <option value="role">Role title</option>
              </select>
            </label>
          </div>
          {loading || error ? (
            <LoadState />
          ) : results.length ? (
            <>
              <SynthesisPanel
                key={results.map((e) => e.id + ":" + e.revision).join(",")}
                sources={results.slice(0, 20)}
                total={results.length}
              />
              <div className="card-grid library-cards">
                {results.map((e) => (
                  <ExperienceCard key={e.id} e={e} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <Search size={35} />
              <h2>No paths found just yet.</h2>
              <p>Try another skill or broaden your filters.</p>
              <button
                className="button secondary"
                onClick={() => setParams({})}
              >
                Reset search & filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightPanel({ e }: { e: Experience }) {
  const parsed = insightSchema.safeParse(e.insights);
  if (!parsed.success)
    return (
      <div className="insight-panel">
        <Sparkles />
        <h3>Insights are not available yet</h3>
        <p>
          The original contribution is preserved. The project team can retry
          processing securely.
        </p>
      </div>
    );
  const template = ["demo-template", "rules-no-ai"].includes(
    e.model_version ?? "",
  );
  return (
    <div className="insight-panel">
      <div className="eyebrow">
        <Sparkles size={17} />
        {template ? "TEMPLATE-EXTRACTED INSIGHTS" : "AI-EXTRACTED INSIGHTS"}
      </div>
      <h3>The takeaways, at a glance.</h3>
      <p>
        {template
          ? "Deterministic organization of the written contribution. No AI was used."
          : "AI extraction from this contribution. Check the original account for context."}
      </p>
      {[
        ["Technical skills", parsed.data.technical_skills],
        ["Business skills", parsed.data.business_skills],
        ["Key lessons", parsed.data.key_lessons],
        ["Suggested preparation", parsed.data.preparation_recommendations],
      ].map(([title, items]) => (
        <div key={String(title)}>
          <h4>{String(title)}</h4>
          <ul>
            {(items as string[]).map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
export function Detail() {
  const { id } = useParams();
  const { experiences, loading, error } = useApp();
  const e = experiences.find((e) => e.id === id);
  useEffect(() => {
    if (e) track("experience_detail_view");
  }, [e]);
  if (loading || error)
    return (
      <div className="container page">
        <LoadState />
      </div>
    );
  if (!e)
    return (
      <div className="container empty">
        <h1>Experience not found</h1>
        <p>
          It may not be published yet, or this browser doesn’t have that local
          submission.
        </p>
        <ButtonLink to="/experiences">Return to the library</ButtonLink>
      </div>
    );
  const related = experiences
    .filter((other) => other.id !== e.id)
    .sort((a, b) => relatedScore(b, e) - relatedScore(a, e))
    .slice(0, 3);
  return (
    <div className="container page">
      <Link className="back-link" to="/experiences">
        <ArrowLeft size={16} />
        Back to the library
      </Link>
      <div className="detail-heading">
        <div className={`company-icon large tone-${e.company.length % 4}`}>
          {e.company
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <Tags
            values={[
              e.experience_type,
              e.provenance === "fictional"
                ? "Fictional example"
                : e.provenance === "local"
                  ? "Browser-local submission"
                  : "Published community contribution",
            ]}
          />
          <h1>{e.role_title}</h1>
          <p>
            {e.company} <span>· {e.industry}</span>
          </p>
        </div>
      </div>
      <div className="detail-meta">
        <span>
          <Clock3 size={17} />
          {e.year} · {e.duration}
        </span>
        <span>
          <MapPin size={17} />
          {e.work_arrangement || "Arrangement not provided"}
        </span>
        <span>
          <BookOpen size={17} />
          {displayName(e)}
          {e.provenance === "fictional" ? " · fictional persona" : ""}
        </span>
      </div>
      <div className="detail-grid">
        <article>
          {[
            [
              "What I actually did",
              [
                ["Main responsibilities", e.responsibilities],
                ["Projects I worked on", e.projects],
                ["A typical day or week", e.typical_day],
              ],
            ],
            [
              "Tools & skills",
              [
                ["Tools and technologies", e.tools],
                ["Skills that mattered", e.valuable_skills],
              ],
            ],
            [
              "Challenges & how I worked through them",
              [
                ["The challenge", e.challenges],
                ["The approach", e.solutions],
              ],
            ],
            ["Lessons learned", [["What I wish I knew", e.lessons_learned]]],
            ["Advice for future students", [["Start here", e.advice]]],
            [
              "Outcomes & work environment",
              [
                ["Business outcomes", e.outcomes || "Not provided"],
                ["Culture", e.culture || "Not provided"],
              ],
            ],
          ].map(([title, sections]) => (
            <section className="detail-section" key={String(title)}>
              <h2>{String(title)}</h2>
              {(sections as string[][]).map(([label, value]) => (
                <div key={label}>
                  <h4>{label}</h4>
                  <p>{value}</p>
                </div>
              ))}
            </section>
          ))}
        </article>
        <aside>
          <InsightPanel e={e} />
          <Helpful key={e.id} type="experience" id={e.id} />
          <div className="roadmap-cta">
            <Compass size={30} />
            <h3>Turn insight into action.</h3>
            <p>
              Use this experience to inform a plan for your next opportunity.
            </p>
            <ButtonLink to={`/roadmap?source=${e.id}`}>
              Build my preparation roadmap
            </ButtonLink>
          </div>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="section">
          <h2>Keep exploring.</h2>
          <div className="card-grid">
            {related.map((r) => (
              <ExperienceCard key={r.id} e={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
function relatedScore(a: Experience, b: Experience) {
  return (
    Number(a.industry === b.industry) * 3 +
    Number(a.role_category === b.role_category) * 3 +
    split(a.tools).filter((s) => split(b.tools).includes(s)).length
  );
}

export { Share } from "./contribution";

export function RoadmapPage() {
  const { experiences, toast, loading, error } = useApp();
  const [params] = useSearchParams();
  const [goal, setGoal] = useState<Goal>({
    target_role: "Business Analyst",
    target_industry: "Technology",
    existing_skills: "Excel",
    target_skills: "SQL, Python, Data storytelling",
    weeks: 4,
  });
  const [selected, setSelected] = useState<string[]>(
    params.get("source") ? [params.get("source")!] : [],
  );
  const [roadmap, setRoadmap] = useState<Roadmap | null>(loadRoadmap);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  function persist(value: Roadmap) {
    saveLocal(live ? "roadmap-live" : "roadmap-demo", value);
    setRoadmap(value);
  }
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFailure("");
    const parsed = goalSchema.safeParse(goal);
    if (!parsed.success) {
      setFailure(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    track("roadmap_generation_attempt");
    try {
      const sources = experiences.filter((e) => selected.includes(e.id));
      const value = await generateRoadmap(parsed.data, sources);
      persist(value);
      track("roadmap_generation_success");
      toast("Roadmap generated. Progress saves in this browser.");
      setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sourceIds = roadmap?.source_experience_ids ?? [];
  const sourceItems = experiences.filter((e) => sourceIds.includes(e.id));
  return (
    <div className="container page">
      <div className="page-heading">
        <Eyebrow>FROM PERSPECTIVE TO PROGRESS</Eyebrow>
        <h1>Your next step, with a little direction.</h1>
        <p>
          Bring your goals. Build a practical roadmap informed by the
          experiences you choose.
        </p>
      </div>
      <div className="roadmap-layout">
        <form className="form-card roadmap-form" onSubmit={generate}>
          <div className="section-heading">
            <h2>Chart your path</h2>
            <Compass size={23} />
          </div>
          <label>
            Target role
            <input
              value={goal.target_role}
              maxLength={120}
              required
              minLength={3}
              onChange={(e) =>
                setGoal({ ...goal, target_role: e.target.value })
              }
            />
          </label>
          <label>
            Target industry
            <input
              value={goal.target_industry}
              maxLength={100}
              required
              minLength={3}
              onChange={(e) =>
                setGoal({ ...goal, target_industry: e.target.value })
              }
            />
          </label>
          <label>
            Skills you already have
            <input
              value={goal.existing_skills}
              maxLength={500}
              onChange={(e) =>
                setGoal({ ...goal, existing_skills: e.target.value })
              }
              placeholder="Separate skills with commas"
            />
          </label>
          <label>
            Skills you want to develop
            <input
              value={goal.target_skills}
              maxLength={500}
              onChange={(e) =>
                setGoal({ ...goal, target_skills: e.target.value })
              }
            />
          </label>
          <label>
            Preparation time
            <select
              value={goal.weeks}
              onChange={(e) =>
                setGoal({ ...goal, weeks: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "week" : "weeks"}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>
              Experiences to learn from <small>Choose up to 5</small>
            </legend>
            {loading || error ? (
              <LoadState />
            ) : (
              <div className="source-selector">
                {experiences.map((e) => (
                  <label key={e.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      disabled={
                        selected.length >= 5 && !selected.includes(e.id)
                      }
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(e.id)
                            ? s.filter((id) => id !== e.id)
                            : [...s, e.id],
                        )
                      }
                    />
                    <span>
                      <strong>{e.role_title}</strong>
                      <small>
                        {e.company} ·{" "}
                        {e.provenance === "fictional"
                          ? "Fictional example"
                          : e.provenance === "local"
                            ? "Local submission"
                            : "Published"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {!selected.length && (
            <div className="notice">
              No sources selected. Your roadmap will contain clearly labeled
              general recommendations.
            </div>
          )}
          <p className="small muted">
            {live
              ? "When enabled, AI receives your goals and selected published records. If no AI key is configured, a template is used."
              : "Demo: deterministic templates, not real AI. Fictional examples provide illustrative advice."}{" "}
            Goals and progress save only in this browser.
          </p>
          {failure && (
            <p className="error" role="alert">
              {failure}
            </p>
          )}
          <button className="button full" disabled={busy || loading || !!error}>
            <Sparkles size={17} />
            {busy ? "Generating roadmap…" : "Build my roadmap"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div ref={resultRef} className="roadmap-result">
          {roadmap ? (
            <>
              <div className="section-heading">
                <Tags values={[roadmap.mode]} />
                <button
                  className="button secondary print-button"
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  Print / PDF
                </button>
              </div>
              <h2>Your path to {roadmap.goal.target_role}.</h2>
              <p className="muted">{roadmap.summary}</p>
              <div className="roadmap-progress">
                <span>
                  {roadmap.completed.length} of {roadmap.tasks.length}{" "}
                  milestones complete
                </span>
                <progress
                  value={roadmap.completed.length}
                  max={roadmap.tasks.length}
                />
              </div>
              <div className="prep-summary">
                <h3>Skills to develop</h3>
                <Tags values={roadmap.skills} />
                {[
                  ["Technical preparation", roadmap.technical_preparation],
                  ["Business preparation", roadmap.business_preparation],
                  ["Practice projects", roadmap.practice_projects],
                  ["Interview & onboarding", roadmap.interview_preparation],
                ].map(([label, items]) => (
                  <details key={String(label)}>
                    <summary>
                      {String(label)}
                      <ChevronDown size={16} />
                    </summary>
                    <ul>
                      {(items as string[]).map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
              <div className="timeline">
                {roadmap.tasks.map((task, i) => (
                  <div
                    key={i}
                    className={`timeline-item ${roadmap.completed.includes(String(i)) ? "completed" : ""}`}
                  >
                    <span className="week-label">WEEK {task.week_number}</span>
                    <div className="milestone">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={roadmap.completed.includes(String(i))}
                          onChange={() => {
                            try {
                              persist({
                                ...roadmap,
                                completed: roadmap.completed.includes(String(i))
                                  ? roadmap.completed.filter(
                                      (id) => id !== String(i),
                                    )
                                  : [...roadmap.completed, String(i)],
                              });
                            } catch (e) {
                              toast((e as Error).message);
                            }
                          }}
                        />
                        <h3>{task.title}</h3>
                      </label>
                      <p>{task.description}</p>
                      <div className="task-sources">
                        <small>
                          {task.source_ids.length
                            ? "Informed by selected experience · exercise is a preparation suggestion"
                            : "General preparation suggestion · no contributed evidence"}
                        </small>
                        {task.source_ids.map((id) => {
                          const e = experiences.find((e) => e.id === id);
                          return (
                            <Link key={id} to={`/experiences/${id}`}>
                              {e
                                ? `${e.company} · ${e.role_title}`
                                : "Source unavailable in this library"}
                              <ArrowUpRight size={12} />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="evidence-panel">
                <h3>
                  <BookOpen size={20} />
                  The experiences behind your plan
                </h3>
                {sourceItems.length ? (
                  sourceItems.map((e) => (
                    <Link key={e.id} to={`/experiences/${e.id}`}>
                      <strong>
                        {e.company} · {e.role_title}
                      </strong>
                      <span>Contributor advice: {e.advice}</span>
                      <small>
                        {e.provenance === "fictional"
                          ? "Fictional example — not alumni evidence"
                          : e.provenance === "local"
                            ? "Browser-local submission"
                            : "Published contribution"}
                      </small>
                    </Link>
                  ))
                ) : (
                  <p>
                    No accessible source records. Treat this plan as general
                    suggestions.
                  </p>
                )}
                {sourceItems.length < sourceIds.length && (
                  <p>
                    Some previously selected records are no longer available.
                    Their details cannot be verified here.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="roadmap-placeholder">
              <div className="placeholder-orbit">
                <Compass size={50} />
              </div>
              <Eyebrow>A LITTLE CLARITY GOES A LONG WAY</Eyebrow>
              <h2>
                Big goals.
                <br />
                Achievable next steps.
              </h2>
              <p>
                Choose what you’re working toward and the experiences you want
                to learn from. Your weekly preparation plan will appear here.
              </p>
              <div>
                <span>
                  <Target size={18} />
                  Specific skills
                </span>
                <span>
                  <Clock3 size={18} />
                  Weekly milestones
                </span>
                <span>
                  <BookOpen size={18} />
                  Visible sources
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function About() {
  return (
    <div className="container page about-page">
      <Eyebrow>THE STORY BEHIND ECHOPATH</Eyebrow>
      <h1>
        Good advice shouldn’t
        <br />
        depend on who you know.
      </h1>
      <p className="lead">
        The most useful career insights often live in a conversation you never
        had. We’re creating a place where those lessons can travel further.
      </p>
      <div className="about-grid">
        <div>
          <h2>From scattered stories to shared knowledge.</h2>
          <p>
            Job descriptions tell you the title. They rarely tell you which
            tools you’ll open on Monday, what will be difficult, or what you’ll
            wish you had practiced.
          </p>
          <p>
            EchoPath helps the USC Marshall MS Business Analytics community
            share practical internship, consulting project, and early-career
            experiences. Contributors preserve the original story. Future
            students can search it, learn from it, and prepare with more
            context.
          </p>
          <h2>AI with a clear purpose.</h2>
          <p>
            When configured, OpenAI organizes contributions into structured
            skills, challenges, lessons, and preparation advice. Roadmaps use
            the selected published experiences as context. References show which
            records informed a task; general preparation suggestions are labeled
            separately. AI output can contain mistakes and should be checked
            against the original account.
          </p>
          <p>
            Without an AI connection, deterministic templates provide an
            explicitly labeled alternative. Demo organizations and experiences
            are fictional. They are not research findings, alumni testimony, or
            verified outcomes.
          </p>
          <h2>Your experience, shared thoughtfully.</h2>
          <p>
            All seeker-facing contributions are anonymous. Private originals are
            retained separately from reviewed public copies. Contributors can
            edit or withdraw using a scoped private management link.
            Contributions require consent and should never include employer
            secrets, client data, or personal details about others. Persistent
            submissions await trusted moderation before publication. Withdrawal
            removes future public access; previously downloaded or cached copies
            may remain. The project team handles deletion requests through
            trusted administration.
          </p>
          <p>
            In community mode, submitted experience text may be sent to OpenAI
            if processing is enabled. Feedback is private to the project team.
            Personal roadmaps and task progress stay in your browser.
            Lightweight event counts stay in your browser too, with separate
            demo and live labels, and do not include search text or personal
            identifiers.
          </p>
          <p>
            Browser-local content is accessible to people who use the same
            browser profile. You can remove it through your browser’s site-data
            settings. Export local feedback and event records using the footer’s
            report action.
          </p>
        </div>
        <aside>
          <div className="insight-panel">
            <GitBranch size={36} />
            <h3>
              Real experiences.
              <br />
              Smarter next steps.
            </h3>
            <p>
              Built as a student-developed prototype for the 2026 USC Marshall
              Global MS Business Analytics AI Case Competition.
            </p>
            <p>
              EchoPath is an independent student project and is not an official
              USC service or endorsed university platform.
            </p>
            <ButtonLink to="/share">Add your perspective</ButtonLink>
          </div>
          <div className="notice">
            <ShieldCheck size={25} />
            <h3>Collect less. Explain more.</h3>
            <p>
              No account required. No public feedback feed. No invented user
              statistics. Clear sources and clear limits.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Search,
  Sparkles,
} from "lucide-react";
import { ExperienceCard, useApp } from "./ui";
import { split } from "./domain";
import { live } from "./store";
import "./landing.css";

const reducedMotion = () =>
  typeof window === "undefined" ||
  !window.matchMedia ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Adds .in to every [data-reveal] element once it scrolls into view.
function useReveal(root: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const items = root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!items?.length) return;
    if (!("IntersectionObserver" in window) || reducedMotion()) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.18 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Slowly rising, twinkling motes of light behind the hero copy.
function Particles() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || navigator.userAgent.includes("jsdom")) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const still = reducedMotion();
    let w = 0;
    let h = 0;
    let frame = 0;
    const dots = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 0.00035 + 0.0001,
      phase: Math.random() * Math.PI * 2,
    }));
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        if (!still) {
          d.y -= d.speed;
          if (d.y < -0.02) {
            d.y = 1.02;
            d.x = Math.random();
          }
        }
        // brighter near the spotlight in the top centre
        const focus = 1 - Math.min(1, Math.abs(d.x - 0.5) * 1.6);
        const twinkle = 0.55 + 0.45 * Math.sin(time / 900 + d.phase);
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(206, 186, 255, ${(0.15 + 0.6 * focus) * twinkle})`;
        ctx.shadowColor = "rgba(167, 139, 250, 0.9)";
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      if (!still) frame = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvas} className="lp-particles" aria-hidden="true" />;
}

const tokens: [string, number, number, number, boolean?][] = [
  // label, left %, top %, depth, boxed
  ["SQL", 9, 30, 0.6],
  ["Python", 15, 58, 1.1, true],
  ["A/B", 6, 76, 0.4],
  ["Σ x̄", 24, 20, 0.3],
  ["Tableau", 82, 26, 0.8],
  ["12 wks", 88, 52, 1.2, true],
  ["Δ +18%", 78, 74, 0.5],
  ["Case", 70, 14, 0.35, true],
  ["→", 93, 82, 0.7],
];

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const words = ["Learn", "from", "the", "paths"];
  const glow = ["already", "taken."];
  return (
    <section
      ref={ref}
      className="lp-hero"
      onPointerMove={(e) => {
        if (reducedMotion() || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty(
          "--mx",
          String((e.clientX - r.left) / r.width - 0.5),
        );
        ref.current.style.setProperty(
          "--my",
          String((e.clientY - r.top) / r.height - 0.5),
        );
      }}
    >
      <div className="lp-spot" aria-hidden="true" />
      <div className="lp-beam" aria-hidden="true" />
      <div className="lp-grid" aria-hidden="true" />
      <Particles />
      <div className="lp-tokens" aria-hidden="true">
        {tokens.map(([label, x, y, depth, boxed], i) => (
          <span
            key={label}
            className={boxed ? "boxed" : ""}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--d": depth,
                "--i": i,
              } as React.CSSProperties
            }
          >
            {label}
          </span>
        ))}
      </div>
      <div className="lp-hero-copy">
        <h1>
          <span className="lp-line">
            {words.map((w, i) => (
              <React.Fragment key={w}>
                <span
                  className="lp-word"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {w}
                </span>{" "}
              </React.Fragment>
            ))}
          </span>
          <span className="lp-line">
            {glow.map((w, i) => (
              <React.Fragment key={w}>
                <span
                  className="lp-word lp-glow"
                  style={{ "--i": i + words.length } as React.CSSProperties}
                >
                  {w}
                </span>
                {i < glow.length - 1 ? " " : ""}
              </React.Fragment>
            ))}
          </span>
        </h1>
        <p className="lp-fade" style={{ "--i": 7 } as React.CSSProperties}>
          Real internship and consulting project experiences from students
          who’ve been there — turned into a preparation plan you can follow.
        </p>
        <ul
          className="lp-checks lp-fade"
          style={{ "--i": 8 } as React.CSSProperties}
        >
          {["Real student stories", "Skills & lessons", "Learning calendar"].map(
            (t) => (
              <li key={t}>
                <Check size={13} />
                {t}
              </li>
            ),
          )}
        </ul>
        <div
          className="lp-actions lp-fade"
          style={{ "--i": 9 } as React.CSSProperties}
        >
          <Link className="lp-cta" to="/experiences">
            Explore experiences
            <span className="lp-cta-icon">
              <ArrowRight size={16} />
            </span>
          </Link>
          <Link className="lp-ghost" to="/share">
            Share yours
          </Link>
        </div>
      </div>
    </section>
  );
}

function Helix() {
  return (
    <div className="lp-helix" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          className="lp-strand"
          style={{ "--i": i } as React.CSSProperties}
        >
          <span />
          <i />
          <span />
        </div>
      ))}
    </div>
  );
}

// Sets --p (0 → 1) on the element as it scrolls through the viewport.
function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const travel = Math.max(1, r.height - vh);
      const p = (vh * 0.7 - r.top) / (vh * 0.7 + travel * 0.6);
      el.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(3));
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [ref]);
}

const examples = [
  "Business analytics internship",
  "Consulting project with Power BI",
  "Data science in healthcare",
  "Product strategy at a tech company",
];

// Types and erases example queries as the input's placeholder.
function useTypingPlaceholder(active: boolean) {
  const [text, setText] = useState(examples[0]);
  useEffect(() => {
    if (!active || reducedMotion()) return;
    let item = 0;
    let len = 0;
    let deleting = false;
    let timer = 0;
    const step = () => {
      const target = examples[item];
      len += deleting ? -1 : 1;
      setText(target.slice(0, len));
      let wait = deleting ? 28 : 55;
      if (!deleting && len === target.length) {
        deleting = true;
        wait = 1800;
      } else if (deleting && len === 0) {
        deleting = false;
        item = (item + 1) % examples.length;
        wait = 350;
      }
      timer = window.setTimeout(step, wait);
    };
    timer = window.setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, [active]);
  return text;
}

function SearchSection() {
  const { experiences } = useApp();
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  useScrollProgress(ref);
  const placeholder = useTypingPlaceholder(!query);
  const counts = new Map<string, [string, number]>();
  for (const e of experiences)
    for (const tool of split(e.tools)) {
      const key = tool.toLowerCase();
      counts.set(key, [
        counts.get(key)?.[0] ?? tool,
        (counts.get(key)?.[1] ?? 0) + 1,
      ]);
    }
  const chips = [...counts.values()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label]) => label);
  const go = (q: string) =>
    navigate(
      q.trim()
        ? `/experiences?q=${encodeURIComponent(q.trim())}`
        : "/experiences",
    );
  return (
    <section ref={ref} className="lp-search">
      <div className="lp-search-stage">
        <div className="lp-search-rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <form
          role="search"
          className="lp-search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            go(query);
          }}
        >
          <Search size={22} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label="Search the experience library"
            maxLength={120}
          />
          <button className="lp-cta" type="submit">
            Search
            <span className="lp-cta-icon">
              <ArrowRight size={16} />
            </span>
          </button>
        </form>
        <div className="lp-search-chips">
          {chips.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => go(c)}
              style={
                {
                  "--i": i,
                  "--sx": `${((i * 137) % 600) - 300}px`,
                  "--sy": `${((i * 89) % 260) + 120}px`,
                  "--sr": `${((i * 53) % 60) - 30}deg`,
                } as React.CSSProperties
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Home() {
  const { experiences, loading, error } = useApp();
  const page = useRef<HTMLDivElement>(null);
  useReveal(page, [loading]);
  return (
    <div className="lp" ref={page}>
      <Hero />

      <SearchSection />

      <div className="lp-marquee" aria-hidden="true">
        <div>
          {[0, 1].map((k) => (
            <span key={k}>
              Internships ✦ Consulting projects ✦ Case interviews ✦ Analytics
              roles ✦ Product data ✦&nbsp;
            </span>
          ))}
        </div>
      </div>

      <section className="lp-stack">
        <div className="lp-container lp-stack-inner">
          <div className="lp-stack-copy" data-reveal>
            <h2>
              Stop guessing what the job is <span>really</span> like.
            </h2>
            <p>
              Go beyond the title. See the tools, the challenges and the honest
              takeaways — then turn them into weekly steps toward your goal.
            </p>
            <div className="lp-actions">
              <Link className="lp-cta" to="/roadmap">
                Build my roadmap
                <span className="lp-cta-icon">
                  <Compass size={16} />
                </span>
              </Link>
            </div>
          </div>
          <div className="lp-stack-words" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                Next step
              </span>
            ))}
            <Helix />
          </div>
        </div>
      </section>

      <section className="lp-steps lp-container">
        {(
          [
            [
              BookOpen,
              "01",
              "Explore real experiences",
              "Find roles, industries and projects that match your curiosity.",
            ],
            [
              Sparkles,
              "02",
              "Discover skills & lessons",
              "Understand the tools, challenges and takeaways behind each role.",
            ],
            [
              Compass,
              "03",
              "Build your roadmap",
              "Turn what you learn into practical, weekly preparation steps.",
            ],
          ] as const
        ).map(([Icon, n, title, body], i) => (
          <article
            key={n}
            data-reveal
            style={{ "--i": i } as React.CSSProperties}
          >
            <div className="lp-step-head">
              <Icon size={20} />
              <span>{n}</span>
            </div>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="lp-library lp-container">
        <div className="lp-library-head" data-reveal>
          <div>
            <span className="lp-kicker">The experience library</span>
            <h2>A look inside someone’s next step.</h2>
          </div>
          <Link className="lp-link" to="/experiences">
            View all experiences <ArrowRight size={16} />
          </Link>
        </div>
        {loading || error ? (
          <div className="card-grid" aria-busy={loading}>
            {error ? (
              <p role="alert">{error}</p>
            ) : (
              [1, 2, 3].map((n) => <div key={n} className="skeleton" />)
            )}
          </div>
        ) : (
          <div className="card-grid" data-reveal>
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

      <section className="lp-horizon">
        <div className="lp-horizon-copy" data-reveal>
          <span className="lp-kicker">Your experience has a next chapter</span>
          <h2>
            You’ve been there.
            <br />
            Help someone get there.
          </h2>
          <Link className="lp-cta" to="/share">
            Share your experience
            <span className="lp-cta-icon">
              <ArrowRight size={16} />
            </span>
          </Link>
        </div>
        <div className="lp-planet" aria-hidden="true" />
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  Layers3,
  MessageSquareWarning,
  Plus,
  RotateCcw,
  ShieldAlert,
  Siren,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";

type Role = {
  function: string;
  owner: string;
  backup: string;
  channel: string;
};

type Answers = {
  organization: string;
  systemName: string;
  deployment: string;
  modelAccess: string;
  userBase: string;
  dataFlows: string;
  dependencies: string;
  autonomy: string;
  regulatedContext: string;
  rollbackTarget: string;
  commsChannel: string;
  evidenceLocation: string;
  roles: Role[];
};

type AnswerField = Exclude<keyof Answers, "roles">;

type Plan = {
  severity: string;
  triggers: string[];
  immediate: string[];
  containment: string[];
  rollback: string[];
  communications: string[];
  review: string[];
};

type ModalType = "export" | "reset" | "help" | null;

type Toast = {
  tone: "success" | "error" | "info";
  message: string;
};

const defaults: Answers = {
  organization: "Northstar Health AI",
  systemName: "Patient Triage Assistant",
  deployment: "SaaS application with API and web chat",
  modelAccess: "Hosted foundation model API with safety gateway",
  userBase: "Clinicians, support agents, and authenticated patients",
  dataFlows: "PHI enters prompt gateway, vector search retrieves clinical docs, logs flow to SIEM",
  dependencies: "Identity provider, feature flag service, vector database, model API, EHR connector",
  autonomy: "Advisory only, no direct writes without human confirmation",
  regulatedContext: "Healthcare, HIPAA, internal patient safety review",
  rollbackTarget: "Last approved prompt bundle and model route from production release 2026.07",
  commsChannel: "#ai-incident-war-room and PagerDuty SEV-1 policy",
  evidenceLocation: "SIEM case AI-SHUTDOWN, read-only log bucket, model trace archive",
  roles: [
    { function: "Incident commander", owner: "Alex Rivera", backup: "Mina Chen", channel: "PagerDuty + bridge" },
    { function: "ML systems lead", owner: "Priya Shah", backup: "Jon Bell", channel: "#ml-platform" },
    { function: "Product owner", owner: "Sam Okafor", backup: "Leah Grant", channel: "#ai-product" },
    { function: "Legal/compliance", owner: "Dana Ortiz", backup: "Chris Hale", channel: "Secure email" },
  ],
};

const scenarioPresets: Record<string, Partial<Answers>> = {
  "Chatbot jailbreak wave": {
    organization: "Acme Retail",
    systemName: "Customer Support Chatbot",
    deployment: "Public web chatbot and mobile SDK",
    modelAccess: "Hosted LLM behind moderation, prompt firewall, and rate limits",
    userBase: "Public customers and support staff",
    dataFlows: "Customer messages, account metadata, knowledge base retrieval, redacted chat logs",
    dependencies: "CDN, auth service, moderation API, vector search, CRM connector",
    autonomy: "Can draft support actions but cannot issue refunds without human approval",
    regulatedContext: "Consumer privacy, payment-data handling, brand safety",
    rollbackTarget: "Static rules-based support fallback and previous prompt policy",
  },
  "Healthcare hallucination": {
    ...defaults,
  },
  "Agentic unintended actions": {
    organization: "FinOps Labs",
    systemName: "Cloud Cost Optimization Agent",
    deployment: "Internal agent running scheduled jobs and Slack commands",
    modelAccess: "Self-hosted model with tool execution broker",
    userBase: "SRE, finance operations, and platform engineering",
    dataFlows: "Cloud billing data, IAM-scoped tool calls, ticket comments, action audit logs",
    dependencies: "Kubernetes, cloud IAM, policy engine, ticketing system, Slack app, billing API",
    autonomy: "Can open tickets, change budgets, and trigger approved infrastructure actions",
    regulatedContext: "SOX-adjacent financial controls and cloud governance",
    rollbackTarget: "Disable agent scheduler, revoke tool broker token, restore prior IAM policy",
  },
};

const steps = [
  { title: "Architecture", icon: Layers3 },
  { title: "Access", icon: ShieldAlert },
  { title: "Roles", icon: Users },
  { title: "Plan", icon: ClipboardCheck },
];

const STORAGE_KEY = "ai-shutdown-plan-draft-v1";

const emptyRole: Role = {
  function: "New response role",
  owner: "",
  backup: "",
  channel: "",
};

const requiredFieldsByStep: Record<number, Array<{ field: AnswerField; label: string }>> = {
  0: [
    { field: "organization", label: "Organization" },
    { field: "systemName", label: "AI system name" },
    { field: "deployment", label: "Deployment type" },
    { field: "dataFlows", label: "Data flows" },
    { field: "dependencies", label: "Critical dependencies" },
  ],
  1: [
    { field: "modelAccess", label: "Model access and safety controls" },
    { field: "userBase", label: "User base" },
    { field: "autonomy", label: "Autonomy and tool authority" },
    { field: "regulatedContext", label: "Regulatory or contractual context" },
    { field: "evidenceLocation", label: "Evidence archive location" },
  ],
  2: [
    { field: "rollbackTarget", label: "Rollback target" },
    { field: "commsChannel", label: "Incident channel" },
  ],
  3: [],
};

function validateStep(step: number, answers: Answers) {
  const fieldErrors = requiredFieldsByStep[step]
    .filter(({ field }) => !answers[field].trim())
    .map(({ label }) => label);
  const roleErrors =
    step === 2
      ? answers.roles.flatMap((role, index) =>
          (["function", "owner", "backup", "channel"] as Array<keyof Role>)
            .filter((field) => !role[field].trim())
            .map((field) => `Role ${index + 1} ${field === "owner" ? "primary" : field}`),
        )
      : [];

  return [...fieldErrors, ...roleErrors];
}

function validateAll(answers: Answers) {
  return Array.from({ length: steps.length }, (_, index) => validateStep(index, answers)).flat();
}

function generatePlan(a: Answers): Plan {
  const isAgentic = /agent|tool|write|action|autonom/i.test(a.autonomy + a.deployment);
  const isRegulated = /hipaa|health|sox|finance|gdpr|regulated|patient|legal/i.test(a.regulatedContext);
  const isPublic = /public|customer|patient|consumer/i.test(a.userBase + a.deployment);

  return {
    severity: isAgentic || isRegulated ? "SEV-1 emergency shutdown" : "SEV-2 controlled containment",
    triggers: [
      "Model output creates credible risk of physical, financial, legal, privacy, or safety harm.",
      "Observed behavior bypasses policy controls, discloses sensitive data, or repeatedly hallucinates consequential facts.",
      isAgentic
        ? "Agent tools perform or attempt unauthorized actions, chained actions, or actions outside approved intent."
        : "Human reviewers report unsafe recommendations at a rate above the team's tolerance threshold.",
      isPublic
        ? "Abuse wave, jailbreak campaign, or coordinated prompts scale across public user traffic."
        : "Internal users escalate anomalous behavior affecting business-critical workflows.",
    ],
    immediate: [
      `Declare ${isAgentic || isRegulated ? "SEV-1" : "SEV-2"} and open ${a.commsChannel}.`,
      "Freeze model, prompt, policy, and retrieval configuration changes until incident commander approval.",
      "Enable kill switch or feature flag to stop risky model paths while preserving a static fallback where possible.",
      "Capture prompts, outputs, tool calls, retrieval documents, deployment hashes, and user impact samples.",
      isRegulated ? "Notify legal/compliance before external statements or data-subject notifications." : "Prepare customer-support holding statements for affected users.",
    ],
    containment: [
      "Disable or rate-limit the highest-risk entry points first: public chat, API write paths, batch jobs, and tool broker routes.",
      "Revoke temporary model credentials, tool execution tokens, and overly broad service accounts.",
      "Switch routing to approved fallback model, rules engine, or human-review queue.",
      "Preserve logs in read-only storage and document every operator action with timestamp and approver.",
    ],
    rollback: [
      `Rollback target: ${a.rollbackTarget}.`,
      "Redeploy last known-good prompt, model route, retrieval index, and safety policy as a single controlled change.",
      "Run smoke tests for unsafe prompt classes, sensitive-data leakage, dependency health, and user-facing fallback copy.",
      "Require incident commander and ML systems lead approval before traffic restoration above 25 percent.",
    ],
    communications: [
      `Primary coordination channel: ${a.commsChannel}.`,
      "Internal update every 30 minutes: current status, user impact, controls applied, next decision point.",
      "Customer-facing message: acknowledge degraded AI assistance, confirm fallback support path, avoid speculative cause.",
      isRegulated ? "Regulatory assessment: document whether privacy, patient safety, financial reporting, or contractual notice duties apply." : "Stakeholder note: document business impact, mitigation status, and recovery estimate.",
    ],
    review: [
      `Evidence archive: ${a.evidenceLocation}.`,
      "Complete post-incident review within five business days with timeline, root cause, missed signals, and control improvements.",
      "Update trigger thresholds, runbook owners, rollback assets, and test schedule before closing the incident.",
      "Run a tabletop exercise using this exact shutdown plan after the corrective actions are merged.",
    ],
  };
}

function textLines(doc: jsPDF, title: string, lines: string[], y: number) {
  if (y > 266) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 16, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(`- ${line}`, 176);
    if (y + wrapped.length * 5 > 282) {
      doc.addPage();
      y = 18;
    }
    doc.text(wrapped, 18, y);
    y += wrapped.length * 5 + 2;
  });
  return y + 3;
}

function exportPdf(answers: Answers, plan: Plan) {
  const doc = new jsPDF();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI System Emergency Shutdown Plan", 16, 16);
  doc.setFontSize(10);
  doc.text(`${answers.organization} - ${answers.systemName}`, 16, 25);
  doc.setTextColor(20, 27, 39);

  let y = 44;
  y = textLines(doc, "System Summary", [
    `Deployment: ${answers.deployment}`,
    `Model access: ${answers.modelAccess}`,
    `User base: ${answers.userBase}`,
    `Data flows: ${answers.dataFlows}`,
    `Dependencies: ${answers.dependencies}`,
    `Regulatory context: ${answers.regulatedContext}`,
    `Recommended severity: ${plan.severity}`,
  ], y);
  y = textLines(doc, "Trigger Conditions", plan.triggers, y);
  y = textLines(doc, "Immediate Shutdown Checklist", plan.immediate, y);
  y = textLines(doc, "Containment Checklist", plan.containment, y);
  y = textLines(doc, "Rollback Steps", plan.rollback, y);
  y = textLines(doc, "Communication Template", plan.communications, y);
  y = textLines(doc, "Role Matrix", answers.roles.map((r) => `${r.function}: ${r.owner}; backup: ${r.backup}; channel: ${r.channel}`), y);
  textLines(doc, "Post-Incident Review", plan.review, y);
  doc.save(`${answers.systemName.replace(/\W+/g, "-").toLowerCase()}-shutdown-plan.pdf`);
}

export default function App() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [showValidation, setShowValidation] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>("Not saved yet");
  const hasLoadedDraft = useRef(false);
  const plan = useMemo(() => generatePlan(answers), [answers]);
  const progress = ((step + 1) / steps.length) * 100;
  const validationErrors = step === steps.length - 1 && showValidation ? validateAll(answers) : validateStep(step, answers);
  const visibleValidationErrors = showValidation ? validationErrors : [];
  const allValidationErrors = validateAll(answers);
  const requiredFieldCount = Object.values(requiredFieldsByStep).reduce((total, fields) => total + fields.length, 0) + answers.roles.length * 4;
  const completionScore = Math.max(0, Math.round(((requiredFieldCount - allValidationErrors.length) / requiredFieldCount) * 100));

  const notify = (message: string, tone: Toast["tone"] = "info") => {
    setToast({ message, tone });
  };

  useEffect(() => {
    if (!hasLoadedDraft.current) {
      hasLoadedDraft.current = true;
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) {
          notify("Draft restored from this browser.", "success");
        }
      } catch {
        // Storage can be unavailable in locked-down browser contexts.
      }
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
        setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch {
        notify("Autosave is unavailable in this browser.", "error");
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [answers]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const setField = (field: AnswerField, value: string) => setAnswers((current) => ({ ...current, [field]: value }));
  const setRole = (index: number, field: keyof Role, value: string) => {
    setAnswers((current) => ({
      ...current,
      roles: current.roles.map((role, i) => (i === index ? { ...role, [field]: value } : role)),
    }));
  };
  const addRole = () => {
    setAnswers((current) => ({ ...current, roles: [...current.roles, { ...emptyRole }] }));
    notify("Added a new response role.", "success");
  };
  const removeRole = (index: number) => {
    setAnswers((current) => ({
      ...current,
      roles: current.roles.length === 1 ? current.roles : current.roles.filter((_, i) => i !== index),
    }));
    notify(answers.roles.length === 1 ? "At least one role is required." : "Role removed.", answers.roles.length === 1 ? "error" : "info");
  };

  const applyScenario = (name: string) => {
    setAnswers((current) => ({ ...current, ...scenarioPresets[name] }));
    setShowValidation(false);
    notify(`${name} loaded.`, "success");
  };
  const selectStep = (index: number) => {
    setStep(index);
    setShowValidation(false);
  };
  const goBack = () => {
    setStep((current) => Math.max(0, current - 1));
    setShowValidation(false);
  };
  const continueOrExport = () => {
    const errors = step === steps.length - 1 ? validateAll(answers) : validationErrors;
    if (errors.length > 0) {
      setShowValidation(true);
      notify("Please complete the highlighted fields.", "error");
      return;
    }
    setShowValidation(false);
    if (step === steps.length - 1) {
      setModal("export");
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };
  const confirmExport = () => {
    exportPdf(answers, plan);
    setModal(null);
    notify("PDF export started.", "success");
  };
  const resetDraft = () => {
    setAnswers(defaults);
    setStep(0);
    setShowValidation(false);
    setModal(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures during reset.
    }
    notify("Draft reset to the healthcare example.", "success");
  };
  const copyPlan = async () => {
    const text = [
      `AI System Emergency Shutdown Plan: ${answers.organization} - ${answers.systemName}`,
      `Severity: ${plan.severity}`,
      "",
      "Immediate actions:",
      ...plan.immediate.map((item) => `- ${item}`),
      "",
      "Rollback:",
      ...plan.rollback.map((item) => `- ${item}`),
      "",
      "Contacts:",
      ...answers.roles.map((role) => `- ${role.function}: ${role.owner}; backup: ${role.backup}; channel: ${role.channel}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      notify("Plan summary copied to clipboard.", "success");
    } catch {
      notify("Clipboard access was blocked by the browser.", "error");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modal) {
        setModal(null);
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        continueOrExport();
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        continueOrExport();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal("help");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, step, answers, plan, validationErrors]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0,#f3f5ef_34%,#eef2f7_100%)] text-slate-950">
      <section className="border-b border-slate-200/80 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <Siren className="h-4 w-4" />
              Emergency readiness generator
            </div>
            <h1 className="max-w-4xl text-3xl font-bold text-slate-950 sm:text-5xl">AI System Emergency Shutdown Plan Generator</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Interview your team about architecture, roles, dependencies, rollback paths, and communication duties, then generate a printable emergency plan for dangerous AI behavior at scale.
            </p>
            <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
              <Metric icon={<Gauge className="h-4 w-4" />} label="Severity aware" />
              <Metric icon={<Users className="h-4 w-4" />} label="Owner mapped" />
              <Metric icon={<Download className="h-4 w-4" />} label="PDF ready" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Autosaved {lastSavedAt}
              </span>
              <span className="text-xs">Press Ctrl+K for shortcuts.</span>
            </div>
          </div>
          <div className="w-full min-w-0 rounded-lg border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] lg:w-[330px]">
            <div className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Activity className="h-3.5 w-3.5" />
              Example incidents
            </div>
            {Object.keys(scenarioPresets).map((scenario) => (
              <button type="button" key={scenario} onClick={() => applyScenario(scenario)} className="mb-2 flex w-full items-center justify-between gap-3 rounded-md border border-slate-200/90 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-200 last:mb-0 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50/40 hover:text-red-700 hover:shadow-[0_12px_24px_rgba(127,29,29,0.10)]">
                <span className="min-w-0 truncate" title={scenario}>{scenario}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[286px_minmax(0,1fr)] xl:grid-cols-[286px_minmax(0,1fr)_420px]">
        <aside className="h-fit rounded-lg border border-slate-200/90 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.07)] backdrop-blur lg:sticky lg:top-5">
          <div className="mb-3 rounded-md border border-slate-800 bg-slate-950 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Plan progress</span>
              <span>{step + 1} of {steps.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-red-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setModal("help")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              <HelpCircle className="h-4 w-4" />
              Help
            </button>
            <button type="button" onClick={() => setModal("reset")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100">
              <Trash2 className="h-4 w-4" />
              Reset
            </button>
          </div>
          {steps.map((item, index) => {
            const Icon = item.icon;
            const done = index < step;
            return (
              <button type="button" key={item.title} onClick={() => selectStep(index)} className={`group mb-1 flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left text-sm font-semibold transition-all duration-200 last:mb-0 ${step === index ? "border-slate-900 bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:shadow-sm"}`} aria-current={step === index ? "step" : undefined}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${step === index ? "border-white/10 bg-white/12" : done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span>{item.title}</span>
              </button>
            );
          })}
          <div className="mt-4 rounded-md border border-amber-200/90 bg-gradient-to-b from-amber-50 to-orange-50 p-3 text-xs leading-5 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            Template basis: NIST AI RMF, NIST SP 800-61 Rev. 3, NIST GenAI Profile, and common incident command practice. Validate with your safety, security, legal, and operations owners before production use.
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-slate-200/90 bg-white/95 p-5 shadow-[0_22px_55px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur">
          <div key={step} className="wizard-panel">
          {visibleValidationErrors.length > 0 && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" role="alert">
              <div className="font-bold">Complete these fields before continuing:</div>
              <div className="mt-1 [overflow-wrap:anywhere]">{visibleValidationErrors.join(", ")}</div>
            </div>
          )}
          {step === 0 && (
            <FormSection title="System Architecture Questionnaire" icon={<Layers3 className="h-5 w-5" />}>
              <Input label="Organization" value={answers.organization} required invalid={showValidation && !answers.organization.trim()} onChange={(v) => setField("organization", v)} />
              <Input label="AI system name" value={answers.systemName} required invalid={showValidation && !answers.systemName.trim()} onChange={(v) => setField("systemName", v)} />
              <TextArea label="Deployment type" helper="Examples: public SaaS chatbot, internal agent, embedded model API, batch scorer." value={answers.deployment} required invalid={showValidation && !answers.deployment.trim()} onChange={(v) => setField("deployment", v)} />
              <TextArea label="Data flows" helper="Include prompts, retrieval, logs, user data, tool calls, and downstream systems." value={answers.dataFlows} required invalid={showValidation && !answers.dataFlows.trim()} onChange={(v) => setField("dataFlows", v)} />
              <TextArea label="Critical dependencies" value={answers.dependencies} required invalid={showValidation && !answers.dependencies.trim()} onChange={(v) => setField("dependencies", v)} />
            </FormSection>
          )}

          {step === 1 && (
            <FormSection title="Model Access, Users, and Risk Context" icon={<ShieldAlert className="h-5 w-5" />}>
              <TextArea label="Model access and safety controls" value={answers.modelAccess} required invalid={showValidation && !answers.modelAccess.trim()} onChange={(v) => setField("modelAccess", v)} />
              <TextArea label="User base" value={answers.userBase} required invalid={showValidation && !answers.userBase.trim()} onChange={(v) => setField("userBase", v)} />
              <TextArea label="Autonomy and tool authority" helper="Be explicit about writes, external actions, approvals, and human gates." value={answers.autonomy} required invalid={showValidation && !answers.autonomy.trim()} onChange={(v) => setField("autonomy", v)} />
              <TextArea label="Regulatory or contractual context" value={answers.regulatedContext} required invalid={showValidation && !answers.regulatedContext.trim()} onChange={(v) => setField("regulatedContext", v)} />
              <Input label="Evidence archive location" value={answers.evidenceLocation} required invalid={showValidation && !answers.evidenceLocation.trim()} onChange={(v) => setField("evidenceLocation", v)} />
            </FormSection>
          )}

          {step === 2 && (
            <FormSection title="Role-Based Contact Matrix" icon={<Users className="h-5 w-5" />}>
              <div className="grid gap-3">
                {answers.roles.map((role, index) => (
                  <div key={index} className="grid min-w-0 gap-3 rounded-lg border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-slate-700">Response role {index + 1}</div>
                      <button type="button" onClick={() => removeRole(index)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
                      <Input label="Function" value={role.function} required invalid={showValidation && !role.function.trim()} onChange={(v) => setRole(index, "function", v)} />
                      <Input label="Primary" value={role.owner} required invalid={showValidation && !role.owner.trim()} onChange={(v) => setRole(index, "owner", v)} />
                      <Input label="Backup" value={role.backup} required invalid={showValidation && !role.backup.trim()} onChange={(v) => setRole(index, "backup", v)} />
                      <Input label="Channel" value={role.channel} required invalid={showValidation && !role.channel.trim()} onChange={(v) => setRole(index, "channel", v)} />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addRole} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm">
                <Plus className="h-4 w-4" />
                Add role
              </button>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Rollback target" value={answers.rollbackTarget} required invalid={showValidation && !answers.rollbackTarget.trim()} onChange={(v) => setField("rollbackTarget", v)} />
                <Input label="Incident channel" value={answers.commsChannel} required invalid={showValidation && !answers.commsChannel.trim()} onChange={(v) => setField("commsChannel", v)} />
              </div>
            </FormSection>
          )}

          {step === 3 && (
            <FormSection title="Generated Shutdown Plan" icon={<FileText className="h-5 w-5" />}>
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-950">Readiness score: {completionScore}%</div>
                  <div className="mt-1 text-sm text-slate-600">{allValidationErrors.length === 0 ? "All required planning fields are complete." : `${allValidationErrors.length} required items still need attention.`}</div>
                </div>
                <button type="button" onClick={copyPlan} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm">
                  <Copy className="h-4 w-4" />
                  Copy summary
                </button>
              </div>
              <PlanBlock title="Trigger Conditions" icon={<MessageSquareWarning className="h-5 w-5" />} lines={plan.triggers} />
              <PlanBlock title="Immediate Shutdown Checklist" icon={<ShieldAlert className="h-5 w-5" />} lines={plan.immediate} />
              <PlanBlock title="Rollback Steps" icon={<RotateCcw className="h-5 w-5" />} lines={plan.rollback} />
              <PlanBlock title="Communication Template" icon={<MessageSquareWarning className="h-5 w-5" />} lines={plan.communications} />
            </FormSection>
          )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" disabled={step === 0} onClick={goBack} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_10px_20px_rgba(15,23,42,0.09)] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button type="button" onClick={continueOrExport} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-800 bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(185,28,28,0.22),inset_0_1px_0_rgba(255,255,255,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-800 hover:shadow-[0_16px_30px_rgba(185,28,28,0.28)]">
              {step === steps.length - 1 ? <Download className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {step === steps.length - 1 ? "Export PDF" : "Next"}
            </button>
          </div>
        </section>

        <aside className="min-w-0 h-fit rounded-lg border border-slate-200/90 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur lg:col-span-2 xl:sticky xl:top-5 xl:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-lg font-bold">Live Plan Preview</h2>
            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">{plan.severity}</span>
          </div>
          <div className="mt-4 grid gap-3">
            <PreviewItem label="System" value={`${answers.organization} - ${answers.systemName}`} />
            <PreviewItem label="Kill switch first" value={plan.immediate[2]} />
            <PreviewItem label="Rollback" value={answers.rollbackTarget} />
            <PreviewItem label="Evidence" value={answers.evidenceLocation} />
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            {answers.roles.map((role, index) => (
              <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 border-b border-slate-200/90 bg-white p-3 text-sm transition-colors last:border-b-0 hover:bg-slate-50">
                <strong className="min-w-0 truncate" title={role.function}>{role.function}</strong>
                <span className="min-w-0 truncate text-slate-600" title={role.owner}>{role.owner}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {toast && <ToastMessage toast={toast} />}
      {modal === "export" && (
        <Modal title="Review Before Export" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-700">Readiness</span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{completionScore}% complete</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionScore}%` }} />
              </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-700">
              <PreviewItem label="System" value={`${answers.organization} - ${answers.systemName}`} />
              <PreviewItem label="Severity" value={plan.severity} />
              <PreviewItem label="Primary channel" value={answers.commsChannel} />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              Export creates a printable operating plan. Review ownership, legal obligations, and emergency contacts with your safety and operations leaders before using it in production.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setModal(null)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Keep editing
              </button>
              <button type="button" onClick={confirmExport} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-800 bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Reset Draft" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              This clears your saved browser draft and restores the default healthcare example. This action cannot be undone.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setModal(null)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={resetDraft} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-800 bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">
                <Trash2 className="h-4 w-4" />
                Reset draft
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Keyboard Shortcuts" onClose={() => setModal(null)}>
          <div className="grid gap-3 text-sm text-slate-700">
            <Shortcut keys="Ctrl / Cmd + Enter" label="Continue or open export review" />
            <Shortcut keys="Alt + Right" label="Continue to the next step" />
            <Shortcut keys="Alt + Left" label="Go back one step" />
            <Shortcut keys="Ctrl / Cmd + K" label="Open this help dialog" />
            <Shortcut keys="Escape" label="Close dialogs" />
          </div>
        </Modal>
      )}
    </main>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <span className="rounded-md border border-slate-200 bg-gradient-to-b from-white to-slate-100 p-2 text-slate-700 shadow-[0_4px_10px_rgba(15,23,42,0.06)]">{icon}</span>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function Input({ label, value, required, invalid, onChange }: { label: string; value: string; required?: boolean; invalid?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
      <span className="flex min-w-0 items-center gap-1 truncate" title={label}>
        <span className="min-w-0 truncate">{label}</span>
        {required && <span className="shrink-0 text-red-600" aria-hidden="true">*</span>}
      </span>
      <input aria-invalid={invalid || undefined} required={required} title={value} value={value} onChange={(e) => onChange(e.target.value)} className={`min-h-11 w-full min-w-0 truncate rounded-md border bg-gradient-to-b from-white to-slate-50/60 px-3 py-2 text-sm font-normal text-slate-950 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-400 hover:bg-white focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100 ${invalid ? "border-red-400 bg-red-50/30" : "border-slate-300/90"}`} />
    </label>
  );
}

function TextArea({ label, helper, value, required, invalid, onChange }: { label: string; helper?: string; value: string; required?: boolean; invalid?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
      <span className="flex min-w-0 items-center gap-1 truncate" title={label}>
        <span className="min-w-0 truncate">{label}</span>
        {required && <span className="shrink-0 text-red-600" aria-hidden="true">*</span>}
      </span>
      {helper && <span className="text-xs font-normal text-slate-500">{helper}</span>}
      <textarea aria-invalid={invalid || undefined} required={required} title={value} value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`w-full min-w-0 resize-y rounded-md border bg-gradient-to-b from-white to-slate-50/60 px-3 py-2 text-sm font-normal leading-6 text-slate-950 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-400 hover:bg-white focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100 ${invalid ? "border-red-400 bg-red-50/30" : "border-slate-300/90"}`} />
    </label>
  );
}

function PlanBlock({ title, icon, lines }: { title: string; icon: React.ReactNode; lines: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_34px_rgba(15,23,42,0.10)]">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-950">{icon}{title}</h3>
      <ul className="grid gap-2">
        {lines.map((line, index) => (
          <li key={line} className="flex gap-2 text-sm leading-6 text-slate-700">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-red-200 bg-red-50 text-xs font-bold text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">{index + 1}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_10px_20px_rgba(15,23,42,0.07)]">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-6 text-slate-800 [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

function Metric({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200/90 bg-gradient-to-b from-white to-slate-50 px-3 text-sm font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]">
      <span className="text-red-700">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <h2 id="dialog-title" className="min-w-0 truncate text-xl font-bold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50" aria-label="Close dialog" autoFocus>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ToastMessage({ toast }: { toast: Toast }) {
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertCircle : MessageSquareWarning;
  const toneClass =
    toast.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : toast.tone === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.18)] toast-enter ${toneClass}`} role="status" aria-live="polite">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="[overflow-wrap:anywhere]">{toast.message}</span>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <kbd className="w-fit rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-[inset_0_-1px_0_rgba(15,23,42,0.08)]">{keys}</kbd>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  FiCheck,
  FiChevronRight,
  FiClipboard,
  FiEye,
  FiFileText,
  FiKey,
  FiLock,
  FiPackage,
  FiServer,
  FiShield,
  FiX,
} from "react-icons/fi";

const SDK_VERSION = "0.3.2";
const GUIDE_FILE = "/reentry-sdk-install.md";

type GuideStep = {
  id: string;
  number: string;
  label: string;
  title: string;
  summary: string;
  checks: string[];
};

const GUIDE_STEPS: GuideStep[] = [
  {
    id: "install",
    number: "01",
    label: "Install",
    title: "Add one package.",
    summary: "Install the verified SDK version and keep the integration on Node.js 24 or newer.",
    checks: ["Install @4xeoz/re-entry-sdk@0.3.2.", "Use the /server and /client entrypoints in their intended runtimes."],
  },
  {
    id: "configure",
    number: "02",
    label: "Configure",
    title: "Keep secrets on the server.",
    summary: "Set the Host and Receiver origins, key ID, Ed25519 private key, and organization API key in server environment variables.",
    checks: ["Never prefix these values with NEXT_PUBLIC_.", "Use the authenticated Host user and current workflow as server inputs."],
  },
  {
    id: "consent",
    number: "03",
    label: "Consent",
    title: "Ask once, then confirm.",
    summary: "The Host server creates the signed consent request; the browser opens Re-entry; the Host server confirms the Receiver status.",
    checks: ["Store the request handle on the Host server.", "Return only the consent URL, session ID, and opaque continuation ID."],
  },
  {
    id: "verify",
    number: "04",
    label: "Verify",
    title: "Stop at approval.",
    summary: "This starter integration ends after approval. It does not send a later Event or activate an Agent.",
    checks: ["No trigger call is included yet.", "Add the later business-event handler only when that product flow is ready."],
  },
];

const FLOW_ITEMS: Array<{ label: string; detail: string; icon: typeof FiServer }> = [
  { label: "Host server", detail: "request()", icon: FiServer },
  { label: "Re-entry", detail: "approve", icon: FiShield },
  { label: "Host server", detail: "confirm()", icon: FiServer },
];

export default function SdkDocumentation() {
  const [activeId, setActiveId] = useState(GUIDE_STEPS[0].id);
  const [fileText, setFileText] = useState("");
  const [fileStatus, setFileStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const activeStep = GUIDE_STEPS.find((step) => step.id === activeId) ?? GUIDE_STEPS[0];

  useEffect(() => {
    if (!panelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [panelOpen]);

  async function loadGuideFile() {
    if (fileText) return fileText;
    setFileStatus("loading");
    try {
      const response = await fetch(GUIDE_FILE, { cache: "no-store" });
      if (!response.ok) throw new Error("guide_file_unavailable");
      const text = await response.text();
      setFileText(text);
      setFileStatus("ready");
      return text;
    } catch {
      setFileStatus("error");
      throw new Error("guide_file_unavailable");
    }
  }

  async function copyGuideFile() {
    try {
      const text = await loadGuideFile();
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  }

  function openGuideFile() {
    setPanelOpen(true);
    if (!fileText) void loadGuideFile().catch(() => undefined);
  }

  return (
    <section id="sdk-docs" className="relative mt-16 scroll-mt-8 pb-16 sm:mt-20" aria-labelledby="sdk-docs-title">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4a8e3d]">
            <FiPackage aria-hidden="true" />
            Host SDK / install guide
          </div>
          <h2 id="sdk-docs-title" className="mt-4 max-w-3xl text-[clamp(38px,5vw,66px)] font-semibold leading-[0.94] tracking-[-0.065em] text-[#163300]">
            Start with one clear path.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#587052]">
            Four small steps for the first consent integration. The full instructions live in one copyable file.
          </p>
        </div>

        <div className="grid min-w-[280px] grid-cols-3 overflow-hidden rounded-2xl border border-[#c9ddc4] bg-white/65 text-center shadow-[0_14px_40px_rgba(22,51,0,0.06)]">
          {[
            [SDK_VERSION, "verified SDK"],
            ["2", "runtime sides"],
            ["0", "browser secrets"],
          ].map(([value, label]) => (
            <div key={label} className="border-r border-[#d9e7d5] px-3 py-3 last:border-r-0">
              <strong className="block text-xl tracking-[-0.04em] text-[#163300]">{value}</strong>
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#71876c]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-between gap-4 rounded-[24px] border border-[#cddfc8] bg-white/75 p-4 shadow-[0_16px_48px_rgba(22,51,0,0.06)] sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dff3d7] text-[#286323]">
            <FiFileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#4a8e3d]">Copyable file</span>
            <strong className="mt-1 block truncate text-sm font-semibold text-[#163300]">reentry-sdk-install.md</strong>
            <span className="mt-1 block text-xs text-[#587052]">Give the full setup to a coding agent.</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void copyGuideFile()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#b7d0b0] bg-white px-3.5 text-xs font-bold text-[#286323] transition hover:border-[#4b9b42] hover:bg-[#f5fbf2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b9b42]"
            aria-label="Copy re-entry SDK install file"
          >
            {copyState === "copied" ? <FiCheck aria-hidden="true" /> : <FiClipboard aria-hidden="true" />}
            {copyState === "copied" ? "Copied" : copyState === "error" ? "Unavailable" : "Copy"}
          </button>
          <button
            type="button"
            onClick={openGuideFile}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#163300] px-3.5 text-xs font-bold text-[#b9f57b] transition hover:bg-[#286323] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b9b42]"
            aria-expanded={panelOpen}
            aria-controls="sdk-install-file-panel"
          >
            <FiEye aria-hidden="true" />
            View
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-[#cddfc8] bg-white/72 p-3 shadow-[0_18px_60px_rgba(22,51,0,0.07)]" role="tablist" aria-label="SDK setup steps">
          {GUIDE_STEPS.map((step) => {
            const active = step.id === activeId;
            return (
              <button
                key={step.id}
                id={`sdk-tab-${step.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="sdk-step-panel"
                onClick={() => setActiveId(step.id)}
                className={`group flex w-full items-center gap-3 rounded-[20px] px-3 py-3.5 text-left transition ${active ? "bg-[#163300] text-white shadow-[0_12px_30px_rgba(22,51,0,0.18)]" : "text-[#587052] hover:bg-[#e6f2e1]"}`}
              >
                <span className={`font-mono text-[10px] font-bold ${active ? "text-[#b9f57b]" : "text-[#6ea262]"}`}>{step.number}</span>
                <span className="text-sm font-semibold">{step.label}</span>
                <FiChevronRight className={`ml-auto transition-transform ${active ? "translate-x-0 text-[#b9f57b]" : "-translate-x-1 text-[#9bb196] group-hover:translate-x-0"}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div
          id="sdk-step-panel"
          role="tabpanel"
          aria-labelledby={`sdk-tab-${activeStep.id}`}
          className="overflow-hidden rounded-[30px] bg-[#08110b] text-[#efffe7] shadow-[0_26px_80px_rgba(8,17,11,0.2)]"
        >
          <div className="flex min-h-[360px] flex-col p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#b9f57b]">{activeStep.number} / 04</span>
              <FiServer className="h-5 w-5 text-[#8fe5d1]" aria-hidden="true" />
            </div>
            <h3 className="mt-8 max-w-xl text-[clamp(28px,3vw,42px)] font-semibold leading-[0.98] tracking-[-0.055em]">{activeStep.title}</h3>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58">{activeStep.summary}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {activeStep.checks.map((check) => (
                <div key={check} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3.5">
                  <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b9f57b]" aria-hidden="true" />
                  <p className="text-xs leading-5 text-white/67">{check}</p>
                </div>
              ))}
            </div>
            <p className="mt-auto pt-8 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
              Open the file above for the complete copyable setup.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="rounded-[28px] border border-[#cddfc8] bg-white/68 p-5 sm:p-7">
          <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.17em] text-[#4a8e3d]">
            <FiShield aria-hidden="true" />
            The first flow
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {FLOW_ITEMS.map(({ label, detail, icon: FlowIcon }) => {
              return (
                <div key={`${label}-${detail}`} className="relative rounded-2xl bg-[#e7f3e2] p-3.5">
                  <FlowIcon className="h-4 w-4 text-[#36752f]" aria-hidden="true" />
                  <strong className="mt-4 block text-sm text-[#163300]">{label}</strong>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#759170]">{detail}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#dff3d7] p-5 text-[#163300] sm:p-7">
          <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.17em] text-[#4a8e3d]">
            <FiLock aria-hidden="true" />
            Credential boundary
          </div>
          <div className="mt-6 space-y-3">
            {[
              [FiKey, "Organization key", "Host server only"],
              [FiKey, "Signing key", "Host server only"],
              [FiShield, "Consent decision", "User in Re-entry"],
            ].map(([Icon, name, location]) => {
              const CredentialIcon = Icon as typeof FiKey;
              return (
                <div key={name as string} className="flex items-center gap-3 border-b border-[#bad4b3] pb-3 last:border-b-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-[#36752f]">
                    <CredentialIcon aria-hidden="true" />
                  </span>
                  <div>
                    <strong className="block text-sm">{name as string}</strong>
                    <span className="text-xs text-[#587052]">{location as string}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-[#07100c]/60 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
            aria-label="Close SDK install file"
          />
          <aside
            id="sdk-install-file-panel"
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-[#cddfc8] bg-[#f8fbf5] text-[#163300] shadow-[-24px_0_80px_rgba(7,16,11,0.22)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sdk-install-file-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#d8e8d3] px-5 py-5 sm:px-7">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dff3d7] text-[#286323]">
                  <FiFileText aria-hidden="true" />
                </span>
                <div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#4a8e3d]">Copyable instructions</span>
                  <h3 id="sdk-install-file-title" className="mt-1 text-lg font-semibold tracking-[-0.035em]">reentry-sdk-install.md</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b7d0b0] text-[#587052] transition hover:bg-white hover:text-[#163300] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b9b42]"
                aria-label="Close SDK install file"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-[#587052]">Select all or copy the full text into a coding agent.</p>
                <button
                  type="button"
                  onClick={() => void copyGuideFile()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#163300] px-3 py-2 text-xs font-bold text-[#b9f57b] transition hover:bg-[#286323] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b9b42]"
                >
                  {copyState === "copied" ? <FiCheck aria-hidden="true" /> : <FiClipboard aria-hidden="true" />}
                  {copyState === "copied" ? "Copied" : copyState === "error" ? "Unavailable" : "Copy file"}
                </button>
              </div>
              {fileStatus === "loading" ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-[#d8e8d3] bg-white text-sm text-[#587052]">Loading file…</div>
              ) : fileStatus === "error" ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-[#e2b7b7] bg-[#fff0f0] p-6 text-center text-sm text-[#8f252c]">The install file could not be loaded. Try again from the file card.</div>
              ) : (
                <textarea
                  readOnly
                  value={fileText}
                  aria-label="Re-entry SDK install instructions"
                  className="min-h-0 flex-1 resize-none rounded-2xl border border-[#cddfc8] bg-white p-4 font-mono text-xs leading-6 text-[#263b24] outline-none focus:border-[#4b9b42] focus:ring-2 focus:ring-[#b9f57b]/40"
                />
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

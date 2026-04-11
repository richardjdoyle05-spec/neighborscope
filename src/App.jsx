/**
 * Veritaq — AI Compliance Platform for Community Banks & Credit Unions
 * Copyright (c) 2026 Veritaq. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This source code is the exclusive property of Veritaq and its owner.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without prior written permission.
 *
 * This software contains proprietary compliance frameworks, regulatory
 * knowledge bases, assessment methodologies, and scoring algorithms developed
 * specifically for NCUA, FFIEC, NY DFS 500, GLBA, SOC 2, and PCI DSS compliance.
 * v20 — PCI DSS v4.0 module added (knowledge base, questions, grounding sources)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:        "#f8f9fb",
  surface:   "#ffffff",
  surface2:  "#f1f5f9",
  border:    "#e2e8f0",
  border2:   "#cbd5e1",
  text:      "#0f172a",
  textMid:   "#475569",
  textDim:   "#94a3b8",
  textFaint: "#cbd5e1",
  accent:    "#2563eb",
  accentDim: "#dbeafe",
  green:     "#10b981",
  yellow:    "#f59e0b",
  red:       "#ef4444",
  purple:    "#8b5cf6",
};

// Strips AI search narration preamble from grounded outputs
function stripNarration(text) {
  return text
    .split("\n")
    .filter(line => {
      const l = line.trim().toLowerCase();
      return !(
        l.startsWith("now let me") ||
        l.startsWith("now i have") ||
        l.startsWith("now i'll") ||
        l.startsWith("let me search") ||
        l.startsWith("let me fetch") ||
        l.startsWith("let me look") ||
        l.startsWith("let me write") ||
        l.startsWith("let me now") ||
        l.startsWith("let me generate") ||
        l.startsWith("let me create") ||
        l.startsWith("let me compile") ||
        l.startsWith("i need to fetch") ||
        l.startsWith("i'll fetch") ||
        l.startsWith("i'll search") ||
        l.startsWith("i'll look") ||
        l.startsWith("i'll now") ||
        l.startsWith("i'll write") ||
        l.startsWith("i'll use") ||
        l.startsWith("searching for") ||
        l.startsWith("based on my search") ||
        l.startsWith("based on my research") ||
        l.startsWith("based on the regulatory") ||
        l.startsWith("based on the research") ||
        l.startsWith("based on the fetched") ||
        l.startsWith("based on the current") ||
        l.startsWith("based on the search") ||
        l.startsWith("based on the results") ||
        l.startsWith("based on the information") ||
        l.startsWith("i'll now prepare") ||
        l.startsWith("now i'll compile") ||
        l.startsWith("now i will compile") ||
        l.startsWith("i can now provide") ||
        l.startsWith("i will now") ||
        l.startsWith("first, let me") ||
        l.startsWith("i have sufficient") ||
        l.startsWith("i have enough") ||
        l.startsWith("i have gathered") ||
        l.startsWith("i have the information") ||
        l.startsWith("i have fetched") ||
        l.startsWith("i have reviewed") ||
        l.startsWith("i have found") ||
        l.startsWith("i now have") ||
        l.startsWith("i now have sufficient") ||
        (l.includes("search result") && l.includes("sufficient") && l.length < 200) ||
        (l.includes("sufficient information") && l.includes("create") && l.length < 200) ||
        (l.includes("sufficient information") && l.includes("generate") && l.length < 200) ||
        (l.includes("sufficient information") && l.includes("comprehensive") && l.length < 200) ||
        l.startsWith("using the") && l.includes("fetched") ||
        (l.includes("search") && l.includes("regulat") && l.length < 120) ||
        (l.includes("fetch") && l.includes("pci") && l.length < 120) ||
        (l.includes("fetch") && l.includes("requir") && l.length < 120) ||
        (l.includes("sufficient information") && l.length < 150) ||
        (l.includes("search result") && l.length < 120) ||
        // Strip verbatim regulatory text injections (long quoted passages)
        (l.startsWith("\"") && l.endsWith("\"") && l.length > 100) ||
        (l.includes("pci dss") && l.includes("guidance says") && l.length > 80) ||
        (l.includes("requirement") && l.includes("states that") && l.includes("pci") && l.length > 80) ||
        (l.includes("pci dss") && l.includes("is vital for") && l.length > 60)
      );
    })
    .join("\n")
    .replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
}

// Module-level markdown → HTML converter used by all PDF exports
function markdownToHtml(md) {
  if (!md) return "";
  let html = stripNarration(md);

  // Replace traffic light emoji with stable CSS colored dots
  html = html.replace(/🔴/g, '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:4px;vertical-align:middle;"></span>');
  html = html.replace(/🟡/g, '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;margin-right:4px;vertical-align:middle;"></span>');
  html = html.replace(/🟢/g, '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;margin-right:4px;vertical-align:middle;"></span>');
  html = html.replace(/⚠️/g, '<span style="color:#d97706;font-weight:700;">⚠</span>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#4f7cff;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #4f7cff30;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;color:#0d0f1a;margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #e5e7eb;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:18px;font-weight:800;color:#0d0f1a;margin:22px 0 8px;">$1</h2>');
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">');

  // Inline formatting
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:#1a1a2e;">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n\n+/g, "\n\n");

  // Line-by-line stateful renderer — handles lists, paragraphs, block elements
  const lines = html.split("\n");
  const result = [];
  let inPara = false;
  let inOL = false;
  let inUL = false;

  function closeAll() {
    if (inPara) { result.push("</p>"); inPara = false; }
    if (inOL)   { result.push("</ol>"); inOL = false; }
    if (inUL)   { result.push("</ul>"); inUL = false; }
  }

  for (const line of lines) {
    const t = line.trim();
    const isBlock = /^<(h[1-6]|hr|table|div|blockquote)/.test(t);
    const isOLItem = /^\d+\. /.test(t);
    const isULItem = /^[\*\-] /.test(t);
    const isEmpty = t === "";

    if (isOLItem) {
      if (inPara) { result.push("</p>"); inPara = false; }
      if (inUL)   { result.push("</ul>"); inUL = false; }
      if (!inOL)  { result.push('<ol style="padding-left:20px;margin:8px 0 12px;">'); inOL = true; }
      result.push(`<li style="margin:5px 0;">${t.replace(/^\d+\. /, "")}</li>`);
    } else if (isULItem) {
      if (inPara) { result.push("</p>"); inPara = false; }
      // If we're inside an OL, fold bullet as continuation of last li rather than breaking the numbered list
      if (inOL) {
        const last = result[result.length - 1];
        if (last && last.startsWith("<li")) {
          result[result.length - 1] = last.replace(/<\/li>$/, ` — ${t.replace(/^[\*\-] /, "")}</li>`);
        }
      } else {
        if (!inUL) { result.push('<ul style="padding-left:20px;margin:8px 0 12px;">'); inUL = true; }
        result.push(`<li style="margin:5px 0;">${t.replace(/^[\*\-] /, "")}</li>`);
      }
    } else if (isBlock) {
      closeAll();
      result.push(line);
    } else if (isEmpty) {
      // Empty line only closes lists if followed by non-list content — peek ahead not needed,
      // just close para; lists stay open across single blank lines
      if (inPara) { result.push("</p>"); inPara = false; }
    } else {
      // Plain text line — if inside a list, fold into last <li> to avoid breaking list numbering
      if ((inOL || inUL) && t) {
        const last = result[result.length - 1];
        if (last && last.startsWith("<li")) {
          result[result.length - 1] = last.replace(/<\/li>$/, ` ${t}</li>`);
        } else {
          result.push(`<li style="margin:5px 0;">${t}</li>`);
        }
      } else {
        if (inOL) { result.push("</ol>"); inOL = false; }
        if (inUL) { result.push("</ul>"); inUL = false; }
        if (!inPara) { result.push('<p style="margin:0 0 10px;">'); inPara = true; }
        result.push(t);
      }
    }
  }
  closeAll();
  return result.join("\n");
}

// Renders markdown as styled HTML — no raw ## or ** in outputs
function MarkdownReport({ text }) {
  const narrationClean = stripNarration(text || "");
  // Pre-process: join mid-paragraph single newlines into spaces, preserve block elements
  const lines = narrationClean.split("\n");
  const joined = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isBlock = trimmed === "" || trimmed.startsWith("-") || trimmed.startsWith("#") ||
      trimmed === "---" || /^\d+\./.test(trimmed);
    const prevIsBlock = joined.length === 0 || (() => {
      const p = joined[joined.length-1].trim();
      return p === "" || p.startsWith("-") || p.startsWith("#") || p === "---" || /^\d+\./.test(p);
    })();
    if (!isBlock && !prevIsBlock && joined.length > 0) {
      joined[joined.length-1] += " " + trimmed;
    } else {
      joined.push(line);
    }
  }
  const clean = joined.join("\n");
  const html = clean
    .replace(/^### (.+)$/gm, '<h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;margin:20px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:700;color:#F9FAFB;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #374151">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:800;color:#F9FAFB;margin:0 0 14px">$1</h1>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #374151;margin:16px 0"/>')
    .replace(/❌\s*(CRITICAL)?/gi, '<span style="color:#DC2626;font-weight:700">❌</span>')
    .replace(/⚠️|\u26a0\ufe0f/g, '<span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #D97706;margin:0 4px 1px 0;vertical-align:middle"></span>')
    .replace(/✅/g, '<span style="color:#059669">✅</span>')
    .replace(/\*\*(🔴[^*]+)\*\*/g, '<span style="font-weight:700;color:#DC2626">$1</span>')
    .replace(/\*\*(🟡[^*]+)\*\*/g, '<span style="font-weight:700;color:#D97706">$1</span>')
    .replace(/\*\*(🟢[^*]+)\*\*/g, '<span style="font-weight:700;color:#059669">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin:5px 0">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:6px 0"><strong>$1.</strong> $2</li>')
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/gs, m => `<ul style="margin:6px 0 12px;padding-left:20px;list-style:disc">${m}</ul>`)
    .replace(/\n\n/g, '</p><p style="margin:0 0 10px">')
    .replace(/\n/g, '<br/>');
  return (
    <div
      style={{ fontSize:13, color:T.textMid, lineHeight:1.85 }}
      dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 10px">${html}</p>` }}
    />
  );
}


const FW_COLOR = {
  "NY DFS 500": "#3b82f6",
  "FFIEC":      "#10b981",
  "GLBA":       "#f59e0b",
  "SOC 2":      "#8b5cf6",
  "NCUA":       "#ec4899",
  "PCI DSS":    "#e85d04",
};

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────
// Versioned regulatory requirements. Update when regulations change materially.
// Used by Policy Review (static direct call). Knowledge Q&A uses this as a
// structural index — live text is fetched from authoritative sources at query time.
const KNOWLEDGE = [
  // ── NY DFS 500 ──────────────────────────────────────────────────────────────
  { id:"dfs-500-2",   fw:"NY DFS 500", section:"§500.2",  title:"Cybersecurity Program",           text:"Each covered entity shall maintain a cybersecurity program designed to protect the confidentiality, integrity, and availability of its information systems. The program must be based on a risk assessment and include controls to protect against unauthorized access, use, or tampering with nonpublic information." },
  { id:"dfs-500-3",   fw:"NY DFS 500", section:"§500.3",  title:"Cybersecurity Policy",            text:"Each covered entity shall implement and maintain a written cybersecurity policy setting forth policies and procedures for the protection of its information systems and nonpublic information. The policy must be approved by a senior officer or the board of directors." },
  { id:"dfs-500-4",   fw:"NY DFS 500", section:"§500.4",  title:"CISO Requirement",                text:"Each covered entity shall designate a qualified individual as CISO responsible for overseeing and implementing the cybersecurity program and enforcing the cybersecurity policy. The CISO must report in writing at least annually to the board of directors on the cybersecurity program and material risks." },
  { id:"dfs-500-5",   fw:"NY DFS 500", section:"§500.5",  title:"Penetration Testing & Vulnerability Assessments", text:"Covered entities must conduct annual penetration testing of information systems and bi-annual vulnerability assessments. Automated vulnerability scanning is required at a risk-based cadence. All results must be documented and remediation tracked to closure." },
  { id:"dfs-500-6",   fw:"NY DFS 500", section:"§500.6",  title:"Audit Trail",                     text:"Covered entities must maintain audit trails that log and track access to systems sufficient to detect and respond to cybersecurity events. Audit records must be retained for at least five years for critical systems and three years for other systems." },
  { id:"dfs-500-7",   fw:"NY DFS 500", section:"§500.7",  title:"Access Privileges & Management",  text:"Covered entities must limit user access privileges to only those necessary to perform the user job functions (least privilege). Annual reviews of access rights are required. Privileged accounts must have additional controls including enhanced PAM controls." },
  { id:"dfs-500-8",   fw:"NY DFS 500", section:"§500.8",  title:"Application Security",            text:"Covered entities shall implement written procedures, guidelines, and standards designed to ensure the use of secure development practices for in-house applications and procedures for evaluating security of externally developed applications." },
  { id:"dfs-500-9",   fw:"NY DFS 500", section:"§500.9",  title:"Risk Assessment",                 text:"Covered entities shall conduct periodic risk assessments of information systems sufficient to inform the design of the cybersecurity program. The risk assessment shall include criteria for evaluating and categorizing cybersecurity risks and threats." },
  { id:"dfs-500-10",  fw:"NY DFS 500", section:"§500.10", title:"Cybersecurity Personnel & Intelligence", text:"Covered entities shall employ cybersecurity personnel, or engage qualified service providers, sufficient to manage cybersecurity risks. Personnel must receive training and updates on current cybersecurity risks and developments." },
  { id:"dfs-500-11",  fw:"NY DFS 500", section:"§500.11", title:"Third-Party Service Provider Security Policy", text:"Covered entities shall implement written policies and procedures to ensure the security of information systems accessible to third-party service providers. Policies must include due diligence, contractual protections (access controls, encryption, breach notification, audit rights), and ongoing monitoring." },
  { id:"dfs-500-12",  fw:"NY DFS 500", section:"§500.12", title:"Multi-Factor Authentication",      text:"Covered entities must implement MFA for ALL individuals accessing ANY information system. Small business exception: MFA required for remote access, third-party applications, and all privileged accounts. CISO may approve compensating controls in writing with annual review." },
  { id:"dfs-500-13",  fw:"NY DFS 500", section:"§500.13", title:"Data Retention & Minimization",   text:"Covered entities must include policies for the secure disposal of nonpublic information no longer necessary for business operations. Covered entities must develop policies and procedures for a complete and accurate asset inventory." },
  { id:"dfs-500-14",  fw:"NY DFS 500", section:"§500.14", title:"Training & Monitoring",            text:"Covered entities must provide annual cybersecurity awareness training for all personnel including social engineering coverage. Organizations must also monitor the activity of authorized users to detect unauthorized access to nonpublic information." },
  { id:"dfs-500-15",  fw:"NY DFS 500", section:"§500.15", title:"Encryption of Nonpublic Information", text:"Covered entities must encrypt all nonpublic information in transit over external networks and at rest. Where encryption is not feasible, the CISO may approve effective alternative compensating controls, reviewed annually." },
  { id:"dfs-500-16",  fw:"NY DFS 500", section:"§500.16", title:"Incident Response Plan",           text:"Each covered entity shall establish a written incident response plan to respond to and recover from cybersecurity events. The plan must include: internal processes, clear roles and responsibilities, goals and objectives, communication and escalation procedures, and requirements for remediation of identified weaknesses." },
  { id:"dfs-500-17",  fw:"NY DFS 500", section:"§500.17", title:"Notices to DFS",                  text:"Covered entities must notify DFS within 72 hours of determining that a cybersecurity event has occurred that has a reasonable likelihood of materially harming normal operations. Annual certification of compliance is due April 15 each year." },

  // ── NCUA ────────────────────────────────────────────────────────────────────
  { id:"ncua-748-a",  fw:"NCUA", section:"12 CFR 748 App A", title:"Information Security Program", text:"Every federally insured credit union must develop a written information security program designed to: (1) ensure security and confidentiality of member information; (2) protect against anticipated threats to the security or integrity of such information; and (3) protect against unauthorized access that could result in substantial harm to any member. Program must be approved by the board annually." },
  { id:"ncua-748-b",  fw:"NCUA", section:"12 CFR 748(b)",    title:"Catastrophic Act Notification", text:"Each federally insured credit union must notify the NCUA regional director within 5 business days of any catastrophic act resulting in physical destruction or interruption of vital member services projected to last more than two consecutive business days. A written record of the incident must be prepared and filed at the main office." },
  { id:"ncua-748-c",  fw:"NCUA", section:"12 CFR 748(c)",    title:"Cyber Incident Reporting (72-Hour Rule)", text:"Federally insured credit unions must notify the appropriate NCUA-designated contact of a reportable cyber incident within 72 hours of reasonably believing a reportable incident has occurred. A reportable cyber incident includes substantial loss of confidentiality, integrity, or availability of systems or member information." },
  { id:"ncua-748-app-b", fw:"NCUA", section:"12 CFR 748 App B", title:"Member Notification Procedures", text:"Credit unions must develop and implement a response program to address unauthorized access to member information including member notification procedures. Members must be notified when misuse of their information has occurred or is reasonably possible. Notification must be clear and conspicuous." },
  { id:"ncua-749",    fw:"NCUA", section:"12 CFR 749",       title:"Records Preservation Program",  text:"Each federally insured credit union must maintain a vital records preservation program. Required records include: board minutes (permanent), membership applications (10 years), financial statements (7 years), loan records (7 years after loan is closed), general ledgers (permanent). Off-site storage of duplicates is required for critical operational records." },
  { id:"ncua-acet",   fw:"NCUA", section:"ACET",             title:"Automated Cybersecurity Evaluation Tool", text:"The NCUA uses the ACET to assess credit union cybersecurity maturity across five domains: Cyber Risk Management and Oversight, Threat Intelligence and Collaboration, Cybersecurity Controls, External Dependency Management, and Cyber Incident Management and Resilience. Maturity levels range from Baseline to Innovative." },
  { id:"ncua-748-cert", fw:"NCUA", section:"12 CFR 748(a)", title:"Annual Board Certification",     text:"The president or managing official of each federally insured credit union must certify compliance with the security program requirements (12 CFR 748) annually through NCUA online information management system (MERIT/Credit Union Profile)." },

  // ── FFIEC ───────────────────────────────────────────────────────────────────
  { id:"ffiec-is",    fw:"FFIEC", section:"InfoSec Booklet",  title:"Information Security Management", text:"Financial institutions must implement a comprehensive information security program. The FFIEC Information Security Booklet requires: written IS policy approved by the board, risk-based controls, access controls with least privilege, encryption, patch management, security awareness training, audit logging, and vendor oversight. The board must receive regular reporting on the IS program." },
  { id:"ffiec-bcm",   fw:"FFIEC", section:"BCM Booklet",      title:"Business Continuity Management", text:"The FFIEC BCM Booklet requires: Business Impact Analysis identifying critical business functions and maximum tolerable downtime; defined RTO and RPO for all critical systems; written Business Continuity Plan; annual testing of the BCP; and board-level reporting on BCP status and test results." },
  { id:"ffiec-out",   fw:"FFIEC", section:"Outsourcing Booklet", title:"Third-Party/TSP Oversight",  text:"The FFIEC Outsourcing Technology Services Booklet requires: pre-contract due diligence on all technology service providers; contracts that include security requirements, audit rights, and business continuity provisions; ongoing monitoring of TSP performance; concentration risk assessment; and board reporting on third-party risk." },
  { id:"ffiec-audit", fw:"FFIEC", section:"Audit Booklet",    title:"IT Audit Program",              text:"Financial institutions must maintain an effective IT audit function. Audit must assess the effectiveness of the information security program, access controls, change management, and vendor oversight. IT audit findings must be reported to the board or audit committee. The audit program must be independent and risk-based." },
  { id:"ffiec-cat",   fw:"FFIEC", section:"CAT/NIST CSF",     title:"Cybersecurity Assessment Tool", text:"The FFIEC Cybersecurity Assessment Tool maps an institution cybersecurity maturity across five domains: Cyber Risk Management, Threat Intelligence, Cybersecurity Controls, External Dependency Management, and Cyber Incident Management. The FFIEC CAT is being sunset in favor of NIST CSF 2.0. Examiners may reference either framework." },
  { id:"ffiec-patch", fw:"FFIEC", section:"InfoSec Booklet",  title:"Patch & Vulnerability Management", text:"Financial institutions must implement a formal patch management program including: maintaining an asset inventory; identifying vulnerabilities through scanning; prioritizing patches based on criticality; testing patches before deployment; tracking remediation to closure; and documenting exceptions with compensating controls." },
  { id:"ffiec-access",fw:"FFIEC", section:"InfoSec Booklet",  title:"Access Controls & Identity Management", text:"FFIEC requires: least privilege access assignments; separation of duties for critical functions; periodic access reviews (at least annually for all users, quarterly for privileged accounts); controls for remote access; procedures for timely revocation of access upon termination; and logging and monitoring of access activity." },
  { id:"ffiec-isa",   fw:"FFIEC", section:"InfoSec Booklet",  title:"Information Security Awareness & Training", text:"Financial institutions must provide security awareness training to all employees on at least an annual basis. Training must cover the institution security policies, procedures, and employee responsibilities. Additional role-based training is required for IT staff and personnel with access to sensitive systems." },

  // ── GLBA ────────────────────────────────────────────────────────────────────
  { id:"glba-501",    fw:"GLBA", section:"§501(b)",   title:"Obligation to Protect Customer Information", text:"Section 501(b) of GLBA requires federal banking regulators including NCUA to establish appropriate standards for financial institutions that include administrative, technical, and physical safeguards to protect the security, confidentiality, and integrity of customer financial information." },
  { id:"glba-314-2",  fw:"GLBA", section:"§314.2",    title:"Nonpublic Personal Information Definition", text:"Under GLBA, nonpublic personal information means any personally identifiable financial information that a financial institution collects about an individual in connection with providing a financial product or service. This includes names, addresses, Social Security numbers, account numbers, and credit histories." },
  { id:"glba-314-4",  fw:"GLBA", section:"§314.4",    title:"Safeguards Rule — Required Program Elements", text:"The GLBA Safeguards Rule requires financial institutions to: designate a qualified individual to oversee the IS program; conduct a written risk assessment; implement safeguards to control identified risks; regularly monitor and test the program; oversee service providers; implement an IRP; and keep the board informed annually." },
  { id:"glba-314-4b", fw:"GLBA", section:"§314.4(b)", title:"Risk Assessment Requirements",     text:"Institutions must conduct a written risk assessment that identifies foreseeable internal and external risks to the security, confidentiality, and integrity of customer information and evaluates the sufficiency of existing safeguards for controlling those risks. The risk assessment must be updated regularly." },
  { id:"glba-314-4f", fw:"GLBA", section:"§314.4(f)", title:"Service Provider Oversight",       text:"Institutions must select and retain service providers that maintain appropriate safeguards and require service providers by contract to implement and maintain such safeguards. Institutions must oversee service providers practices through due diligence and ongoing monitoring." },
  { id:"glba-314-4h", fw:"GLBA", section:"§314.4(h)", title:"Incident Response Plan",           text:"Financial institutions must establish a written incident response plan covering: goals of the plan; internal processes for responding to a security event; clear roles and responsibilities; external and internal communications; documentation of the security event and response; post-event review; and notification requirements to appropriate regulators." },
  { id:"glba-diff-ncua", fw:"GLBA", section:"vs NCUA", title:"How GLBA and NCUA Differ",        text:"GLBA is the federal law establishing the legal obligation to protect customer financial information. NCUA implements GLBA for credit unions through 12 CFR 748 which contains the specific enforceable rules credit unions must follow. GLBA is the statute; NCUA 12 CFR 748 is the credit union-specific regulatory implementation." },

  // ── SOC 2 ───────────────────────────────────────────────────────────────────
  { id:"soc2-cc6",    fw:"SOC 2", section:"CC6",     title:"Logical & Physical Access Controls", text:"CC6 requires the entity to implement logical access security measures to protect against unauthorized access. This includes: restricting logical access to authorized users; protecting information assets from external threats; implementing access controls over data; managing credentials and authenticators; and restricting physical access to systems." },
  { id:"soc2-cc7",    fw:"SOC 2", section:"CC7",     title:"System Operations",                  text:"CC7 requires the entity to detect and monitor for anomalies and security events, evaluate security events to determine if they are security incidents, respond to security incidents to limit exposure, and recover from security incidents. This maps directly to SIEM, alerting, and incident response capabilities." },
  { id:"soc2-cc9",    fw:"SOC 2", section:"CC9",     title:"Risk Mitigation & Vendor Management", text:"CC9 requires the entity to identify, select, and develop risk mitigation activities including insurance, business continuity, and vendor/partner agreements. Third-party service providers must be assessed for risks and managed through contractual requirements and ongoing monitoring." },
  { id:"soc2-a1",     fw:"SOC 2", section:"A1",      title:"Availability",                       text:"The entity maintains, monitors, and evaluates current processing capacity and availability. This includes: infrastructure redundancy; backup and recovery procedures; environmental controls; and monitoring of system availability with defined recovery targets." },
  { id:"soc2-diff",   fw:"SOC 2", section:"vs FFIEC/NCUA", title:"How SOC 2 Differs from FFIEC/NCUA", text:"SOC 2 is an attestation standard for service organizations demonstrating controls over Trust Service Criteria to customers and auditors. FFIEC/NCUA are mandatory regulatory examination frameworks for financial institutions. A SOC 2 Type II report can be evidence of vendor controls during third-party due diligence but does not satisfy all FFIEC/NCUA requirements." },

  // ── PCI DSS v4.0 ────────────────────────────────────────────────────────────
  { id:"pci-req1",   fw:"PCI DSS", section:"Req 1", title:"Network Security Controls",               text:"PCI DSS Requirement 1 requires entities to install and maintain network security controls. This includes firewall configuration standards, restricting inbound and outbound traffic to only what is necessary, network segmentation to isolate the cardholder data environment (CDE) from other networks, and documentation of all firewall rules with formal review at least every six months." },
  { id:"pci-req2",   fw:"PCI DSS", section:"Req 2", title:"Secure Configurations",                   text:"PCI DSS Requirement 2 requires applying secure configurations to all system components. Organizations must change all vendor-supplied defaults including passwords, disable unnecessary services and ports, and maintain documented configuration standards for all in-scope systems. A system inventory of all hardware and software in the CDE is required." },
  { id:"pci-req3",   fw:"PCI DSS", section:"Req 3", title:"Protect Stored Account Data",             text:"PCI DSS Requirement 3 prohibits storage of sensitive authentication data (CVV, full magnetic stripe, PIN) after authorization under any circumstances. Primary account numbers (PANs) must be rendered unreadable wherever stored using strong cryptography. A data retention and disposal policy must limit cardholder data storage to the minimum necessary." },
  { id:"pci-req4",   fw:"PCI DSS", section:"Req 4", title:"Protect Cardholder Data in Transit",      text:"PCI DSS Requirement 4 requires strong cryptography (TLS 1.2 minimum) for all transmission of cardholder data over open, public networks. Organizations must maintain an inventory of all trusted keys and certificates. Sending PANs via end-user messaging technologies (email, IM, SMS) is prohibited unless encrypted." },
  { id:"pci-req5",   fw:"PCI DSS", section:"Req 5", title:"Protect Against Malicious Software",      text:"PCI DSS Requirement 5 requires anti-malware solutions on all system components susceptible to malware. Anti-malware must be kept current, perform periodic scans, generate audit logs, and cannot be disabled by users. Phishing-resistant controls and email security protections are required under v4.0." },
  { id:"pci-req6",   fw:"PCI DSS", section:"Req 6", title:"Secure Systems and Software",             text:"PCI DSS Requirement 6 requires a formal vulnerability management and patch management process. Critical patches must be installed within one month of release. All payment page scripts must be inventoried and monitored for unauthorized changes (Requirements 6.4.3 and 11.6.1 for e-commerce). Secure development practices are required for in-house developed software." },
  { id:"pci-req7",   fw:"PCI DSS", section:"Req 7", title:"Restrict Access by Business Need",        text:"PCI DSS Requirement 7 requires restricting access to system components and cardholder data to only those individuals whose job requires such access. Access control systems must default to deny-all and grant access only to specifically authorized users. All access rights must be documented and approved." },
  { id:"pci-req8",   fw:"PCI DSS", section:"Req 8", title:"Identify Users and Authenticate Access",  text:"PCI DSS Requirement 8 requires unique IDs for every user with access to system components. Passwords must be at least 12 characters. Multi-factor authentication (MFA) is required for ALL access to the CDE — including internal network access under v4.0 — and for all remote access. Shared and generic accounts are prohibited." },
  { id:"pci-req9",   fw:"PCI DSS", section:"Req 9", title:"Restrict Physical Access",                text:"PCI DSS Requirement 9 requires restricting physical access to systems that store, process, or transmit cardholder data. Controls include badge access logs, visitor management, media protection, and secure destruction of physical media containing cardholder data. Point-of-interaction device protection is required including tamper inspection procedures." },
  { id:"pci-req10",  fw:"PCI DSS", section:"Req 10", title:"Log and Monitor All Access",             text:"PCI DSS Requirement 10 requires logging all access to system components and cardholder data. Logs must capture user identification, event type, date/time, success/failure, origination, and identity of affected resource. Logs must be retained for at least 12 months with three months immediately available. Logs must be protected from modification and reviewed daily." },
  { id:"pci-req11",  fw:"PCI DSS", section:"Req 11", title:"Test Security Regularly",                text:"PCI DSS Requirement 11 requires regular testing of security systems and processes. External vulnerability scans must be performed quarterly by an Approved Scanning Vendor (ASV). Internal vulnerability scans must also be performed quarterly. Annual penetration testing is required. Intrusion detection and file integrity monitoring must be deployed in the CDE." },
  { id:"pci-req12",  fw:"PCI DSS", section:"Req 12", title:"Information Security Policies and Program", text:"PCI DSS Requirement 12 requires a comprehensive information security policy covering all PCI DSS requirements, reviewed annually. A formal risk assessment process is required at least annually. Security awareness training is required for all personnel. An incident response plan must be developed, maintained, and tested. Service provider relationships must be managed with written agreements requiring PCI DSS compliance." },
  { id:"pci-saq",    fw:"PCI DSS", section:"SAQ",    title:"Self-Assessment Questionnaire Types",    text:"Most community banks and Level 3/4 merchants validate PCI compliance through a Self-Assessment Questionnaire (SAQ). SAQ type is determined by how the entity processes card data: SAQ A (fully outsourced, card-not-present), SAQ B (imprint or standalone dial-out terminals), SAQ C (payment application connected to internet), SAQ D (all other merchants and service providers). SAQ D is the most comprehensive with ~286 questions." },
  { id:"pci-levels", fw:"PCI DSS", section:"Levels", title:"Compliance Levels by Transaction Volume", text:"PCI compliance requirements are tiered by annual transaction volume. Level 1 (over 6M transactions/year): requires annual on-site QSA audit and quarterly ASV scans. Level 2 (1M-6M): annual SAQ and quarterly ASV scans. Level 3 (20K-1M e-commerce): annual SAQ and quarterly ASV scans. Level 4 (under 20K): annual SAQ; ASV scan may be required by acquirer. Most community banks and their merchant clients fall into Level 3 or 4." },
  { id:"pci-v4",     fw:"PCI DSS", section:"v4.0",   title:"Key Changes in PCI DSS v4.0",            text:"PCI DSS v4.0 became mandatory in March 2024. Key changes include: MFA now required for ALL access into the CDE (not just remote access); minimum password length increased to 12 characters; new e-skimming requirements (6.4.3 and 11.6.1) requiring script inventory and tamper detection for payment pages; Targeted Risk Analysis required to determine frequency of certain activities; Customized Approach option allows flexible control implementation for mature organizations." },
];

// ─── QUESTION BANK ────────────────────────────────────────────────────────────
// To add/update questions: edit /public/questions.json and push to GitHub.
// The app loads from that file at runtime; the array below is the fallback.
const QUESTIONS = [
  { id:"mfa",        domain:"Access Controls",      text:"Does your organization enforce multi-factor authentication for all privileged and remote access?",                                              frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA"], weight:3, followUp:"Which systems — core banking, email, VPN?",                       controls:{"NY DFS 500":"§500.12","FFIEC":"CAT Domain 2","GLBA":"§314.4(c)","SOC 2":"CC6.1","NCUA":"FFIEC ref"} },
  { id:"encrypt",    domain:"Data Protection",       text:"Is sensitive customer data encrypted at rest (AES-256) and in transit (TLS 1.2+)?",                                                          frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA"], weight:3, followUp:"Do you have a documented encryption policy?",                       controls:{"NY DFS 500":"§500.15","FFIEC":"Data Security","GLBA":"§314.4(e)","SOC 2":"CC9.1","NCUA":"FFIEC ref"} },
  { id:"ir_plan",    domain:"Incident Response",     text:"Do you have a documented, board-approved Incident Response Plan tested within the past 12 months?",                                          frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA"], weight:3, followUp:"Was the last test a tabletop or full simulation?",                  controls:{"NY DFS 500":"§500.16","FFIEC":"BCP/IR","GLBA":"§314.4(h)","SOC 2":"CC7.3","NCUA":"FFIEC ref"} },
  { id:"vendor",     domain:"Vendor Management",     text:"Do you conduct documented security assessments of third-party vendors with access to customer data?",                                         frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2"],         weight:2, followUp:"Is there a formal vendor risk register maintained?",               controls:{"NY DFS 500":"§500.11","FFIEC":"Outsourcing","GLBA":"§314.4(f)","SOC 2":"CC9.2"} },
  { id:"pentest",    domain:"Risk Assessment",       text:"Does your organization perform annual penetration testing AND quarterly vulnerability scans with tracked remediation?",                       frameworks:["NY DFS 500","FFIEC","SOC 2","NCUA"],         weight:2, followUp:"Are findings tracked to remediation with defined SLAs?",           controls:{"NY DFS 500":"§500.05","FFIEC":"Vulnerability Mgmt","SOC 2":"CC4.1","NCUA":"FFIEC ref"} },
  { id:"training",   domain:"Security Awareness",    text:"Do all employees receive annual cybersecurity awareness training, including phishing simulations?",                                           frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA"], weight:2, followUp:"Is completion tracked and reported to the Board?",                  controls:{"NY DFS 500":"§500.14","FFIEC":"Awareness","GLBA":"§314.4(b)","SOC 2":"CC1.4","NCUA":"FFIEC ref"} },
  { id:"ciso",       domain:"Governance",            text:"Has your organization appointed a qualified CISO (or equivalent) who reports to the Board at least annually?",                               frameworks:["NY DFS 500","FFIEC","SOC 2"],                weight:2, followUp:"Does the CISO report directly to the Board or senior executive?",   controls:{"NY DFS 500":"§500.04","FFIEC":"IT Governance","SOC 2":"CC1.3"} },
  { id:"bcdr",       domain:"Business Continuity",   text:"Is there a tested Business Continuity and Disaster Recovery plan with defined RTO/RPO for critical systems?",                                frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA"], weight:2, followUp:"What is your RTO/RPO for core systems?",                           controls:{"NY DFS 500":"§500.16","FFIEC":"BCP","GLBA":"§314.4(g)","SOC 2":"A1.2","NCUA":"FFIEC ref"} },
  { id:"access_rev", domain:"Access Controls",       text:"Are user access rights reviewed at least quarterly, with immediate revocation upon termination?",                                             frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2"],         weight:2, followUp:"Is there an automated provisioning/deprovisioning process?",       controls:{"NY DFS 500":"§500.07","FFIEC":"Access Mgmt","GLBA":"§314.4(c)","SOC 2":"CC6.2"} },
  { id:"risk_assess",domain:"Risk Assessment",       text:"Is a formal cybersecurity risk assessment conducted at least annually and reviewed by the Board?",                                            frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA"], weight:3, followUp:"When was the last formal risk assessment completed?",               controls:{"NY DFS 500":"§500.09","FFIEC":"CAT","GLBA":"§314.4(a)","SOC 2":"CC3.1","NCUA":"IRAM"} },
  { id:"logging",    domain:"Monitoring",            text:"Are comprehensive audit logs maintained, protected from tampering, and reviewed regularly for anomalies?",                                    frameworks:["NY DFS 500","FFIEC","SOC 2"],                weight:2, followUp:"How long are logs retained, and who reviews them?",                  controls:{"NY DFS 500":"§500.06","FFIEC":"Audit Logging","SOC 2":"CC7.2"} },
  { id:"cloud_sec",  domain:"Cloud Security",        text:"If using cloud services, are there documented cloud security policies, and are cloud environments audited regularly?",                        frameworks:["NY DFS 500","FFIEC","SOC 2"],                weight:2, followUp:"Which cloud providers are in use — AWS, Azure, M365?",              controls:{"NY DFS 500":"§500.13","FFIEC":"Cloud","SOC 2":"CC6.6"} },
  { id:"patch",      domain:"Asset Management",      text:"Is there a formal patch management process ensuring critical vulnerabilities are remediated within 30 days?",                                 frameworks:["NY DFS 500","FFIEC","GLBA","SOC 2"],         weight:2, followUp:"Is patch compliance reported to management monthly?",              controls:{"NY DFS 500":"§500.07","FFIEC":"Configuration Mgmt","GLBA":"§314.4(d)","SOC 2":"CC7.1"} },
  { id:"data_class", domain:"Data Governance",       text:"Has the organization completed a data classification inventory identifying all nonpublic information and where it resides?",                   frameworks:["NY DFS 500","GLBA","SOC 2"],                 weight:2, followUp:"Is the data inventory reviewed and updated at least annually?",    controls:{"NY DFS 500":"§500.13","GLBA":"§314.4(e)","SOC 2":"CC6.5"} },
  { id:"board_rep",  domain:"Governance",            text:"Does the Board receive at least annual cybersecurity reports covering risk posture, incidents, and program status?",                          frameworks:["NY DFS 500","FFIEC","SOC 2"],                weight:2, followUp:"Is board training on cyber risk provided annually?",                 controls:{"NY DFS 500":"§500.04","FFIEC":"IT Governance","SOC 2":"CC1.2"} },
  // ── NCUA-SPECIFIC ──────────────────────────────────────────────────────────
  { id:"ncua_72hr",         domain:"Incident Response",  text:"Does your organization have documented procedures to identify and report a cyber incident to NCUA within 72 hours of discovery?",              frameworks:["NCUA","NY DFS 500"],        weight:3, followUp:"Have you ever filed a 72-hour cyber incident notice with NCUA?",          controls:{"NCUA":"12 CFR 748(c)","NY DFS 500":"§500.17"} },
  { id:"ncua_board_cert",   domain:"Governance",         text:"Does the credit union's president or managing official annually certify compliance with the NCUA information security program requirements through MERIT?", frameworks:["NCUA"],               weight:3, followUp:"Who is responsible for submitting the annual certification?",          controls:{"NCUA":"12 CFR 748(a)"} },
  { id:"ncua_member_notify",domain:"Incident Response",  text:"Does your incident response program include documented member notification procedures triggered by unauthorized access to member information?",  frameworks:["NCUA","GLBA"],             weight:3, followUp:"What is your target timeline for member notification after a breach?",  controls:{"NCUA":"12 CFR 748 App B","GLBA":"§314.4(h)"} },
  { id:"ncua_acet",         domain:"Risk Assessment",    text:"Has the credit union completed a self-assessment using the NCUA ACET or FFIEC CAT across all five maturity domains?",                           frameworks:["NCUA","FFIEC"],            weight:2, followUp:"What maturity level did you achieve — Baseline, Evolving, or Intermediate?", controls:{"NCUA":"ACET","FFIEC":"CAT"} },
  { id:"ncua_vital_records",domain:"Business Continuity",text:"Does the credit union maintain a vital records preservation program with off-site duplicate storage for permanent and critical operational records?", frameworks:["NCUA"],                  weight:2, followUp:"When were off-site backups last tested for restorability?",             controls:{"NCUA":"12 CFR 749"} },
  { id:"ncua_catastrophic", domain:"Incident Response",  text:"Are there documented procedures to notify the NCUA regional director within 5 business days of a catastrophic act disrupting vital member services?", frameworks:["NCUA"],                  weight:2, followUp:"Who is the designated contact responsible for NCUA catastrophic act notification?", controls:{"NCUA":"12 CFR 748(b)"} },
  // ── FFIEC GAPS ─────────────────────────────────────────────────────────────
  { id:"ffiec_threat_intel",domain:"Monitoring",         text:"Does the institution participate in financial sector threat intelligence sharing (e.g., FS-ISAC) and incorporate threat intel into its security monitoring?", frameworks:["FFIEC","NCUA"], weight:2, followUp:"Is threat intelligence reviewed by security staff on a recurring basis?",  controls:{"FFIEC":"CAT Domain 2","NCUA":"ACET Domain 2"} },
  { id:"ffiec_change_mgmt", domain:"Asset Management",   text:"Is there a formal change management process requiring security review and approval before changes are deployed to production systems?",                    frameworks:["FFIEC","SOC 2"],           weight:2, followUp:"Are emergency changes subject to post-implementation security review?",   controls:{"FFIEC":"Operations","SOC 2":"CC8.1"} },
  { id:"ffiec_network_seg", domain:"Access Controls",    text:"Are production networks segmented from corporate networks, with controls limiting lateral movement between segments?",                                     frameworks:["FFIEC","NY DFS 500","SOC 2"], weight:2, followUp:"Is network segmentation validated through penetration testing?",        controls:{"FFIEC":"Network Security","NY DFS 500":"§500.02","SOC 2":"CC6.6"} },
  // ── GLBA GAPS ──────────────────────────────────────────────────────────────
  { id:"glba_qualified_individual",      domain:"Governance",      text:"Has a qualified individual been designated to oversee, implement, and enforce the information security program, with annual reporting to the Board?",   frameworks:["GLBA","FFIEC"],            weight:3, followUp:"Does this individual have documented cybersecurity qualifications?",      controls:{"GLBA":"§314.4(a)","FFIEC":"IT Governance"} },
  { id:"glba_service_provider_contract", domain:"Vendor Management",text:"Do contracts with service providers handling customer information explicitly require them to implement and maintain appropriate safeguards?",  frameworks:["GLBA","NY DFS 500","NCUA"], weight:2, followUp:"Are existing vendor contracts reviewed against Safeguards Rule requirements?", controls:{"GLBA":"§314.4(f)","NY DFS 500":"§500.11","NCUA":"12 CFR 748 App A"} },

  // ── PCI DSS v4.0 ───────────────────────────────────────────────────────────
  { id:"pci_saq_type",     domain:"Scoping",            text:"Has your organization determined the applicable SAQ type based on how cardholder data is stored, processed, and transmitted?",                      frameworks:["PCI DSS"], weight:3, followUp:"Which SAQ type applies — A, B, C, or D? Is processing fully outsourced?",           controls:{"PCI DSS":"SAQ Selection"} },
  { id:"pci_cde_scope",    domain:"Scoping",            text:"Has the cardholder data environment (CDE) been formally scoped and documented, identifying all systems that store, process, or transmit cardholder data?", frameworks:["PCI DSS"], weight:3, followUp:"Is the CDE segmented from other networks to reduce scope?",                      controls:{"PCI DSS":"Req 1 / Scoping"} },
  { id:"pci_network_seg",  domain:"Network Security",   text:"Is the cardholder data environment isolated from other networks using firewall controls, with documented rules restricting traffic to only what is necessary?", frameworks:["PCI DSS"], weight:3, followUp:"Are firewall rules reviewed at least every six months?",                        controls:{"PCI DSS":"Req 1.3"} },
  { id:"pci_defaults",     domain:"Configuration",      text:"Have all vendor-supplied default passwords and security settings been changed on systems in the CDE, with unnecessary services and ports disabled?",        frameworks:["PCI DSS"], weight:3, followUp:"Is there a documented hardening standard applied to all in-scope systems?",       controls:{"PCI DSS":"Req 2.1"} },
  { id:"pci_pan_storage",  domain:"Data Protection",    text:"Does your organization have a data retention policy limiting storage of cardholder data to the minimum necessary, with secure disposal procedures?",         frameworks:["PCI DSS"], weight:3, followUp:"Are stored PANs rendered unreadable (encrypted, truncated, or tokenized)?",       controls:{"PCI DSS":"Req 3.2 / 3.5"} },
  { id:"pci_sad",          domain:"Data Protection",    text:"Has your organization confirmed that sensitive authentication data (CVV, full magnetic stripe, PIN block) is never stored after authorization?",            frameworks:["PCI DSS"], weight:3, followUp:"Has a cardholder data discovery scan been run to confirm no SAD is stored?",      controls:{"PCI DSS":"Req 3.3"} },
  { id:"pci_tls",          domain:"Data Protection",    text:"Is cardholder data encrypted using TLS 1.2 or higher for all transmission over open/public networks?",                                                       frameworks:["PCI DSS"], weight:3, followUp:"Is an inventory maintained of all trusted certificates used to protect transmissions?", controls:{"PCI DSS":"Req 4.2"} },
  { id:"pci_antimalware",  domain:"System Security",    text:"Is anti-malware software deployed on all system components susceptible to malware, with current definitions and periodic scans enabled?",                   frameworks:["PCI DSS"], weight:2, followUp:"Are anti-malware logs retained and reviewed regularly?",                          controls:{"PCI DSS":"Req 5.2"} },
  { id:"pci_patching",     domain:"Vulnerability Mgmt", text:"Is there a formal patch management process ensuring critical security patches are applied within one month of release for in-scope systems?",               frameworks:["PCI DSS"], weight:3, followUp:"Is an asset inventory maintained covering all hardware and software in the CDE?",   controls:{"PCI DSS":"Req 6.3"} },
  { id:"pci_eskimming",    domain:"Application Security", text:"For web-based payment pages: is there an inventory of all scripts authorized to execute, and is change- and tamper-detection monitoring in place to alert on unauthorized modifications?", frameworks:["PCI DSS"], weight:3, followUp:"Are payment page scripts reviewed and re-authorized at least annually (Req 6.4.3)? Is an HTTP response header or file integrity mechanism in place for tamper detection (Req 11.6.1)?", controls:{"PCI DSS":"Req 6.4.3 / 11.6.1"} },
  { id:"pci_mfa",          domain:"Access Controls",    text:"Is multi-factor authentication enforced for ALL access into the cardholder data environment, including access from internal networks?",                      frameworks:["PCI DSS"], weight:3, followUp:"Does MFA apply to all CDE access or only remote/privileged access?",                controls:{"PCI DSS":"Req 8.4"} },
  { id:"pci_unique_ids",   domain:"Access Controls",    text:"Does every user with access to the CDE have a unique user ID, with shared or generic accounts prohibited?",                                                   frameworks:["PCI DSS"], weight:3, followUp:"Are inactive user accounts removed or disabled within 90 days of inactivity?",        controls:{"PCI DSS":"Req 8.2"} },
  { id:"pci_passwords",    domain:"Access Controls",    text:"Do password policies require a minimum of 12 characters with complexity requirements for all accounts accessing in-scope systems?",                          frameworks:["PCI DSS"], weight:2, followUp:"Is password history enforced to prevent reuse of previous passwords?",                controls:{"PCI DSS":"Req 8.3"} },
  { id:"pci_least_priv",   domain:"Access Controls",    text:"Are access rights to cardholder data restricted to only individuals whose job function requires such access, with formal access request and approval?",     frameworks:["PCI DSS"], weight:2, followUp:"Are access rights reviewed at least every six months?",                              controls:{"PCI DSS":"Req 7.2"} },
  { id:"pci_physical",     domain:"Physical Security",  text:"Is physical access to systems in the CDE restricted and logged, with controls preventing unauthorized access to cardholder data or systems?",               frameworks:["PCI DSS"], weight:2, followUp:"Are visitor logs maintained and physical media destruction procedures documented?",  controls:{"PCI DSS":"Req 9.3"} },
  { id:"pci_logging",      domain:"Monitoring",         text:"Are audit logs generated for all access to in-scope systems and cardholder data, retained for at least 12 months (3 months immediately available)?",        frameworks:["PCI DSS"], weight:3, followUp:"Are logs reviewed daily and protected from unauthorized modification?",               controls:{"PCI DSS":"Req 10.2 / 10.5"} },
  { id:"pci_vuln_scan",    domain:"Testing",            text:"Are external vulnerability scans performed at least quarterly by an Approved Scanning Vendor (ASV), with internal scans also performed quarterly?",        frameworks:["PCI DSS"], weight:3, followUp:"Are all high-risk vulnerabilities remediated and scans repeated until passing?",      controls:{"PCI DSS":"Req 11.3"} },
  { id:"pci_pentest",      domain:"Testing",            text:"Is an annual penetration test conducted covering both network-layer and application-layer testing of the CDE perimeter and internal systems?",               frameworks:["PCI DSS"], weight:2, followUp:"Are penetration test findings tracked to remediation with defined timelines?",       controls:{"PCI DSS":"Req 11.4"} },
  { id:"pci_policy",       domain:"Governance",         text:"Is there a written information security policy covering all PCI DSS requirements, reviewed and updated at least annually?",                                  frameworks:["PCI DSS"], weight:3, followUp:"Is the policy communicated to all personnel and service providers?",                 controls:{"PCI DSS":"Req 12.1"} },
  { id:"pci_risk_assess",  domain:"Governance",         text:"Is a formal targeted risk assessment performed at least annually to identify threats and vulnerabilities to the cardholder data environment?",               frameworks:["PCI DSS"], weight:2, followUp:"Is the risk assessment used to determine frequencies of testing activities?",       controls:{"PCI DSS":"Req 12.3"} },
  { id:"pci_awareness",    domain:"Governance",         text:"Do all personnel with access to cardholder data receive security awareness training upon hire and at least annually thereafter?",                            frameworks:["PCI DSS"], weight:2, followUp:"Does training include phishing awareness and social engineering recognition?",        controls:{"PCI DSS":"Req 12.6"} },
  { id:"pci_vendor_mgmt",  domain:"Vendor Management",  text:"Are written agreements in place with all service providers that handle cardholder data, explicitly requiring PCI DSS compliance?",                          frameworks:["PCI DSS"], weight:2, followUp:"Is a list of service providers maintained with annual confirmation of their PCI DSS status?", controls:{"PCI DSS":"Req 12.8"} },
  { id:"pci_irp",          domain:"Incident Response",  text:"Is there a documented incident response plan covering cardholder data breaches, including notification procedures to card brands and acquiring bank?",      frameworks:["PCI DSS"], weight:3, followUp:"Has the incident response plan been tested within the past 12 months?",                controls:{"PCI DSS":"Req 12.10"} },

  // ── PCI DSS — Service Provider specific (SAQ D-SP only) ───────────────────
  { id:"pci_sp_evidence",  domain:"Vendor Management",  text:"Does your organization provide customers with evidence of your PCI DSS compliance status upon request, and do your service agreements explicitly acknowledge your responsibility for securing cardholder data?",  frameworks:["PCI DSS"], weight:3, followUp:"Do you maintain a current list of customers requiring annual PCI DSS compliance confirmation?", controls:{"PCI DSS":"Req 12.9"} },
  { id:"pci_sp_scope",     domain:"Governance",         text:"Is your PCI DSS scope formally documented and confirmed at least every six months, including after any significant changes to your environment or services?",                                                          frameworks:["PCI DSS"], weight:3, followUp:"Does scope confirmation include review of all customer environments you could impact?",          controls:{"PCI DSS":"Req 12.5.2.1"} },
];


// ─── SAQ v4.0.1 QUESTION MAPPING ─────────────────────────────────────────────
// Maps each SAQ type to the subset of PCI DSS question IDs that apply.
// Based on PCI DSS v4.0.1 SAQ applicability tables from pcisecuritystandards.org.
// SAQ A:    Card-not-present, fully outsourced. Lowest scope.
// SAQ A-EP: E-commerce merchant whose website affects security of payment page
//           (controls redirect/iframe to TPSP). Higher scope than SAQ A.
//           Critical for ISVs with embedded payment pages. If TPSP injects
//           scripts into checkout, merchant may lose SAQ A eligibility entirely.
// SAQ B:    Imprint machines / standalone dial-out terminals only.
// SAQ C:    Payment app connected to internet. No CHD storage.
// SAQ D:    All other merchants. Full requirements.
// SAQ D-SP: All service providers eligible for SAQ. Broadest scope.
const SAQ_QUESTION_MAP = {
  "SAQ A": {
    label: "SAQ A — Card-Not-Present, Fully Outsourced",
    description: "Processing fully outsourced to a PCI DSS-compliant third party. No cardholder data on merchant systems. Merchant website fully redirects to TPSP-hosted payment page.",
    applicableRequirements: ["Req 2.1","Req 8.2","Req 8.3","Req 8.4","Req 9.3","Req 12.1","Req 12.6","Req 12.8","Req 12.10"],
    questionIds: [
      "pci_defaults",    // Req 2.1
      "pci_unique_ids",  // Req 8.2
      "pci_passwords",   // Req 8.3
      "pci_mfa",         // Req 8.4
      "pci_physical",    // Req 9.3
      "pci_policy",      // Req 12.1
      "pci_awareness",   // Req 12.6
      "pci_vendor_mgmt", // Req 12.8
      "pci_irp",         // Req 12.10
    ],
    // pci_saq_type excluded — user confirmed SAQ type on the selection screen
    notApplicable: [
      "pci_saq_type","pci_cde_scope","pci_network_seg","pci_pan_storage","pci_sad",
      "pci_tls","pci_antimalware","pci_patching","pci_eskimming","pci_least_priv",
      "pci_logging","pci_vuln_scan","pci_pentest","pci_risk_assess",
      "pci_sp_evidence","pci_sp_scope",  // SP-only requirements
    ],
  },
  "SAQ A-EP": {
    label: "SAQ A-EP — E-Commerce, Merchant Controls Payment Page Redirect",
    description: "E-commerce merchants who outsource payment processing but whose website controls how customers are redirected to the TPSP payment page (e.g. controls iframe or redirect). Merchant affects the security of the transaction. Higher scope than SAQ A.",
    applicableRequirements: [
      "Req 2.1","Req 3.3","Req 4.2","Req 5.2","Req 6.3","Req 6.4.3",
      "Req 8.2","Req 8.3","Req 8.4","Req 9.3","Req 10.2","Req 11.3",
      "Req 11.6.1","Req 12.1","Req 12.3","Req 12.6","Req 12.8","Req 12.10",
    ],
    questionIds: [
      "pci_defaults",    // Req 2.1
      "pci_sad",         // Req 3.3 — SAD prohibition
      "pci_tls",         // Req 4.2 — encrypt transmission
      "pci_antimalware", // Req 5.2 — anti-malware on systems
      "pci_patching",    // Req 6.3 — patch management
      "pci_eskimming",   // Req 6.4.3 / 11.6.1 — script inventory + tamper detection (critical for A-EP)
      "pci_unique_ids",  // Req 8.2
      "pci_passwords",   // Req 8.3
      "pci_mfa",         // Req 8.4
      "pci_physical",    // Req 9.3
      "pci_logging",     // Req 10.2
      "pci_vuln_scan",   // Req 11.3 — quarterly ASV scans required
      "pci_policy",      // Req 12.1
      "pci_risk_assess", // Req 12.3 — targeted risk analysis
      "pci_awareness",   // Req 12.6
      "pci_vendor_mgmt", // Req 12.8
      "pci_irp",         // Req 12.10
    ],
    notApplicable: [
      "pci_saq_type","pci_cde_scope","pci_network_seg","pci_pan_storage",
      "pci_least_priv","pci_pentest",
      "pci_sp_evidence","pci_sp_scope",  // SP-only requirements
    ],
    aepNote: "SAQ A-EP requires script inventory and tamper/change detection for all payment page scripts (Req 6.4.3 and 11.6.1) — a v4.0 requirement many e-commerce merchants miss. If a TPSP injects scripts into the checkout flow via inline or cross-domain JavaScript, the merchant may lose SAQ A eligibility and must use SAQ A-EP or SAQ D instead.",
  },
  "SAQ B": {
    label: "SAQ B — Imprint Machines / Standalone Dial-Out Terminals",
    description: "Merchants using only imprint machines or standalone dial-out terminals. No internet on payment systems.",
    applicableRequirements: ["Req 2.1","Req 3.3","Req 9.3","Req 12.1","Req 12.6","Req 12.8","Req 12.10"],
    questionIds: [
      "pci_defaults",    // Req 2.1
      "pci_sad",         // Req 3.3 — SAD prohibition still applies
      "pci_physical",    // Req 9.3
      "pci_policy",      // Req 12.1
      "pci_awareness",   // Req 12.6
      "pci_vendor_mgmt", // Req 12.8
      "pci_irp",         // Req 12.10
    ],
    notApplicable: [
      "pci_saq_type","pci_cde_scope","pci_network_seg","pci_pan_storage","pci_tls",
      "pci_antimalware","pci_patching","pci_eskimming","pci_mfa","pci_unique_ids",
      "pci_passwords","pci_least_priv","pci_logging","pci_vuln_scan","pci_pentest",
      "pci_risk_assess","pci_sp_evidence","pci_sp_scope",  // SP-only requirements
    ],
  },
  "SAQ C": {
    label: "SAQ C — Payment Application Connected to Internet",
    description: "Payment application systems connected to the internet. No electronic storage of cardholder data.",
    applicableRequirements: [
      "Req 1.3","Req 2.1","Req 3.3","Req 4.2","Req 5.2","Req 6.3",
      "Req 8.2","Req 8.3","Req 8.4","Req 9.3","Req 10.2","Req 11.3","Req 12.1",
      "Req 12.3","Req 12.6","Req 12.8","Req 12.10",
    ],
    questionIds: [
      "pci_cde_scope","pci_network_seg","pci_defaults",
      "pci_sad","pci_tls","pci_antimalware","pci_patching",
      "pci_unique_ids","pci_passwords","pci_mfa","pci_physical",
      "pci_logging","pci_vuln_scan","pci_policy","pci_risk_assess",
      "pci_awareness","pci_vendor_mgmt","pci_irp",
    ],
    notApplicable: [
      "pci_saq_type",     // User confirmed SAQ type on selection screen
      "pci_pan_storage",  // No CHD storage in SAQ C
      "pci_eskimming",    // Req 6.4.3 / 11.6.1 not in SAQ C
      "pci_least_priv",   // Req 7 not in SAQ C
      "pci_pentest",      // Req 11.4 not required in SAQ C
      "pci_sp_evidence","pci_sp_scope",  // SP-only requirements
    ],
  },
  "SAQ D": {
    label: "SAQ D — All Other Merchants (Full Scope)",
    description: "All merchants not eligible for SAQ A, B, or C. All 12 PCI DSS Requirements apply.",
    applicableRequirements: [
      "Req 1.3","Req 2.1","Req 3.2","Req 3.3","Req 3.5","Req 4.2","Req 5.2","Req 6.3",
      "Req 6.4.3","Req 7.2","Req 8.2","Req 8.3","Req 8.4","Req 9.3","Req 10.2","Req 10.5",
      "Req 11.3","Req 11.4","Req 11.6.1","Req 12.1","Req 12.3","Req 12.6","Req 12.8","Req 12.10",
    ],
    questionIds: [
      "pci_cde_scope","pci_network_seg","pci_defaults",
      "pci_pan_storage","pci_sad","pci_tls","pci_antimalware","pci_patching",
      "pci_eskimming","pci_least_priv","pci_mfa","pci_unique_ids","pci_passwords",
      "pci_physical","pci_logging","pci_vuln_scan","pci_pentest","pci_policy",
      "pci_risk_assess","pci_awareness","pci_vendor_mgmt","pci_irp",
    ],
    notApplicable: ["pci_saq_type","pci_sp_evidence","pci_sp_scope"],  // SP-only requirements
  },
  "SAQ D-SP": {
    label: "SAQ D-SP — Service Providers (Full Scope)",
    description: "All service providers eligible to complete an SAQ. Broadest scope — all 12 Requirements plus SP-specific controls.",
    applicableRequirements: [
      "Req 1.3","Req 2.1","Req 3.2","Req 3.3","Req 3.5","Req 4.2","Req 5.2","Req 6.3",
      "Req 6.4.3","Req 7.2","Req 8.2","Req 8.3","Req 8.4","Req 9.3","Req 10.2","Req 10.5",
      "Req 11.3","Req 11.4","Req 11.6.1","Req 12.1","Req 12.3","Req 12.6","Req 12.8",
      "Req 12.9","Req 12.10",
    ],
    questionIds: [
      "pci_cde_scope","pci_network_seg","pci_defaults",
      "pci_pan_storage","pci_sad","pci_tls","pci_antimalware","pci_patching",
      "pci_eskimming","pci_least_priv","pci_mfa","pci_unique_ids","pci_passwords",
      "pci_physical","pci_logging","pci_vuln_scan","pci_pentest","pci_policy",
      "pci_risk_assess","pci_awareness","pci_vendor_mgmt","pci_irp",
      "pci_sp_evidence",   // Req 12.9 — SP-specific: provide compliance evidence to customers
      "pci_sp_scope",      // Req 12.5.2.1 — SP-specific: confirm scope every 6 months
    ],
    spNote: "As a service provider you must maintain evidence of your own PCI DSS compliance and provide it to customers upon request (Req 12.9). Ensure your MSA templates include this obligation. Note: A1 (shared hosting) and A3 (designated entities) supplemental requirements are not covered in this readiness assessment.",
    notApplicable: ["pci_saq_type"],
  },
};

// Auto-infers SAQ type from client type string for pre-selection in assessment UI.
// ISOs are service providers (SAQ D-SP) — they have their own service provider PCI obligation
// separate from whatever merchant portal their acquirer uses for downstream merchants.
function inferSaqType(clientType) {
  if (!clientType) return null;
  const t = clientType.toLowerCase();
  if (t.includes("isv") || t.includes("service provider") || t.includes("payment processor") || t.includes("iso") || t.includes("fintech")) return "SAQ D-SP";
  return null;
}

const ANSWER_OPTIONS = [
  { value:"yes",     label:"Yes — fully in place",       score:1.0, icon:"✓" },
  { value:"partial", label:"Partially — in progress",    score:0.5, icon:"◑" },
  { value:"no",      label:"No — not yet addressed",     score:0.0, icon:"✗" },
  { value:"na",      label:"Not applicable",             score:null, icon:"—" },
];

// ─── MOCK CLIENT DATA ─────────────────────────────────────────────────────────
const MOCK_CLIENTS = [
  { id:"c1", name:"First Community CU",    type:"Credit Union",     employees:120, lastAssessment:"2025-11-15", score:0.62, tier:"Standard" },
  { id:"c2", name:"Harbor Community Bank", type:"Community Bank",   employees:85,  lastAssessment:"2025-12-03", score:0.44, tier:"Premium"  },
  { id:"c3", name:"Tri-State Insurance",   type:"Insurance Co.",    employees:200, lastAssessment:"2026-01-20", score:0.81, tier:"Premium"  },
  { id:"c4", name:"Meadowbrook Savings",   type:"Community Bank",   employees:45,  lastAssessment:null,         score:null, tier:"Standard" },
  { id:"c5", name:"PayBridge Solutions",   type:"ISO",              employees:32,  lastAssessment:null,         score:null, tier:"Standard" },
  { id:"c6", name:"NexaPay Technologies",  type:"ISV",              employees:65,  lastAssessment:"2026-02-10", score:0.51, tier:"Premium"  },
];

const MOCK_ALERTS = [
  { id:"a1", clientId:"c1", severity:"HIGH",   domain:"Access Controls",    text:"MFA policy not enforced on email system — vendor update broke enforcement rule.",       fw:["NY DFS 500","SOC 2"],   time:"2h ago",  status:"open" },
  { id:"a2", clientId:"c2", severity:"HIGH",   domain:"Incident Response",  text:"IR Plan not tested in 14 months — exceeds annual testing requirement under §500.16.",   fw:["NY DFS 500","FFIEC"],  time:"1d ago",  status:"open" },
  { id:"a3", clientId:"c1", severity:"MEDIUM", domain:"Vendor Management",  text:"New SaaS vendor (DocuSign) added without completing vendor security assessment.",        fw:["NY DFS 500","GLBA"],   time:"3d ago",  status:"open" },
  { id:"a4", clientId:"c3", severity:"LOW",    domain:"Asset Management",   text:"3 servers flagged with overdue patches (>45 days). Remediation SLA at risk.",           fw:["FFIEC","SOC 2"],       time:"5d ago",  status:"open" },
  { id:"a5", clientId:"c2", severity:"HIGH",   domain:"Risk Assessment",    text:"Annual risk assessment overdue by 2 months. Board report deadline approaching.",         fw:["NY DFS 500","NCUA"],   time:"6d ago",  status:"open" },
  { id:"a6", clientId:"c1", severity:"MEDIUM", domain:"Security Awareness", text:"22% of staff have not completed annual phishing simulation.",                             fw:["NY DFS 500","GLBA"],   time:"1w ago",  status:"open" },
];

// ─── REGULATORY SOURCE GROUNDING ─────────────────────────────────────────────
// Fetches live regulatory text from authoritative government sources.
// Injects as context into AI calls so outputs are grounded in actual source
// documents, not Claude's training memory.

const REG_SOURCES = {
  FFIEC_INFOSEC: {
    url: "https://ithandbook.ffiec.gov/it-booklets/information-security",
    label: "FFIEC Information Security Booklet"
  },
  FFIEC_BCM: {
    url: "https://ithandbook.ffiec.gov/it-booklets/business-continuity-management",
    label: "FFIEC Business Continuity Management Booklet"
  },
  FFIEC_MGMT: {
    url: "https://ithandbook.ffiec.gov/it-booklets/management",
    label: "FFIEC Management Booklet"
  },
  NYDFS_500: {
    url: "https://www.dfs.ny.gov/industry_guidance/cybersecurity",
    label: "NY DFS 23 NYCRR Part 500 Cybersecurity Requirements"
  },
  NYDFS_500_REG: {
    url: "https://www.dfs.ny.gov/docs/legal/regulations/adoptions/dfsrf500txt.pdf",
    label: "NY DFS Part 500 Full Regulation Text"
  },
  NCUA_748: {
    url: "https://www.ncua.gov/regulation-supervision/rules-regulations/12-cfr-748",
    label: "NCUA 12 CFR 748 Information Security Requirements"
  },
  NCUA_ACET: {
    url: "https://www.ncua.gov/regulation-supervision/examination-resources/acet",
    label: "NCUA Automated Cybersecurity Evaluation Tool (ACET)"
  },
  NCUA_EXAM: {
    url: "https://www.ncua.gov/regulation-supervision/examination-resources/examination-modernization",
    label: "NCUA Examination Resources and Modernization"
  },
  GLBA_SAFEGUARDS: {
    url: "https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act",
    label: "GLBA Gramm-Leach-Bliley Act FTC Safeguards Rule"
  },
  GLBA_314: {
    url: "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314",
    label: "GLBA 16 CFR Part 314 Standards for Safeguarding Customer Information"
  },
  SOC2_AICPA: {
    url: "https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services",
    label: "AICPA SOC 2 Trust Services Criteria"
  },
  SOC2_TSC: {
    url: "https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria",
    label: "AICPA 2017 Trust Services Criteria (SOC 2)"
  },
  PCI_DSS_STANDARDS: {
    url: "https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-D-Service-Provider.pdf",
    label: "PCI DSS v4.0 SAQ D for Service Providers (full requirements)"
  },
  PCI_DSS_QRG: {
    url: "https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-D-Merchant.pdf",
    label: "PCI DSS v4.0 SAQ D for Merchants"
  },
  PCI_DSS_SAQ: {
    url: "https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-A.pdf",
    label: "PCI DSS v4.0 SAQ A (card-not-present, fully outsourced)"
  },
  PCI_DSS_SAQ_C: {
    url: "https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-C.pdf",
    label: "PCI DSS v4.0 SAQ C (payment application with internet)"
  },
  PCI_DSS_SAQ_B: {
    url: "https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-B.pdf",
    label: "PCI DSS v4.0 SAQ B (imprint/standalone terminals)"
  }
};

// Maps each framework to the sources most relevant for grounding
const FRAMEWORK_SOURCES = {
  "FFIEC":      ["FFIEC_INFOSEC", "FFIEC_BCM", "FFIEC_MGMT"],
  "NCUA":       ["NCUA_748", "NCUA_ACET", "NCUA_EXAM", "FFIEC_INFOSEC"],
  "NY DFS 500": ["NYDFS_500", "NYDFS_500_REG"],
  "GLBA":       ["GLBA_SAFEGUARDS", "GLBA_314", "FFIEC_INFOSEC"],
  "SOC 2":      ["SOC2_AICPA", "SOC2_TSC", "FFIEC_INFOSEC"],
  "PCI DSS":    ["PCI_DSS_STANDARDS", "PCI_DSS_QRG", "PCI_DSS_SAQ", "PCI_DSS_SAQ_C", "PCI_DSS_SAQ_B"],
};

// Builds the web_search tool config for Anthropic API calls
function buildWebSearchTool() {
  return [{ type: "web_search_20250305", name: "web_search" }];
}

// Builds a grounding instruction block for system prompts
// Tells Claude which sources to search before generating output
function buildGroundingInstruction(frameworks = [], context = "") {
  const sourceKeys = new Set();
  frameworks.forEach(fw => {
    (FRAMEWORK_SOURCES[fw] || []).forEach(k => sourceKeys.add(k));
  });
  // Always include FFIEC and DFS as baseline
  sourceKeys.add("FFIEC_INFOSEC");
  sourceKeys.add("NYDFS_500");

  const sourceList = [...sourceKeys].map(k => {
    const s = REG_SOURCES[k];
    return `- ${s.label}: ${s.url}`;
  }).join("\n");

  return `
CRITICAL GROUNDING REQUIREMENT:
Before generating any output, you MUST use web_search to fetch current regulatory text from these authoritative government sources:
${sourceList}

Search for specific sections relevant to ${context || "the compliance topics in this request"}.
Ground every regulatory citation, requirement, and section reference in the actual fetched text.
Do NOT rely on training memory for specific regulatory language — always verify against the live source document.
If a section you cite is not found in the fetched content, say so explicitly rather than guessing.
`;
}

// Extracts text content from Anthropic API response (handles tool use blocks)
function extractResponseText(data) {
  if (!data.content) return "";
  return data.content
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("\n");
}

// Makes an Anthropic API call with web search grounding enabled
async function groundedAICall({ system, userPrompt, frameworks = [], maxTokens = 1000, context = "", temperature = 1 }) {
  const groundingInstruction = buildGroundingInstruction(frameworks, context);
  const fullSystem = system + "\n\n" + groundingInstruction;

  const makeCall = async (useSearch) => {
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature: temperature,
      system: fullSystem,
      messages: [{ role: "user", content: userPrompt }]
    };
    if (useSearch) body.tools = buildWebSearchTool();
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    });
  };

  // Try with web search first, fall back without if rate limited
  let resp = await makeCall(true);
  if (resp.status === 429) {
    await new Promise(r => setTimeout(r, 2000));
    resp = await makeCall(false);
  }

  const data = await resp.json();
  return extractResponseText(data);
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportPDF(title, subtitle, sections) {
  // sections: [{ heading, content, type: "text"|"table"|"list" }]
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 48px; font-size: 13px; line-height: 1.6; }
  .header { border-bottom: 3px solid #4f7cff; padding-bottom: 20px; margin-bottom: 32px; }
  .logo { font-size: 11px; font-weight: 800; letter-spacing: 0.15em; color: #4f7cff; margin-bottom: 8px; }
  h1 { font-size: 26px; font-weight: 800; color: #0d0f1a; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #666; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section-heading { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; color: #4f7cff; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  .content { font-size: 13px; color: #374151; line-height: 1.8; }
  .content h2 { font-size: 15px; font-weight: 700; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
  .content h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin: 14px 0 4px; }
  .content ul { padding-left: 18px; margin: 6px 0 10px; list-style: disc; }
  .content li { margin: 3px 0; }
  .content p { margin: 0 0 8px; }
  .pill-green { display:inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #d1fae5; color: #065f46; margin-right: 6px; }
  .pill-yellow { display:inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #92400e; margin-right: 6px; }
  .pill-red { display:inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fee2e2; color: #991b1b; margin-right: 6px; }
  .score-row { display: flex; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
  .score-label { width: 140px; font-weight: 600; font-size: 12px; }
  .score-bar-bg { flex: 1; height: 8px; background: #f3f4f6; border-radius: 4px; }
  .score-bar-fill { height: 8px; border-radius: 4px; }
  .score-pct { width: 40px; text-align: right; font-weight: 700; font-size: 12px; }
  .gap-item { padding: 10px 14px; margin-bottom: 8px; border-left: 3px solid #ef4444; background: #fff5f5; border-radius: 0 6px 6px 0; }
  .gap-domain { font-weight: 700; font-size: 12px; color: #374151; margin-bottom: 2px; }
  .gap-text { font-size: 12px; color: #6b7280; }
  .gap-fw { font-size: 10px; color: #4f7cff; margin-top: 4px; font-weight: 600; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { @page { margin: 0.5in; } body { padding: 0; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">VERITAQ · AI COMPLIANCE PLATFORM</div>
  <h1>${title}</h1>
  <div class="subtitle">${subtitle}</div>
</div>
${sections.map(s => `
<div class="section">
  <div class="section-heading">${s.heading}</div>
  <div class="content">${s.content}</div>
</div>`).join("")}
<div class="footer">
  <span>Generated by Veritaq AI Compliance Platform · veritaq.ai</span>
  <span>${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</span>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups for app.veritaq.ai to export PDFs."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// Module-level action text helpers — used by both exportEngagementPackagePDF and exportBoardReportPDF
function toAction(domain, questionText) {
  const t = (questionText || "").toLowerCase();
  const actionMap = {
    "Scoping":            "Formally scope and document the cardholder data environment, identifying all systems that store, process, or transmit cardholder data.",
    "Network Security":   "Implement firewall controls to isolate the CDE from other networks with documented rules restricting traffic to only what is necessary.",
    "Configuration":      "Change all vendor-supplied default passwords, disable unnecessary services and ports, and document hardening standards for all in-scope systems.",
    "Data Protection":    t.includes("tls") ? "Enforce TLS 1.2+ encryption for all cardholder data transmission over open/public networks." :
                          t.includes("retention") ? "Implement a cardholder data retention and disposal policy limiting storage to the minimum necessary." :
                          t.includes("sad") || t.includes("sensitive auth") ? "Confirm and document that sensitive authentication data (CVV, magnetic stripe, PIN) is never stored after authorization." :
                          "Implement required cardholder data protection controls.",
    "System Security":    "Deploy and maintain anti-malware on all susceptible system components with current definitions and periodic scans enabled.",
    "Vulnerability Mgmt": "Establish a formal patch management process ensuring critical patches are applied within one month of release for all in-scope systems.",
    "Application Security": "Inventory all payment page scripts and implement tamper-detection monitoring per PCI DSS Req 6.4.3 and 11.6.1.",
    "Access Controls":    t.includes("password") ? "Enforce minimum 12-character password complexity requirements for all accounts accessing in-scope systems." :
                          t.includes("mfa") ? "Enforce multi-factor authentication for all access into the cardholder data environment." :
                          t.includes("unique") ? "Assign unique user IDs to all CDE users and prohibit shared or generic accounts." :
                          "Restrict access to cardholder data to only those with a documented business need; implement formal access reviews.",
    "Physical Security":  "Restrict and log physical access to CDE systems; implement visitor management and secure media destruction procedures.",
    "Monitoring":         "Implement audit logging for all CDE access, retained for 12 months, with daily log review procedures.",
    "Testing":            t.includes("asv") ? "Engage an Approved Scanning Vendor (ASV) for quarterly external vulnerability scans and conduct quarterly internal scans." :
                          "Conduct annual penetration testing covering CDE perimeter and internal systems; track all findings to remediation.",
    "Governance":         t.includes("policy") ? "Develop and board-approve a written information security policy covering all PCI DSS requirements, reviewed annually." :
                          t.includes("risk") ? "Conduct a formal targeted risk assessment annually covering CDE threats and vulnerabilities." :
                          t.includes("training") ? "Implement annual security awareness training for all personnel with access to cardholder data." :
                          "Establish and document governance controls required by PCI DSS.",
    "Vendor Management":  "Establish written agreements with all service providers handling cardholder data explicitly requiring PCI DSS compliance; maintain an annual compliance confirmation register.",
    "Incident Response":  "Develop and test an incident response plan covering cardholder data breaches, including card brand and acquirer notification procedures.",
  };
  return actionMap[domain] || `Implement and document ${domain.toLowerCase()} controls to satisfy PCI DSS requirements.`;
}

function toActionLabel(domain) {
  const labelMap = {
    "Scoping":            "Define & Document Cardholder Data Environment Scope",
    "Network Security":   "Implement CDE Network Segmentation & Firewall Controls",
    "Configuration":      "Apply Secure Configuration Baselines to In-Scope Systems",
    "Data Protection":    "Enforce Cardholder Data Protection & Encryption Controls",
    "System Security":    "Deploy Anti-Malware on All Susceptible System Components",
    "Vulnerability Mgmt": "Establish Formal Patch Management Program",
    "Application Security": "Implement Payment Page Script Inventory & Tamper Detection",
    "Access Controls":    "Enforce Least-Privilege Access & Authentication Requirements",
    "Physical Security":  "Implement Physical Access Controls for CDE Systems",
    "Monitoring":         "Deploy Audit Logging & Daily Review for All CDE Access",
    "Testing":            "Conduct Required ASV Scans & Annual Penetration Testing",
    "Governance":         "Establish PCI DSS Governance Policies & Risk Assessment",
    "Vendor Management":  "Execute Service Provider Agreements & Compliance Register",
    "Incident Response":  "Develop & Test Cardholder Data Breach Response Plan",
  };
  return labelMap[domain] || `Remediate ${domain} Control Gap`;
}

function exportEngagementPackagePDF(report, boardReportText, actionPlanText) {
  const { clientName, clientType, date, overallScore, frameworkScores, gaps, strengths } = report;
  const scopedFW = Object.entries(frameworkScores).filter(([, sc]) => sc > 0);

  // Deduplicate gaps by resolved action label+action text to prevent identical rendered blocks
  function dedupeGaps(gapList) {
    const seen = new Set();
    return gapList.filter(g => {
      const key = `${toActionLabel(g.domain)}||${toAction(g.domain, g.text)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const highGaps = dedupeGaps(gaps.filter(g => g.answer === "no"));
  const medGaps  = dedupeGaps(gaps.filter(g => g.answer !== "no"));

  const scoreColor = overallScore >= 0.75 ? "#065f46" : overallScore >= 0.45 ? "#92400e" : "#991b1b";
  const scoreBg    = overallScore >= 0.75 ? "#d1fae5" : overallScore >= 0.45 ? "#fef3c7" : "#fee2e2";
  const scoreLabel = overallScore >= 0.75 ? "Satisfactory" : overallScore >= 0.45 ? "Needs Attention" : "Critical Gaps";

  const FW_COLORS = {"NY DFS 500":"#3b82f6","FFIEC":"#10b981","GLBA":"#f59e0b","SOC 2":"#8b5cf6","NCUA":"#ec4899","PCI DSS":"#e85d04"};

  const fwBars = scopedFW.map(([fw, sc]) => {
    const pct = Math.round(sc * 100);
    const col = sc >= 0.75 ? "#065f46" : sc >= 0.45 ? "#92400e" : "#991b1b";
    const bg  = sc >= 0.75 ? "#d1fae5" : sc >= 0.45 ? "#fef3c7" : "#fee2e2";
    const lbl = sc >= 0.75 ? "Satisfactory" : sc >= 0.45 ? "Needs Attention" : "Critical Gaps";
    const bar = FW_COLORS[fw] || "#4f7cff";
    return `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid #f3f4f6;">
      <div style="width:110px;font-size:12px;font-weight:700;color:${bar};">${fw}</div>
      <div style="flex:1;height:8px;background:#f3f4f6;border-radius:4px;">
        <div style="width:${pct}%;height:8px;background:${bar};border-radius:4px;"></div>
      </div>
      <div style="width:36px;font-size:12px;font-weight:700;color:${col};text-align:right;">${pct}%</div>
      <div style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:10px;background:${bg};color:${col};">${lbl}</div>
    </div>`;
  }).join("");

  function gapBlock(g, idx) {
    const isHigh = g.answer === "no";
    const bc = isHigh ? "#ef4444" : "#f59e0b";
    const bb = isHigh ? "#fff5f5" : "#fffbeb";
    const inScopeFW = g.frameworks.filter(f => frameworkScores[f] !== undefined);
    const remediation = isHigh
      ? `Assign owner&nbsp;&middot;&nbsp;Document in risk register&nbsp;&middot;&nbsp;Implement controls&nbsp;&middot;&nbsp;Collect audit evidence`
      : `Verify completion&nbsp;&middot;&nbsp;Obtain evidence&nbsp;&middot;&nbsp;Update risk register&nbsp;&middot;&nbsp;Schedule follow-up`;
    return `<div style="padding:12px 16px;margin-bottom:10px;border-left:3px solid ${bc};background:${bb};border-radius:0 6px 6px 0;page-break-inside:avoid;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${bc}22;color:${bc};">${isHigh ? "HIGH" : "MEDIUM"}</span>
        <span style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.06em;">${g.domain.toUpperCase()}</span>
        ${inScopeFW.map(f => `<span style="font-size:10px;font-weight:700;color:${FW_COLORS[f]||"#4f7cff"};">${f}</span>`).join(" · ")}
      </div>
      <div style="font-size:13px;color:#1a1a2e;font-weight:600;margin-bottom:4px;">${toActionLabel(g.domain)}</div>
      <div style="font-size:12px;color:#374151;margin-bottom:6px;">${toAction(g.domain, g.text)}</div>
      <div style="font-size:12px;color:#374151;padding-top:8px;border-top:1px solid #e5e7eb;">
        <span style="font-size:10px;font-weight:700;color:#4f7cff;letter-spacing:0.08em;">REMEDIATION · </span>${remediation}
      </div>
    </div>`;
  }

  function timeframeBanner(timeframe) {
    if (timeframe === "immediate") return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:14px;background:#fee2e2;border-radius:8px;border-left:4px solid #ef4444;">
        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#ef4444;flex-shrink:0;"></span>
        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;color:#991b1b;">IMMEDIATE — 30 DAYS</div>
          <div style="font-size:11px;color:#b91c1c;">Assign owner&nbsp;·&nbsp;Document in risk register&nbsp;·&nbsp;Implement controls&nbsp;·&nbsp;Collect audit evidence</div>
        </div>
      </div>`;
    if (timeframe === "short") return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:14px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></span>
        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;color:#92400e;">SHORT TERM — 60-90 DAYS</div>
          <div style="font-size:11px;color:#b45309;">Verify completion&nbsp;·&nbsp;Obtain evidence&nbsp;·&nbsp;Update risk register</div>
        </div>
      </div>`;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:14px;background:#f3f4f6;border-radius:8px;border-left:4px solid #9ca3af;">
        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#9ca3af;flex-shrink:0;"></span>
        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;color:#374151;">ONGOING — 90 DAYS+</div>
          <div style="font-size:11px;color:#6b7280;">Monitor progress&nbsp;·&nbsp;Integrate into annual compliance cycle</div>
        </div>
      </div>`;
  }

  function actionBlock(g, timeframe) {
    const bc = timeframe === "immediate" ? "#ef4444" : timeframe === "short" ? "#f59e0b" : "#9ca3af";
    const bb = timeframe === "immediate" ? "#fff5f5" : timeframe === "short" ? "#fffbeb" : "#f9fafb";
    const instructions = timeframe === "immediate"
      ? "Assign owner&nbsp;&middot;&nbsp;Document in risk register&nbsp;&middot;&nbsp;Implement controls&nbsp;&middot;&nbsp;Collect audit evidence"
      : timeframe === "short"
      ? "Verify completion · Obtain evidence · Update risk register"
      : "Monitor progress&nbsp;&middot;&nbsp;Integrate into annual compliance cycle";
    return `<div style="padding:12px 16px;margin-bottom:10px;border-left:3px solid ${bc};background:${bb};border-radius:0 6px 6px 0;">
      <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">${toActionLabel(g.domain)}</div>
      <div style="font-size:12px;color:#374151;line-height:1.5;margin-bottom:6px;">${toAction(g.domain, g.text)}</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${instructions}</div>
      <div style="font-size:10px;color:#4f7cff;font-weight:700;">${g.frameworks.filter(f => frameworkScores[f]).join(" · ")}</div>
    </div>`;
  }

  function mdSimple(md) {
    if (!md) return "<p style='color:#9ca3af;'>Not generated.</p>";
    return md
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/^### (.+)$/gm,'<h3 style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin:14px 0 4px;">$1</h3>')
      .replace(/^## (.+)$/gm,'<h2 style="font-size:14px;font-weight:700;color:#1a1a2e;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #f3f4f6;">$1</h2>')
      .replace(/^# (.+)$/gm,'<h2 style="font-size:16px;font-weight:800;color:#1a1a2e;margin:18px 0 8px;">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;">')
      .replace(/^\d+\. (.+)$/gm,'<li style="margin:4px 0;">$1</li>')
      .replace(/^[\*\-] (.+)$/gm,'<li style="margin:4px 0;">$1</li>')
      .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, m => `<ul style="padding-left:18px;margin:8px 0;">${m}</ul>`)
      .replace(/\n\n+/g,'</p><p style="margin:0 0 8px;">')
      .replace(/^/,'<p style="margin:0 0 8px;">').replace(/$/,'</p>');
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Plus Jakarta Sans',Arial,sans-serif; color:#1a1a2e; background:#fff; font-size:13px; line-height:1.6; }
    .page { padding:48px; max-width:900px; margin:0 auto; }
    .cover { min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; padding:64px 48px; border-right:6px solid #4f7cff; }
    .section { margin-bottom:40px; }
    .section-heading { font-size:10px; font-weight:800; letter-spacing:0.14em; color:#4f7cff; text-transform:uppercase; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #4f7cff22; }
    .page-break { page-break-before:always; padding-top:48px; }
    .stat-row { display:flex; gap:16px; margin-bottom:32px; }
    .stat-box { flex:1; padding:16px; border-radius:10px; border:1px solid #e5e7eb; text-align:center; }
    .stat-num { font-size:28px; font-weight:800; }
    .stat-lbl { font-size:10px; font-weight:700; letter-spacing:0.08em; color:#9ca3af; margin-top:2px; }
    .footer { font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; padding-top:16px; border-top:1px solid #e5e7eb; margin-top:48px; }
    .confidential { font-size:9px; font-weight:700; letter-spacing:0.12em; color:#9ca3af; text-align:center; margin-bottom:6px; }
    h2 { font-size:15px; font-weight:700; color:#1a1a2e; margin:16px 0 6px; }
    h3 { font-size:12px; font-weight:700; color:#374151; margin:12px 0 4px; }
    p { margin:0 0 8px; color:#374151; }
    ul,ol { padding-left:18px; margin:6px 0 10px; }
    li { margin:3px 0; }
    strong { font-weight:700; color:#1a1a2e; }
    @media print { 
      @page { margin: 0.5in; }
      .page-break { page-break-before:always; } 
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; margin:0; padding:0; } 
      .page { padding:0; }
      .cover { padding:0; min-height:auto; border-right:none; }
    }
  `;

  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  // Format report date consistently (convert YYYY-MM-DD to readable)
  const assessmentDate = date ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }) : today;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${clientName} — Engagement Package</title>
<style>${css}</style></head>
<body>

<!-- ── COVER PAGE ── -->
<div class="cover">
  <div>
    <div class="confidential">CONFIDENTIAL — PREPARED BY VERITAQ ADVISORY</div>
    <div style="font-size:11px;font-weight:800;letter-spacing:0.15em;color:#4f7cff;margin-bottom:32px;">VERITAQ ADVISORY · AI COMPLIANCE PLATFORM</div>
    <div style="font-size:36px;font-weight:800;color:#0d0f1a;line-height:1.1;margin-bottom:8px;">${clientName}</div>
    <div style="font-size:20px;font-weight:600;color:#374151;margin-bottom:4px;">Cybersecurity Compliance</div>
    <div style="font-size:20px;font-weight:600;color:#374151;margin-bottom:32px;">Engagement Package</div>
    <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">${clientType} · Assessment Date: ${assessmentDate}</div>
    <div style="font-size:13px;color:#6b7280;">Prepared by Veritaq Advisory · veritaq.ai</div>
  </div>

  <div style="display:flex;align-items:center;gap:32px;margin-top:48px;">
    <div style="text-align:center;padding:24px 32px;border-radius:16px;background:${scoreBg};border:1px solid ${scoreColor}30;min-width:140px;">
      <div style="font-size:42px;font-weight:800;color:${scoreColor};line-height:1;">${Math.round(overallScore*100)}%</div>
      <div style="font-size:11px;font-weight:700;color:${scoreColor};letter-spacing:0.1em;margin-top:6px;">${scoreLabel.toUpperCase()}</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:12px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;margin-bottom:8px;">FRAMEWORKS ASSESSED</div>
      ${scopedFW.map(([fw]) => `<div style="display:inline-block;margin:3px 6px 3px 0;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;background:${FW_COLORS[fw]||"#4f7cff"}18;color:${FW_COLORS[fw]||"#4f7cff"};">${fw}</div>`).join("")}
    </div>
  </div>

  <div style="margin-top:48px;">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:0.08em;margin-bottom:12px;">PACKAGE CONTENTS</div>
    ${["Executive Summary & Board Report","Compliance Status by Framework","Compliance Gap Analysis","Remediation Action Plan"].map((item, i) =>
      `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
        <div style="width:22px;height:22px;border-radius:50%;background:#4f7cff;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">${i+1}</div>
        <div style="font-size:13px;font-weight:600;color:#374151;">${item}</div>
      </div>`).join("")}
  </div>

  <div style="font-size:10px;color:#9ca3af;margin-top:auto;padding-top:32px;">
    Generated ${today} · Confidential — For authorized recipients only · Veritaq Advisory · veritaq.ai
  </div>
</div>

<!-- ── PAGE 2: BOARD SUMMARY ── -->
<div class="page page-break">
  <div class="confidential">CONFIDENTIAL — PREPARED FOR BOARD OF DIRECTORS</div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #4f7cff;">
    <div>
      <div style="font-size:10px;font-weight:800;letter-spacing:0.15em;color:#4f7cff;margin-bottom:6px;">SECTION 1 OF 4</div>
      <div style="font-size:22px;font-weight:800;color:#0d0f1a;">Executive Summary</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">${clientName} · ${clientType} · ${assessmentDate}</div>
    </div>
    <div style="text-align:center;padding:14px 20px;border-radius:12px;background:${scoreBg};border:1px solid ${scoreColor}30;">
      <div style="font-size:28px;font-weight:800;color:${scoreColor};line-height:1;">${Math.round(overallScore*100)}%</div>
      <div style="font-size:10px;font-weight:700;color:${scoreColor};letter-spacing:0.08em;margin-top:4px;">${scoreLabel.toUpperCase()}</div>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat-box"><div class="stat-num" style="color:#ef4444;">${highGaps.length}</div><div class="stat-lbl">CRITICAL GAPS</div></div>
    <div class="stat-box"><div class="stat-num" style="color:#f59e0b;">${medGaps.length}</div><div class="stat-lbl">PARTIAL GAPS</div></div>
    <div class="stat-box"><div class="stat-num" style="color:#10b981;">${strengths.length}</div><div class="stat-lbl">CONTROLS PASSING</div></div>
    <div class="stat-box"><div class="stat-num" style="color:#4f7cff;">${scopedFW.length}</div><div class="stat-lbl">FRAMEWORKS ASSESSED</div></div>
  </div>

  <!-- Data-driven traffic light panel — no AI dependency -->
  <div style="margin-bottom:24px;">
    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#4f7cff;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #4f7cff22;">Compliance Status at a Glance</div>
    ${scopedFW.map(([fw, sc]) => {
      const pct = Math.round(sc * 100);
      const icon = sc >= 0.75 ? '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#10b981;vertical-align:middle;"></span>' : sc >= 0.45 ? '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#f59e0b;vertical-align:middle;"></span>' : '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#ef4444;vertical-align:middle;"></span>';
      const label = sc >= 0.75 ? "SATISFACTORY" : sc >= 0.45 ? "NEEDS ATTENTION" : "CRITICAL GAPS";
      const col = sc >= 0.75 ? "#065f46" : sc >= 0.45 ? "#92400e" : "#991b1b";
      const bg  = sc >= 0.75 ? "#d1fae5" : sc >= 0.45 ? "#fef3c7" : "#fee2e2";
      const bar = FW_COLORS[fw] || "#4f7cff";
      return `<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;margin-bottom:8px;background:${bg};border-radius:10px;border:1px solid ${col}20;">
        <div style="font-size:22px;line-height:1;">${icon}</div>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:800;color:${bar};">${fw}</div>
            <div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${col}15;color:${col};">${label} — ${pct}%</div>
          </div>
          <div style="height:6px;background:#e5e7eb;border-radius:3px;">
            <div style="width:${pct}%;height:6px;background:${bar};border-radius:3px;"></div>
          </div>
        </div>
      </div>`;
    }).join("")}
  </div>

  <!-- Top 3 critical items highlighted -->
  ${highGaps.length > 0 ? `
  <div style="margin-bottom:24px;">
    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#ef4444;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #ef444422;">⚠ Immediate Action Required</div>
    ${highGaps.slice(0,3).map(g => `
    <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;margin-bottom:8px;background:#fff5f5;border:1px solid #ef444430;border-radius:8px;">
      <div style="width:20px;height:20px;background:#ef4444;border-radius:50%;flex-shrink:0;margin-top:2px;"></div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">${toActionLabel(g.domain)}</div>
        <div style="font-size:11px;color:#6b7280;">${toAction(g.domain, g.text)}</div>
      </div>
    </div>`).join("")}
  </div>` : ""}

  <div class="section">
    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#4f7cff;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #4f7cff22;">Executive Narrative</div>
    <div style="display:flex;gap:12px;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;font-size:11px;">
      <span><strong style="color:#ef4444;">${gaps.filter(g => g.answer === "no").length}</strong> critical gaps</span>
      <span style="color:#e5e7eb;">|</span>
      <span><strong style="color:#f59e0b;">${gaps.filter(g => g.answer !== "no").length}</strong> partial gaps</span>
      <span style="color:#e5e7eb;">|</span>
      <span><strong style="color:#10b981;">${strengths.length}</strong> controls passing</span>
      <span style="color:#e5e7eb;">|</span>
      <span><strong style="color:#374151;">${gaps.length + strengths.length}</strong> total assessed</span>
    </div>
    <div>${markdownToHtml(boardReportText) || `<p style="color:#9ca3af;font-style:italic;">Generate the Board Report first for a full executive summary. Navigate to the Board Report tab, click Generate, then re-export the package.</p>`}</div>
  </div>
</div>

<!-- ── PAGE 3: FRAMEWORK STATUS + GAP ANALYSIS (merged) ── -->
<div class="page page-break">
  <div style="font-size:10px;font-weight:800;letter-spacing:0.15em;color:#4f7cff;margin-bottom:6px;">SECTION 2 OF 4</div>
  <div style="font-size:22px;font-weight:800;color:#0d0f1a;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #4f7cff;">Compliance Status by Framework</div>

  <div style="margin-bottom:24px;">
    ${scopedFW.map(([fw, sc]) => {
      const pct = Math.round(sc * 100);
      const icon = sc >= 0.75 ? '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#10b981;vertical-align:middle;"></span>' : sc >= 0.45 ? '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#f59e0b;vertical-align:middle;"></span>' : '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#ef4444;vertical-align:middle;"></span>';
      const label = sc >= 0.75 ? "SATISFACTORY" : sc >= 0.45 ? "NEEDS ATTENTION" : "CRITICAL GAPS";
      const col = sc >= 0.75 ? "#065f46" : sc >= 0.45 ? "#92400e" : "#991b1b";
      const bg  = sc >= 0.75 ? "#d1fae5" : sc >= 0.45 ? "#fef3c7" : "#fee2e2";
      const bar = FW_COLORS[fw] || "#4f7cff";
      return `<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;margin-bottom:10px;background:${bg};border-radius:10px;border:1px solid ${col}20;">
        <div style="font-size:24px;line-height:1;">${icon}</div>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:14px;font-weight:800;color:${bar};">${fw}</div>
            <div style="font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;background:${col}15;color:${col};">${label} — ${pct}%</div>
          </div>
          <div style="height:8px;background:#e5e7eb;border-radius:4px;">
            <div style="width:${pct}%;height:8px;background:${bar};border-radius:4px;"></div>
          </div>
        </div>
      </div>`;
    }).join("")}
  </div>

  <div style="font-size:10px;font-weight:800;letter-spacing:0.15em;color:#4f7cff;margin-bottom:6px;margin-top:8px;">SECTION 3 OF 4</div>
  <div style="font-size:22px;font-weight:800;color:#0d0f1a;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #4f7cff;">Compliance Gap Analysis</div>

  ${highGaps.length > 0 ? `
  <div class="section">
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:16px;background:#fee2e2;border-radius:8px;border-left:4px solid #ef4444;">
      <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#ef4444;flex-shrink:0;"></span>
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;color:#991b1b;">CRITICAL GAPS — IMMEDIATE ACTION REQUIRED</div>
        <div style="font-size:11px;color:#b91c1c;">${highGaps.length} control${highGaps.length > 1 ? "s" : ""} not in place · Assign owner and begin remediation within 30 days</div>
      </div>
    </div>
    ${highGaps.map((g,i) => gapBlock(g,i)).join("")}
  </div>` : ""}

  ${medGaps.length > 0 ? `
  <div class="section">
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:16px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
      <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></span>
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;color:#92400e;">PARTIAL GAPS — IN PROGRESS</div>
        <div style="font-size:11px;color:#b45309;">${medGaps.length} control${medGaps.length > 1 ? "s" : ""} partially implemented · Verify completion and collect audit evidence</div>
      </div>
    </div>
    ${medGaps.map((g,i) => gapBlock(g,i)).join("")}
  </div>` : ""}

  ${gaps.length === 0 ? `<div style="text-align:center;padding:32px;color:#065f46;font-weight:700;">✓ No compliance gaps identified</div>` : ""}

  <div class="footer">
    <span>${clientName} · Veritaq Advisory Engagement Package · Confidential</span>
    <span>${today}</span>
  </div>
</div>

<!-- ── SECTION 4: ACTION PLAN ── -->
<div class="page page-break">
  <div style="font-size:10px;font-weight:800;letter-spacing:0.15em;color:#4f7cff;margin-bottom:6px;">SECTION 4 OF 4</div>
  <div style="font-size:22px;font-weight:800;color:#0d0f1a;margin-bottom:24px;padding-bottom:12px;border-bottom:3px solid #4f7cff;">Remediation Action Plan</div>

  <div class="section">
    ${actionPlanText
      ? `<div>${markdownToHtml(actionPlanText)}</div>`
      : `
      <div style="margin-bottom:20px;">
        ${timeframeBanner("immediate")}
        ${highGaps.slice(0,3).map(g => actionBlock(g, "immediate")).join("")}
        ${highGaps.length === 0 ? "<p style='color:#9ca3af;'>No critical gaps identified.</p>" : ""}
      </div>
      <div style="margin-bottom:20px;">
        ${timeframeBanner("short")}
        ${highGaps.slice(3).concat(medGaps.slice(0,3)).map(g => actionBlock(g, "short")).join("")}
        ${highGaps.slice(3).length + medGaps.slice(0,3).length === 0 ? "<p style='color:#9ca3af;'>No items in this timeframe.</p>" : ""}
      </div>
      <div>
        ${timeframeBanner("ongoing")}
        ${medGaps.slice(3).map(g => actionBlock(g, "ongoing")).join("") || "<p style='color:#9ca3af;'>No additional items.</p>"}
      </div>`
    }
  </div>

  <div style="margin-top:32px;padding:16px 20px;background:#f0f4ff;border-radius:10px;border:1px solid #4f7cff22;">
    <div style="font-size:11px;font-weight:700;color:#4f7cff;letter-spacing:0.08em;margin-bottom:6px;">NEXT STEPS</div>
    <div style="font-size:12px;color:#374151;line-height:1.7;">
      Review this action plan with your leadership team and assign owners to each item. Schedule a 30-day follow-up with Veritaq Advisory to assess remediation progress and update your compliance posture. Contact <strong>rich@veritaqadvisory.com</strong> to schedule your follow-up engagement.
    </div>
  </div>

  <div class="footer" style="margin-top:32px;">
    <span>${clientName} · Veritaq Advisory Engagement Package · Confidential</span>
    <span>${today}</span>
  </div>
</div>

</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups for app.veritaq.ai to export PDFs."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

function exportGapReportPDF(report) {
  const { clientName, clientType, date, overallScore, frameworkScores, gaps, strengths } = report;
  const statusLabel = overallScore >= 0.75 ? "Satisfactory" : overallScore >= 0.45 ? "Needs Attention" : "Critical Gaps";
  const pillClass = overallScore >= 0.75 ? "pill-green" : overallScore >= 0.45 ? "pill-yellow" : "pill-red";

  const fwRows = Object.entries(frameworkScores).map(([fw, sc]) => {
    const color = sc >= 0.75 ? "#10b981" : sc >= 0.45 ? "#f59e0b" : "#ef4444";
    const pct = Math.round(sc * 100);
    return `<div class="score-row">
      <div class="score-label">${fw}</div>
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="score-pct" style="color:${color}">${pct}%</div>
    </div>`;
  }).join("");

  const gapItems = gaps.map(g =>
    `<div class="gap-item">
      <div class="gap-domain">${g.domain}</div>
      <div class="gap-text">${g.text}</div>
      <div class="gap-fw">${g.frameworks.join(" · ")}</div>
    </div>`
  ).join("");

  exportPDF(
    `${clientName} — Compliance Gap Report`,
    `${clientType} · Assessment Date: ${date} · Overall Score: ${Math.round(overallScore*100)}%`,
    [
      { heading: "Overall Status", content: `<span class="${pillClass}">${statusLabel}</span> &nbsp; Overall Score: <strong>${Math.round(overallScore*100)}%</strong> &nbsp; Gaps: <strong>${gaps.length}</strong> &nbsp; Controls Passing: <strong>${strengths.length}</strong>` },
      { heading: "Framework Scores", content: fwRows },
      { heading: `Compliance Gaps (${gaps.length})`, content: gapItems || "No gaps identified." },
    ]
  );
}

function markdownToHTML(text) {
  // Strip AI search narration
  const narrationStripped = text.split("\n").filter(line => {
    const l = line.trim().toLowerCase();
    return !(l.startsWith("now let me") || l.startsWith("let me search") ||
      l.startsWith("i need to fetch") || l.startsWith("based on my search") ||
      l.startsWith("based on the regulatory") || l.startsWith("based on the research") ||
      l.startsWith("i'll now prepare") || l.startsWith("now i'll compile") ||
      l.startsWith("now i will compile") || l.startsWith("i can now provide") ||
      (l.includes("search") && l.includes("regulat") && l.length < 120));
  }).join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");

  // Pre-process: join mid-paragraph single newlines into spaces
  // Only collapse lines that are NOT block elements (bullets, headings, hr, blank)
  const lines = narrationStripped.split("\n");
  const joined = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isBlock = trimmed === "" || trimmed.startsWith("-") || trimmed.startsWith("#") ||
      trimmed === "---" || /^\d+\./.test(trimmed);
    if (!isBlock && joined.length > 0 && !joined[joined.length-1].endsWith("\n") &&
        joined[joined.length-1].trim() !== "" && !joined[joined.length-1].trim().startsWith("-") &&
        !joined[joined.length-1].trim().startsWith("#")) {
      joined[joined.length-1] += " " + trimmed;
    } else {
      joined.push(line);
    }
  }
  const clean = joined.join("\n");

  return clean
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #ccc;margin:12px 0"/>')
    .replace(/❌/g, '<span style="color:#DC2626">&#10060;</span>').replace(/⚠️|\u26a0\ufe0f/g, '<span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #D97706;margin:0 4px 1px 0;vertical-align:middle"></span>').replace(/✅/g, '<span style="color:#059669">&#10003;</span>')
    .replace(/\*\*(🔴[^*]+)\*\*/g, "<strong style=\"color:#DC2626\">$1</strong>")
    .replace(/\*\*(🟡[^*]+)\*\*/g, "<strong style=\"color:#D97706\">$1</strong>")
    .replace(/\*\*(🟢[^*]+)\*\*/g, "<strong style=\"color:#059669\">$1</strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li><strong>$1.</strong> $2</li>")
    .replace(/(<li>.*?<\/li>\n?)+/gs, m => `<ul style="margin:6px 0 12px;padding-left:20px">${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "\n")
    .replace(/^/, "<p>").replace(/$/, "</p>");
}

function exportBoardReportPDF(clientName, clientType, date, boardReportText, report) {
  const overallScore = report?.overallScore ?? null;
  const frameworkScores = report?.frameworkScores ?? {};
  const gaps = report?.gaps ?? [];
  const strengths = report?.strengths ?? [];

  // Safety filter: only include frameworks with a non-zero score
  const scopedFrameworks = Object.entries(frameworkScores).filter(([, sc]) => sc > 0);

  const scoreColor = overallScore >= 0.75 ? "#065f46" : overallScore >= 0.45 ? "#92400e" : "#991b1b";
  const scoreBg    = overallScore >= 0.75 ? "#d1fae5" : overallScore >= 0.45 ? "#fef3c7" : "#fee2e2";
  const scoreLabel = overallScore >= 0.75 ? "Satisfactory" : overallScore >= 0.45 ? "Needs Attention" : "Critical Gaps";

  const fwRows = scopedFrameworks.map(([fw, sc]) => {
    const pct = Math.round(sc * 100);
    const dotColor = sc >= 0.75 ? "#10b981" : sc >= 0.45 ? "#f59e0b" : "#ef4444";
    const col      = sc >= 0.75 ? "#065f46" : sc >= 0.45 ? "#92400e" : "#991b1b";
    const bg       = sc >= 0.75 ? "#d1fae5" : sc >= 0.45 ? "#fef3c7" : "#fee2e2";
    const lbl      = sc >= 0.75 ? "Satisfactory" : sc >= 0.45 ? "Needs Attention" : "Critical Gaps";
    const FW_COLORS_PDF = {"NY DFS 500":"#3b82f6","FFIEC":"#10b981","GLBA":"#f59e0b","SOC 2":"#8b5cf6","NCUA":"#ec4899","PCI DSS":"#e85d04"};
    const barColor = FW_COLORS_PDF[fw] || "#4f7cff";
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;margin-bottom:8px;background:${bg};border-radius:10px;border:1px solid ${dotColor}40;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
        <div style="font-size:13px;font-weight:800;color:${barColor};min-width:100px;">${fw}</div>
        <div style="flex:1;height:8px;background:#ffffff80;border-radius:4px;">
          <div style="width:${pct}%;height:8px;background:${barColor};border-radius:4px;"></div>
        </div>
        <div style="font-size:13px;font-weight:800;color:${col};min-width:36px;text-align:right;">${pct}%</div>
        <div style="font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;background:${col}18;color:${col};white-space:nowrap;">${lbl}</div>
      </div>`;
  }).join("");

  const seenExec = new Set();
  const highGaps = gaps.filter(g => g.answer === "no").filter(g => {
    const key = `${toActionLabel(g.domain)}||${toAction(g.domain, g.text)}`;
    if (seenExec.has(key)) return false;
    seenExec.add(key);
    return true;
  }).slice(0, 5);
  const gapRows = highGaps.length === 0
    ? `<p style="color:#065f46;font-weight:600;">No critical gaps identified.</p>`
    : highGaps.map(g => {
      const inScopeFW = (g.frameworks||[]).filter(f => frameworkScores[f] !== undefined);
      const FW_COLORS_PDF = {"NY DFS 500":"#3b82f6","FFIEC":"#10b981","GLBA":"#f59e0b","SOC 2":"#8b5cf6","NCUA":"#ec4899","PCI DSS":"#e85d04"};
      return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;margin-bottom:8px;background:#fff5f5;border:1px solid #ef444430;border-radius:8px;">
        <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:2px;"></span>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;background:#ef444422;color:#ef4444;">HIGH</span>
            <span style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.05em;">${g.domain.toUpperCase()}</span>
            ${inScopeFW.map(f => `<span style="font-size:10px;font-weight:700;color:${FW_COLORS_PDF[f]||"#4f7cff"};">${f}</span>`).join(" · ")}
          </div>
          <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">${toActionLabel(g.domain)}</div>
          <div style="font-size:11px;color:#6b7280;">${toAction(g.domain, g.text)}</div>
        </div>
      </div>`;
    }).join("");


  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${clientName} — Board of Directors Summary</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 48px; font-size: 13px; line-height: 1.6; }
  .header { border-bottom: 3px solid #4f7cff; padding-bottom: 20px; margin-bottom: 28px; display:flex; justify-content:space-between; align-items:flex-start; }
  .logo { font-size: 10px; font-weight: 800; letter-spacing: 0.15em; color: #4f7cff; margin-bottom: 6px; }
  h1 { font-size: 24px; font-weight: 800; color: #0d0f1a; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #6b7280; }
  .score-badge { text-align:center; padding: 16px 24px; border-radius: 12px; background:${scoreBg}; border: 1px solid ${scoreColor}30; min-width:120px; }
  .score-num { font-size: 36px; font-weight: 800; color: ${scoreColor}; line-height:1; }
  .score-lbl { font-size: 10px; font-weight: 700; color: ${scoreColor}; letter-spacing:0.08em; margin-top:4px; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section-heading { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; color: #4f7cff; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  .stats-row { display:flex; gap:16px; margin-bottom:24px; }
  .stat-box { flex:1; padding:14px 18px; border-radius:10px; border:1px solid #e5e7eb; text-align:center; }
  .stat-num { font-size:28px; font-weight:800; }
  .stat-lbl { font-size:10px; font-weight:700; letter-spacing:0.08em; color:#9ca3af; margin-top:2px; }
  .narrative { font-size:13px; color:#374151; line-height:1.8; }
  .narrative p { margin:0 0 10px; }
  .narrative h2 { font-size:14px; font-weight:700; color:#1a1a2e; margin:20px 0 6px; padding-bottom:4px; border-bottom:1px solid #f3f4f6; }
  .narrative h3 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; margin:14px 0 4px; }
  .narrative ul { padding-left:18px; margin:8px 0; }
  .narrative li { margin:4px 0; }
  .narrative strong { font-weight:700; color:#1a1a2e; }
  .narrative hr { border:none; border-top:1px solid #e5e7eb; margin:16px 0; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  .confidential { font-size:9px; font-weight:700; letter-spacing:0.1em; color:#9ca3af; text-align:center; margin-bottom:8px; }
  @media print { @page { margin: 0.5in; } body { padding: 0; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<div class="confidential">CONFIDENTIAL — PREPARED FOR BOARD OF DIRECTORS</div>
<div class="header">
  <div>
    <div class="logo">VERITAQ ADVISORY · AI COMPLIANCE PLATFORM</div>
    <h1>${clientName}</h1>
    <h1 style="font-size:17px;font-weight:600;color:#374151;margin-top:2px;">Board of Directors Cybersecurity Summary</h1>
    <div class="subtitle">${clientType} · Assessment Date: ${date} · Prepared by Veritaq Advisory</div>
  </div>
  <div class="score-badge">
    <div class="score-num">${overallScore !== null ? Math.round(overallScore * 100) + "%" : "—"}</div>
    <div class="score-lbl">${scoreLabel.toUpperCase()}</div>
  </div>
</div>

<div class="stats-row">
  <div class="stat-box">
    <div class="stat-num" style="color:#ef4444;">${gaps.filter(g => g.answer === "no").length}</div>
    <div class="stat-lbl">CRITICAL GAPS</div>
  </div>
  <div class="stat-box">
    <div class="stat-num" style="color:#f59e0b;">${gaps.filter(g => g.answer !== "no").length}</div>
    <div class="stat-lbl">PARTIAL GAPS</div>
  </div>
  <div class="stat-box">
    <div class="stat-num" style="color:#10b981;">${strengths.length}</div>
    <div class="stat-lbl">CONTROLS PASSING</div>
  </div>
  <div class="stat-box">
    <div class="stat-num" style="color:#4f7cff;">${scopedFrameworks.length}</div>
    <div class="stat-lbl">FRAMEWORKS ASSESSED</div>
  </div>
</div>

<div class="section">
  <div class="section-heading">Compliance Status by Framework</div>
  ${fwRows || "<p style='color:#9ca3af;'>No framework scores available.</p>"}
</div>

<div class="section">
  <div class="section-heading">Top Priority Gaps</div>
  ${gapRows}
</div>

<div class="section">
  <div class="section-heading">Executive Summary &amp; Board Actions</div>
  <div style="display:flex;gap:12px;margin-bottom:14px;padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;font-size:11px;">
    <span><strong style="color:#ef4444;">${gaps.filter(g => g.answer === "no").length}</strong> critical gaps</span>
    <span style="color:#e5e7eb;">|</span>
    <span><strong style="color:#f59e0b;">${gaps.filter(g => g.answer !== "no").length}</strong> partial gaps</span>
    <span style="color:#e5e7eb;">|</span>
    <span><strong style="color:#10b981;">${strengths.length}</strong> controls passing</span>
    <span style="color:#e5e7eb;">|</span>
    <span><strong style="color:#374151;">${gaps.length + strengths.length}</strong> total assessed</span>
  </div>
  <div class="narrative">${markdownToHtml(boardReportText)}</div>
</div>

<div class="footer">
  <span>Confidential — For Board Use Only · Veritaq Advisory · veritaq.ai</span>
  <span>${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</span>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups for app.veritaq.ai to export PDFs."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}
function exportPolicyReviewPDF(institutionName, institutionType, frameworks, results) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const highGaps  = (results.gaps || []).filter(g => g.severity === "HIGH");
  const medGaps   = (results.gaps || []).filter(g => g.severity === "MEDIUM");
  const lowGaps   = (results.gaps || []).filter(g => g.severity === "LOW");
  const present   = results.present || [];
  const recs      = results.recommendations || [];

  const ratingColor = results.overallRating === "Strong" ? "#065f46"
    : results.overallRating === "Adequate" ? "#92400e"
    : "#991b1b";
  const ratingBg = results.overallRating === "Strong" ? "#d1fae5"
    : results.overallRating === "Adequate" ? "#fef3c7"
    : "#fee2e2";

  const summaryHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
      <div style="font-size:36px;font-weight:800;color:${ratingColor}">${results.coverageScore || 0}%</div>
      <div>
        <div style="font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:0.1em;margin-bottom:4px">COVERAGE SCORE</div>
        <span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:12px;font-weight:700;background:${ratingBg};color:${ratingColor}">${results.overallRating || "N/A"}</span>
      </div>
    </div>
    <p>${results.summary || ""}</p>
    <div style="display:flex;gap:24px;margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <div><span style="font-size:20px;font-weight:800;color:#ef4444">${highGaps.length}</span> <span style="font-size:11px;color:#6b7280;font-weight:700;">HIGH</span></div>
      <div><span style="font-size:20px;font-weight:800;color:#f59e0b">${medGaps.length}</span> <span style="font-size:11px;color:#6b7280;font-weight:700;">MEDIUM</span></div>
      <div><span style="font-size:20px;font-weight:800;color:#9ca3af">${lowGaps.length}</span> <span style="font-size:11px;color:#6b7280;font-weight:700;">LOW</span></div>
      <div><span style="font-size:20px;font-weight:800;color:#10b981">${present.length}</span> <span style="font-size:11px;color:#6b7280;font-weight:700;">PRESENT</span></div>
    </div>`;

  const gapHTML = (results.gaps || []).length === 0
    ? "<p style='color:#065f46;font-weight:600;'>No gaps identified.</p>"
    : (results.gaps || []).map(g => {
        const sc = g.severity === "HIGH" ? "#ef4444" : g.severity === "MEDIUM" ? "#f59e0b" : "#9ca3af";
        const sb = g.severity === "HIGH" ? "#fee2e2" : g.severity === "MEDIUM" ? "#fef3c7" : "#f9fafb";
        return `<div style="border-left:3px solid ${sc};background:${sb};border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:10px;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${sc}22;color:${sc}">${g.severity}</span>
            <span style="font-size:10px;font-weight:700;color:#4f7cff;">${g.framework}</span>
            <span style="font-size:10px;color:#9ca3af;font-family:monospace;">${g.citation}</span>
          </div>
          <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:4px;">${g.requirement}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:8px;line-height:1.6;">${g.finding}</div>
          <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:4px;padding:8px 12px;">
            <div style="font-size:9px;font-weight:700;color:#ef4444;letter-spacing:0.1em;margin-bottom:3px;">EXAMINER FINDING</div>
            <div style="font-size:12px;color:#6b7280;font-style:italic;">"${g.examinerNote}"</div>
          </div>
        </div>`;
      }).join("");

  const presentHTML = present.length === 0
    ? "<p style='color:#6b7280;'>No compliant elements recorded.</p>"
    : present.map(p => `
        <div style="border-left:3px solid #10b981;background:#f0fdf4;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:8px;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
            <span style="color:#10b981;font-weight:700;">✓</span>
            <span style="font-size:10px;font-weight:700;color:#4f7cff;">${p.framework}</span>
            <span style="font-size:10px;color:#9ca3af;font-family:monospace;">${p.citation}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:2px;">${p.element}</div>
          <div style="font-size:11px;color:#9ca3af;font-family:monospace;">Found in: ${p.location}</div>
        </div>`).join("");

  const recsHTML = recs.length === 0
    ? "<p style='color:#6b7280;'>No recommendations generated.</p>"
    : recs.map(r => {
        const pc = r.priority === "Immediate" ? "#ef4444" : r.priority === "30 Days" ? "#f59e0b" : "#10b981";
        return `<div style="display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <div style="background:${pc}18;border:1px solid ${pc}30;border-radius:6px;padding:5px 10px;flex-shrink:0;min-width:80px;text-align:center;">
            <div style="font-size:9px;font-weight:700;color:${pc};letter-spacing:0.08em;">${r.priority.toUpperCase()}</div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:4px;">${r.action}</div>
            <div style="font-size:12px;color:#6b7280;line-height:1.6;">${r.rationale}</div>
          </div>
        </div>`;
      }).join("");

  const sections = [
    { heading: "Executive Summary", content: summaryHTML },
    { heading: `Compliance Gaps (${(results.gaps||[]).length} identified)`, content: gapHTML },
    { heading: `Compliant Elements (${present.length} confirmed)`, content: presentHTML },
    { heading: "Action Plan", content: recsHTML },
  ];

  exportPDF(
    `${institutionName || "Institution"} — Policy Review Report`,
    `${institutionType || ""} · Frameworks: ${frameworks.join(", ")} · ${date} · Prepared by Veritaq`,
    sections
  );
}

// ─── UTILITY COMPONENTS ───────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text}; }
  ::-webkit-scrollbar { width: 4px; } 
  ::-webkit-scrollbar-track { background: ${T.surface}; }
  ::-webkit-scrollbar-thumb { background: ${T.border2}; border-radius: 2px; }
  .fade-in { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  input, textarea, select { font-family: inherit; }
  button { font-family: inherit; }
  textarea:focus { border-color: ${T.accent} !important; }
`;

function Tag({ fw, small }) {
  const c = FW_COLOR[fw] || T.accent;
  return (
    <span style={{ display:"inline-block", padding: small ? "1px 6px":"3px 9px", borderRadius:4,
      fontSize: small ? 9:10, fontWeight:600, letterSpacing:"0.06em",
      color:c, border:`1px solid ${c}30`, background:`${c}12`,
      fontFamily:"'IBM Plex Mono', monospace", whiteSpace:"nowrap" }}>
      {fw}
    </span>
  );
}

function Pill({ label, color = T.accent, bg }) {
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:20,
      fontSize:11, fontWeight:700, letterSpacing:"0.06em",
      color:color, background: bg || `${color}18`, border:`1px solid ${color}30`,
      fontFamily:"'IBM Plex Mono', monospace" }}>
      {label}
    </span>
  );
}

function ScoreBar({ score, width = 120 }) {
  const color = score >= 0.75 ? T.green : score >= 0.45 ? T.yellow : T.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ width, height:4, background:T.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${score*100}%`, height:"100%", background:color, borderRadius:2, transition:"width 1s ease" }} />
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, fontFamily:"'IBM Plex Mono', monospace" }}>
        {Math.round(score*100)}%
      </span>
    </div>
  );
}

function Ring({ score, size=80, label }) {
  const r = size/2 - 7;
  const circ = 2 * Math.PI * r;
  const color = score >= 0.75 ? T.green : score >= 0.45 ? T.yellow : T.red;
  return (
    <div style={{ textAlign:"center" }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${circ*score} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:"stroke-dasharray 1.2s ease" }} />
        <text x={size/2} y={size/2+4} textAnchor="middle" fill={color}
          fontSize={size > 70 ? 14:11} fontWeight="700" fontFamily="'IBM Plex Mono', monospace">
          {Math.round(score*100)}%
        </text>
      </svg>
      {label && <div style={{ fontSize:10, color:T.textDim, marginTop:2, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.06em" }}>{label}</div>}
    </div>
  );
}

function Card({ children, style={} }) {
  return (
    <div style={{ background:T.surface2, border:`1px solid ${T.border}`,
      borderRadius:14, padding:"28px 32px", ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant="primary", style={}, disabled=false }) {
  const variants = {
    primary:  { background:T.accent, color:"#fff", border:"none" },
    ghost:    { background:"transparent", color:T.textMid, border:`1px solid ${T.border2}` },
    danger:   { background:`${T.red}18`, color:T.red, border:`1px solid ${T.red}30` },
    success:  { background:`${T.green}18`, color:T.green, border:`1px solid ${T.green}30` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"10px 22px", borderRadius:8, fontSize:13, fontWeight:700,
      cursor: disabled ? "not-allowed":"pointer", letterSpacing:"0.03em",
      transition:"all 0.15s", opacity: disabled ? 0.4:1,
      fontFamily:"'Plus Jakarta Sans', sans-serif",
      ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Mono({ children, style={} }) {
  return <span style={{ fontFamily:"'IBM Plex Mono', monospace", ...style }}>{children}</span>;
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.14em", color:T.textDim,
      textTransform:"uppercase", fontFamily:"'IBM Plex Mono', monospace", marginBottom:14 }}>
      {children}
    </div>
  );
}

function AIBox({ text, loading }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderLeft:`3px solid ${T.accent}`, borderRadius:8, padding:"13px 16px",
      fontSize:13, color:T.textMid, lineHeight:1.65, minHeight: 52,
      display:"flex", alignItems: loading && !text ? "center" : "flex-start", gap: 8 }}>
      {loading && !text ? (
        <>
          <div style={{ width:14, height:14, border:`2px solid ${T.accent}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0, marginTop:1 }} />
          <span style={{ color:T.textDim, fontSize:13 }}>Analyzing across frameworks...</span>
        </>
      ) : (
        <>
          <span style={{ color:T.accent, fontWeight:700, fontSize:10,
            fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em", marginRight:6, flexShrink:0, marginTop:2 }}>
            AI ▸
          </span>
          <span>{text}</span>
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function VeritaqPlatform() {
  const [view, setView] = useState("dashboard");
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState(MOCK_CLIENTS);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [assessmentState, setAssessmentState] = useState(null);
  const [savedReports, setSavedReports] = useStoredState("veritaq_reports", []);
  const [activeReport, setActiveReport] = useState(null);
  const [kbQuery, setKbQuery] = useState("");
  const [kbAnswer, setKbAnswer] = useState("");
  const [kbLoading, setKbLoading] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [generatedPolicy, setGeneratedPolicy] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);

  const openAlerts = alerts.filter(a => a.status === "open");

  function useStoredState(key, def) {
    const [val, setVal] = useState(() => {
      try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : def;
      } catch { return def; }
    });
    const set = useCallback(v => {
      setVal(v);
      try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
    }, [key]);
    return [val, set];
  }

  function startAssessment(client) {
    setSelectedClient(client);
    setAssessmentState({ step:"framework-select", currentQ:0, answers:{}, followUp:{}, animIn:true, selectedFrameworks: null, filteredQuestions: null, saqType: null });
    setView("assessment");
  }

  function saveReport(report) {
    setSavedReports(prev => [report, ...prev.filter(r => r.clientId !== report.clientId)]);
    setClients(prev => prev.map(c =>
      c.id === report.clientId
        ? { ...c, score: report.overallScore, lastAssessment: new Date().toISOString().split("T")[0] }
        : c
    ));
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text,
      fontFamily:"'Plus Jakarta Sans', sans-serif", display:"flex" }}>
      <style>{css}</style>

      {/* ── SIDEBAR ── */}
      <Sidebar view={view} setView={setView} openAlerts={openAlerts.length} />

      {/* ── MAIN ── */}
      <div style={{ flex:1, overflowY:"auto", minHeight:"100vh" }}>
        {view === "dashboard" && (
          <Dashboard clients={clients} alerts={openAlerts} savedReports={savedReports}
            onStartAssessment={startAssessment} onViewReport={r => { setActiveReport(r); setView("report"); }}
            onDismissAlert={id => setAlerts(a => a.map(x => x.id===id ? {...x,status:"dismissed"}:x))} />
        )}
        {view === "assessment" && assessmentState && (
          <AssessmentView client={selectedClient} state={assessmentState} questions={QUESTIONS}
            setState={setAssessmentState}
            onComplete={report => { saveReport(report); setActiveReport(report); setView("report"); }} />
        )}
        {view === "assessment" && !assessmentState && (
          <div className="fade-in" style={{ padding:"40px 48px", maxWidth:900 }}>
            <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>New Assessment</div>
            <div style={{ color:T.textDim, fontSize:14, marginBottom:32 }}>Select a client to assess, or run a quick assessment without a client on file.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
              {clients.map(c => (
                <div key={c.id} onClick={() => startAssessment(c)} style={{
                  background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
                  padding:"18px 24px", cursor:"pointer", display:"flex", alignItems:"center",
                  gap:16, transition:"border-color 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor=T.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor=T.border}>
                  <div style={{ width:40, height:40, borderRadius:10, background:`${T.accent}18`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:16, fontWeight:800, color:T.accent, flexShrink:0 }}>{c.name[0]}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{c.name}</div>
                    <div style={{ fontSize:12, color:T.textDim }}>{c.type} · {c.lastAssessment ? `Last assessed ${c.lastAssessment}` : "Not yet assessed"}</div>
                  </div>
                  <div style={{ fontSize:12, color:T.accent, fontFamily:"'IBM Plex Mono', monospace" }}>Assess →</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:24 }}>
              <div style={{ fontSize:13, color:T.textDim, marginBottom:12 }}>Or run without a client profile:</div>
              <button onClick={() => startAssessment(null)} style={{
                background:"none", border:`1px dashed ${T.border}`, borderRadius:10,
                padding:"14px 24px", cursor:"pointer", color:T.textDim, fontSize:13,
                width:"100%", textAlign:"left", transition:"all 0.15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=T.accent; e.currentTarget.style.color=T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.textDim; }}>
                + Quick Assessment (no client selected)
              </button>
            </div>
          </div>
        )}
        {view === "report" && activeReport && (
          <ReportView report={activeReport}
            onGeneratePolicy={(r,cb) => generatePolicy(r, setPolicyLoading, setGeneratedPolicy, cb)}
            policyLoading={policyLoading} generatedPolicy={generatedPolicy}
            onBack={() => setView("dashboard")} />
        )}
        {view === "knowledge" && (
          <KnowledgeView query={kbQuery} setQuery={setKbQuery}
            answer={kbAnswer} loading={kbLoading}
            onSearch={q => searchKnowledge(q, setKbLoading, setKbAnswer)} />
        )}
        {view === "monitoring" && (
          <MonitoringView alerts={alerts} clients={clients}
            loading={monitorLoading}
            onDismiss={id => setAlerts(a => a.map(x => x.id===id?{...x,status:"dismissed"}:x))}
            onTriage={(alert, cb) => triageAlert(alert, clients, setMonitorLoading, cb)} />
        )}
        {view === "clients" && (
          <ClientsView clients={clients} savedReports={savedReports}
            onStartAssessment={startAssessment}
            onViewReport={r => { setActiveReport(r); setView("report"); }} />
        )}
        {view === "examiner" && !selectedClient && (
          <ClientPicker clients={clients} selectedClient={selectedClient}
            onSelect={c => setSelectedClient(c)}
            title="Exam Simulator" subtitle="Select a client to begin their examination simulation."
            actionLabel="Simulate Exam" />
        )}
        {view === "examiner" && selectedClient && (
          <ExaminerView client={selectedClient} report={activeReport}
            onChangeClient={() => setSelectedClient(null)} />
        )}
        {view === "cyberins" && !selectedClient && (
          <ClientPicker clients={clients} selectedClient={selectedClient}
            onSelect={c => setSelectedClient(c)}
            title="Cyber Insurance Readiness" subtitle="Select a client to assess their insurance readiness posture."
            actionLabel="Assess" />
        )}
        {view === "cyberins" && selectedClient && (
          <CyberInsuranceView client={selectedClient} report={activeReport}
            onChangeClient={() => setSelectedClient(null)} />
        )}
        {view === "policyreview" && (
          <PolicyReviewView />
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
// ─── CLIENT PICKER ────────────────────────────────────────────────────────────
function ClientPicker({ clients, selectedClient, onSelect, title, subtitle, actionLabel }) {
  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:900 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: T.textDim }}>{subtitle}</div>
      </div>

      {/* Currently selected banner */}
      {selectedClient && (
        <div style={{ background:`${T.accent}12`, border:`1px solid ${T.accent}40`, borderRadius:10,
          padding:"14px 20px", marginBottom:24, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:T.accent, flexShrink:0 }} />
          <div style={{ fontSize:13, color:T.textMid }}>
            Currently selected: <span style={{ fontWeight:700, color:T.text }}>{selectedClient.name}</span>
            <span style={{ color:T.textDim }}> · {selectedClient.type}</span>
          </div>
          <button onClick={() => onSelect(selectedClient)} style={{
            marginLeft:"auto", background:T.accent, border:"none", borderRadius:6,
            padding:"6px 16px", color:"#fff", fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif"
          }}>Continue with {selectedClient.name.split(" ")[0]} →</button>
        </div>
      )}

      <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace",
        letterSpacing:"0.1em", marginBottom:14 }}>SELECT CLIENT</div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {clients.map(c => {
          const isSelected = selectedClient?.id === c.id;
          const sc = c.score;
          const statusColor = sc == null ? T.textDim : sc >= 0.75 ? T.green : sc >= 0.45 ? T.yellow : T.red;
          return (
            <div key={c.id} onClick={() => onSelect(c)} style={{
              background: isSelected ? `${T.accent}10` : T.surface,
              border:`1px solid ${isSelected ? T.accent : T.border}`,
              borderRadius:12, padding:"16px 20px", cursor:"pointer",
              display:"flex", alignItems:"center", gap:16, transition:"all 0.15s"
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = T.border2; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = T.border; }}>
              <div style={{ width:44, height:44, borderRadius:10, background:`${T.accent}18`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, fontWeight:800, color:T.accent, flexShrink:0 }}>{c.name[0]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:3 }}>{c.name}</div>
                <div style={{ fontSize:12, color:T.textDim }}>{c.type} · {c.employees} employees</div>
              </div>
              {sc != null ? (
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:800, color:statusColor }}>{Math.round(sc*100)}%</div>
                  <div style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace" }}>COMPLIANCE</div>
                </div>
              ) : (
                <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace" }}>NOT ASSESSED</div>
              )}
              {c.lastAssessment && (
                <div style={{ fontSize:11, color:T.textDim, textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"'IBM Plex Mono', monospace" }}>Last assessed</div>
                  <div style={{ color:T.textMid, fontWeight:600 }}>{c.lastAssessment}</div>
                </div>
              )}
              <div style={{ fontSize:13, color: isSelected ? T.accent : T.textDim,
                fontWeight:700, flexShrink:0 }}>{actionLabel} →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sidebar({ view, setView, openAlerts }) {
  const items = [
    { id:"dashboard",  icon:"⬡", label:"Dashboard" },
    { id:"clients",    icon:"◈", label:"Clients" },
    { id:"assessment", icon:"◎", label:"Assessment" },
    { id:"cyberins",   icon:"🛡", label:"Cyber Insurance" },
    { id:"monitoring", icon:"◉", label:"Monitoring", badge: openAlerts },
    { id:"examiner",   icon:"⊕", label:"Exam Simulator" },
    { id:"knowledge",  icon:"◇", label:"Knowledge" },
    { id:"policyreview", icon:"⟁", label:"Policy Suite" },
  ];
  return (
    <div style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`,
      padding:"28px 0", display:"flex", flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh" }}>
      <div style={{ padding:"0 24px 32px" }}>
        <div style={{ fontSize:13, fontWeight:800, letterSpacing:"0.04em", color:T.text }}>Veritaq</div>
        <div style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em", marginTop:3 }}>AI COMPLIANCE PLATFORM</div>
      </div>
      {items.map(item => (
        <button key={item.id} onClick={() => setView(item.id)} style={{
          display:"flex", alignItems:"center", gap:12, padding:"11px 24px",
          background: view===item.id ? `${T.accent}15`:"transparent",
          borderLeft: view===item.id ? `2px solid ${T.accent}`:"2px solid transparent",
          border:"none", borderTop:"none", borderRight:"none", borderBottom:"none",
          borderLeftWidth:2, borderLeftStyle:"solid",
          borderLeftColor: view===item.id ? T.accent:"transparent",
          color: view===item.id ? T.text : T.textDim,
          fontSize:13, fontWeight: view===item.id ? 600:400,
          cursor:"pointer", width:"100%", textAlign:"left",
          transition:"all 0.15s", position:"relative",
        }}>
          <span style={{ fontSize:14 }}>{item.icon}</span>
          {item.label}
          {item.badge > 0 && (
            <span style={{ marginLeft:"auto", background:T.red, color:"#fff",
              fontSize:10, fontWeight:700, borderRadius:10, padding:"1px 6px",
              fontFamily:"'IBM Plex Mono', monospace" }}>
              {item.badge}
            </span>
          )}
        </button>
      ))}
      <div style={{ marginTop:"auto", padding:"24px", borderTop:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11, color:T.textDim, lineHeight:1.5 }}>
          <div style={{ fontWeight:600, color:T.textMid, marginBottom:4 }}>SOC 2 Type 2</div>
          <div style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:10 }}>ATTESTED · ACTIVE</div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ clients, alerts, savedReports, onStartAssessment, onViewReport, onDismissAlert }) {
  const avgScore = clients.filter(c => c.score).reduce((a,c) => a+c.score, 0) / clients.filter(c=>c.score).length;
  const assessed = clients.filter(c => c.score).length;

  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:1100 }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>
          Compliance Operations
        </div>
        <div style={{ color:T.textDim, fontSize:14 }}>
          {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:32 }}>
        {[
          { label:"Active Clients", value:clients.length, sub:"under management", color:T.accent },
          { label:"Avg Compliance", value:`${Math.round(avgScore*100)}%`, sub:`${assessed} assessed`, color: avgScore>=0.7?T.green:T.yellow },
          { label:"Open Alerts", value:alerts.length, sub:"need attention", color: alerts.length>3?T.red:T.yellow },
          { label:"Frameworks", value:6, sub:"actively mapped", color:T.purple },
        ].map(k => (
          <Card key={k.label} style={{ padding:"22px 24px" }}>
            <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em", marginBottom:10 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize:32, fontWeight:800, color:k.color, letterSpacing:"-0.02em", marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:12, color:T.textDim }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:24 }}>
        {/* Clients */}
        <Card>
          <SectionLabel>Client Roster</SectionLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {clients.map(c => {
              const report = savedReports.find(r => r.clientId === c.id);
              return (
                <div key={c.id} style={{ display:"flex", alignItems:"center", gap:16,
                  padding:"14px 16px", background:T.surface, borderRadius:10,
                  border:`1px solid ${T.border}` }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:`${T.accent}18`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14, fontWeight:800, color:T.accent, flexShrink:0 }}>
                    {c.name[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</div>
                    <div style={{ fontSize:11, color:T.textDim }}>{c.type} · {c.employees} employees</div>
                  </div>
                  <div style={{ flexShrink:0 }}>
                    {c.score != null
                      ? <ScoreBar score={c.score} width={80} />
                      : <span style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace" }}>No assessment</span>}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    {report && <Btn variant="ghost" style={{ padding:"6px 12px", fontSize:11 }} onClick={() => onViewReport(report)}>Report</Btn>}
                    <Btn variant="ghost" style={{ padding:"6px 12px", fontSize:11 }} onClick={() => onStartAssessment(c)}>Assess</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Alerts */}
        <Card>
          <SectionLabel>Live Alerts</SectionLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {alerts.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:T.textDim, fontSize:13 }}>
                ✓ No open alerts
              </div>
            )}
            {alerts.slice(0,5).map(a => {
              const sevColor = a.severity==="HIGH" ? T.red : a.severity==="MEDIUM" ? T.yellow : T.textDim;
              const client = MOCK_CLIENTS.find(c => c.id === a.clientId);
              return (
                <div key={a.id} style={{ padding:"13px 14px", background:T.surface, borderRadius:8,
                  border:`1px solid ${T.border}`, borderLeft:`3px solid ${sevColor}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                    <Mono style={{ fontSize:9, color:sevColor, fontWeight:700, letterSpacing:"0.1em" }}>{a.severity}</Mono>
                    <Mono style={{ fontSize:9, color:T.textDim }}>{a.time}</Mono>
                  </div>
                  <div style={{ fontSize:12, color:T.text, marginBottom:5, lineHeight:1.4 }}>{a.text.substring(0,80)}...</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:T.textDim }}>{client?.name}</span>
                    <button onClick={() => onDismissAlert(a.id)} style={{ fontSize:10, color:T.textDim,
                      background:"none", border:"none", cursor:"pointer" }}>dismiss</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── ASSESSMENT VIEW ──────────────────────────────────────────────────────────
function AssessmentView({ client, state, setState, onComplete, questions }) {
  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const ALL_FW = ["FFIEC","NCUA","NY DFS 500","GLBA","SOC 2","PCI DSS"];

  // Default frameworks based on client type
  function defaultFrameworks(clientType) {
    if (!clientType) return ["FFIEC","GLBA"];
    const t = clientType.toLowerCase();
    if (t.includes("credit union")) return ["NCUA","GLBA","NY DFS 500"];
    if (t.includes("bank")) return ["FFIEC","GLBA","NY DFS 500"];
    if (t.includes("insurance")) return ["GLBA","NY DFS 500","SOC 2"];
    if (t.includes("iso") || t.includes("isv") || t.includes("fintech") || t.includes("payment")) return ["PCI DSS","SOC 2","GLBA"];
    return ["FFIEC","GLBA"];
  }

  // Framework selection screen
  if (state.step === "framework-select") {
    const selected = state.selectedFrameworks || defaultFrameworks(client?.type);
    function toggleFW(fw) {
      const cur = state.selectedFrameworks || defaultFrameworks(client?.type);
      const next = cur.includes(fw) ? cur.filter(f => f !== fw) : [...cur, fw];
      const clearSaq = fw === "PCI DSS" && cur.includes(fw);
      setState(s => ({ ...s, selectedFrameworks: next, ...(clearSaq ? { saqType: null } : {}) }));
    }
    function beginAssessment() {
      const fws = state.selectedFrameworks || defaultFrameworks(client?.type);
      if (fws.includes("PCI DSS") && !state.saqType) {
        setState(s => ({ ...s, step:"saq-select", selectedFrameworks: fws }));
        return;
      }
      let filtered = questions.filter(q => q.frameworks.some(f => fws.includes(f)));
      if (fws.includes("PCI DSS") && state.saqType) {
        const saqMap = SAQ_QUESTION_MAP[state.saqType];
        if (saqMap) {
          const saqQids = new Set(saqMap.questionIds);
          const pciNa   = new Set(saqMap.notApplicable);
          filtered = filtered.filter(q => {
            const isPci = q.frameworks.length === 1 && q.frameworks[0] === "PCI DSS";
            if (!isPci) return true;
            if (pciNa.has(q.id)) return false;
            return saqQids.has(q.id);
          });
        }
      }
      setState(s => ({ ...s, step:"assessment", currentQ:0, answers:{}, filteredQuestions: filtered }));
    }

    return (
      <div style={{ padding:"40px 48px", maxWidth:720 }}>
        <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>{client?.name}</div>
        <div style={{ fontSize:13, color:T.textDim, marginBottom:32 }}>Select frameworks to include in this assessment</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:32 }}>
          {ALL_FW.map(fw => {
            const on = (state.selectedFrameworks || defaultFrameworks(client?.type)).includes(fw);
            const color = FW_COLOR[fw] || T.accent;
            return (
              <button key={fw} onClick={() => toggleFW(fw)} style={{
                background: on ? `${color}18` : T.surface,
                border: `1.5px solid ${on ? color : T.border}`,
                borderRadius:8, padding:"14px 16px", textAlign:"left", cursor:"pointer",
                transition:"all 0.15s"
              }}>
                <div style={{ fontSize:12, fontWeight:700, color: on ? color : T.textDim, marginBottom:4 }}>{fw}</div>
                <div style={{ fontSize:11, color:T.textDim, lineHeight:1.4 }}>
                  {fw === "FFIEC" && "Community banks"}
                  {fw === "NCUA" && "Credit unions"}
                  {fw === "NY DFS 500" && "NY-chartered entities"}
                  {fw === "GLBA" && "All financial institutions"}
                  {fw === "SOC 2" && "ISVs & fintechs"}
                  {fw === "PCI DSS" && "ISOs, ISVs, merchants & service providers"}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:24 }}>
          {(state.selectedFrameworks || defaultFrameworks(client?.type)).length} frameworks selected · {questions.filter(q => q.frameworks.some(f => (state.selectedFrameworks || defaultFrameworks(client?.type)).includes(f))).length} questions
        </div>
        <Btn onClick={beginAssessment} disabled={!(state.selectedFrameworks || defaultFrameworks(client?.type)).length}>
          Begin Assessment →
        </Btn>
      </div>
    );
  }

  // ── SAQ type selection step ─────────────────────────────────────────────────
  if (state.step === "saq-select") {
    const fws = state.selectedFrameworks || defaultFrameworks(client?.type);
    const inferred = inferSaqType(client?.type);
    return (
      <div style={{ padding:"40px 48px", maxWidth:760 }}>
        <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>{client?.name}</div>
        <div style={{ fontSize:13, color:T.textDim, marginBottom:8 }}>PCI DSS is selected — confirm the applicable SAQ type</div>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:28, padding:"10px 14px", background:`${T.yellow}12`, border:`1px solid ${T.yellow}30`, borderRadius:6 }}>
          This is a <strong>gap readiness assessment</strong> scoped to your SAQ type — not the SAQ itself. It covers the major control domains and surfaces gaps before a formal QSA engagement. Confirm the SAQ type with the client's acquiring bank or QSA if unsure.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
          {Object.entries(SAQ_QUESTION_MAP).map(([saqKey, saqData]) => {
            const isSelected = (state.saqType || inferred) === saqKey;
            return (
              <button key={saqKey} onClick={() => setState(s => ({ ...s, saqType: saqKey }))} style={{
                background: isSelected ? `${T.accent}12` : T.surface,
                border: `1.5px solid ${isSelected ? T.accent : T.border}`,
                borderRadius:8, padding:"14px 18px", textAlign:"left", cursor:"pointer", transition:"all 0.15s"
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: isSelected ? T.text : T.textMid, marginBottom:4 }}>
                      {saqData.label}
                    </div>
                    <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>{saqData.description}</div>
                  </div>
                  <div style={{ flexShrink:0, marginLeft:16 }}>
                    <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono', monospace", color: isSelected ? T.accent : T.textDim, fontWeight:700 }}>
                      {saqData.questionIds.length} readiness checks
                    </span>
                  </div>
                </div>
                {saqData.spNote && isSelected && (
                  <div style={{ marginTop:10, fontSize:11, color:T.yellow, padding:"8px 12px", background:`${T.yellow}10`, borderRadius:5, border:`1px solid ${T.yellow}30` }}>
                    {saqData.spNote}
                  </div>
                )}
                {saqData.aepNote && isSelected && (
                  <div style={{ marginTop:10, fontSize:11, color:T.yellow, padding:"8px 12px", background:`${T.yellow}10`, borderRadius:5, border:`1px solid ${T.yellow}30` }}>
                    {saqData.aepNote}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <Btn variant="ghost" onClick={() => setState(s => ({ ...s, step:"framework-select", saqType: null }))}>Back</Btn>
          <Btn onClick={() => {
            const finalSaq = state.saqType || inferred;
            if (!finalSaq) return;
            let filtered = questions.filter(q => q.frameworks.some(f => fws.includes(f)));
            const saqMap = SAQ_QUESTION_MAP[finalSaq];
            if (saqMap) {
              const saqQids = new Set(saqMap.questionIds);
              const pciNa   = new Set(saqMap.notApplicable);
              filtered = filtered.filter(q => {
                const isPci = q.frameworks.length === 1 && q.frameworks[0] === "PCI DSS";
                if (!isPci) return true;
                if (pciNa.has(q.id)) return false;
                return saqQids.has(q.id);
              });
            }
            setState(s => ({ ...s, step:"assessment", currentQ:0, answers:{}, filteredQuestions: filtered, saqType: finalSaq }));
          }} disabled={!state.saqType && !inferred}>
            Begin Readiness Assessment ({(state.saqType || inferred) ? SAQ_QUESTION_MAP[state.saqType || inferred]?.questionIds.length : "?"} checks) →
          </Btn>
        </div>
      </div>
    );
  }

  const activeQuestions = state.filteredQuestions || questions;
  const { currentQ, answers } = state;
  if (!activeQuestions.length) return <div style={{padding:40,color:T.textDim}}>Loading assessment...</div>;
  const q = activeQuestions[currentQ];
  const answered = answers[q?.id];
  const progress = currentQ / (activeQuestions.length || 1);

  async function handleAnswer(val) {
    setState(s => ({ ...s, answers: { ...s.answers, [q.id]: { value:val, followUp:"" } } }));
    if (val !== "na") {
      setAiLoading(true); setAiComment("");
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST", headers:{ "Content-Type":"application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
          body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:130,
            messages:[{ role:"user", content:
              `You are a terse compliance advisor. A ${client?.type||"financial institution"} answered "${val}" to: "${q.text}". Give 1-2 sentences on what this means for their posture across ${q.frameworks.join(", ")}. Be specific, no fluff.` }]
          })
        });
        const d = await resp.json();
        setAiComment(d.content?.[0]?.text || "");
      } catch { setAiComment(""); }
      setAiLoading(false);
    } else { setAiComment(""); }
  }

  function handleNext() {
    setAiComment(""); setAiLoading(false);
    setState(s => ({ ...s, animIn:false }));
    setTimeout(() => {
      if (currentQ < activeQuestions.length - 1) {
        setState(s => ({ ...s, currentQ: s.currentQ+1, animIn:true }));
      } else {
        // compute and finish
        const report = computeReport(answers, client, activeQuestions);
        onComplete(report);
      }
    }, 180);
  }

  if (!q) return null;

  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:820 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.02em" }}>
            {client?.name}
          </div>
          <div style={{ fontSize:13, color:T.textDim }}>{client?.type} · Multi-Framework Assessment</div>
        </div>
        <div style={{ marginLeft:"auto", textAlign:"right" }}>
          <Mono style={{ fontSize:12, color:T.textDim }}>{currentQ+1} / {activeQuestions.length}</Mono>
          <div style={{ width:160, height:3, background:T.border, borderRadius:2, marginTop:6, overflow:"hidden" }}>
            <div style={{ width:`${progress*100}%`, height:"100%", background:T.accent, transition:"width 0.4s ease" }} />
          </div>
        </div>
      </div>

      <Card>
        <div style={{ opacity: state.animIn ? 1:0, transform: state.animIn ? "none":"translateY(8px)", transition:"all 0.2s ease" }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            {q.frameworks.map(f => <Tag key={f} fw={f} />)}
            <span style={{ marginLeft:"auto", fontSize:11, color:T.textDim }}>
              <Mono>Weight: {q.weight}x</Mono>
            </span>
          </div>

          <Mono style={{ fontSize:10, color:T.accent, letterSpacing:"0.1em", fontWeight:700, display:"block", marginBottom:8 }}>
            {q.domain.toUpperCase()}
          </Mono>
          <div style={{ fontSize:19, fontWeight:700, color:T.text, lineHeight:1.4, marginBottom:24, letterSpacing:"-0.01em" }}>
            {q.text}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {ANSWER_OPTIONS.map(opt => {
              const active = answered?.value === opt.value;
              const c = opt.value==="yes" ? T.green : opt.value==="partial" ? T.yellow : opt.value==="no" ? T.red : T.textDim;
              return (
                <button key={opt.value} onClick={() => handleAnswer(opt.value)} style={{
                  padding:"14px 16px", borderRadius:10, textAlign:"left", cursor:"pointer",
                  border: active ? `1.5px solid ${c}` : `1px solid ${T.border}`,
                  background: active ? `${c}12` : T.surface,
                  color: active ? T.text : T.textMid,
                  fontSize:13, fontWeight: active ? 600 : 400,
                  fontFamily:"'Plus Jakarta Sans', sans-serif",
                  transition:"all 0.15s", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16, color: active ? c : T.textDim }}>{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom:16 }}>
            <AIBox text={aiComment} loading={aiLoading} />
          </div>

          {answered && answered.value !== "na" && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:T.textDim, marginBottom:6, fontStyle:"italic" }}>
                ↳ {q.followUp}
              </div>
              <input
                style={{ width:"100%", padding:"10px 14px", background:T.surface, border:`1px solid ${T.border}`,
                  borderRadius:8, color:T.text, fontSize:13, outline:"none" }}
                placeholder="Optional context for your gap report..."
                value={answered.followUp || ""}
                onChange={e => setState(s => ({
                  ...s, answers: { ...s.answers, [q.id]: { ...s.answers[q.id], followUp:e.target.value } }
                }))}
              />
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            {currentQ > 0
              ? <Btn variant="ghost" onClick={() => setState(s => ({...s, currentQ:s.currentQ-1, animIn:true}))}>← Back</Btn>
              : <div />}
            <Btn onClick={handleNext} disabled={!answered}>
              {currentQ < activeQuestions.length-1 ? "Next →" : "Generate Report →"}
            </Btn>
          </div>
        </div>
      </Card>

      {/* Control citations */}
      {q && (
        <div style={{ marginTop:16, display:"flex", gap:8, flexWrap:"wrap" }}>
          {Object.entries(q.controls).map(([fw, ref]) => (
            <div key={fw} style={{ padding:"6px 12px", background:T.surface2, border:`1px solid ${T.border}`,
              borderRadius:6, fontSize:11, color:T.textDim }}>
              <span style={{ color:FW_COLOR[fw], fontWeight:600 }}>{fw}</span>
              <Mono style={{ marginLeft:6 }}>{ref}</Mono>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── REPORT VIEW ──────────────────────────────────────────────────────────────
// ─── POLICY LIBRARY ───────────────────────────────────────────────────────────
// ─── FRAMEWORK-DRIVEN CITATION RESOLVER ──────────────────────────────────────
// Maps each framework to its citations per policy type.
// getRegs(policyId, frameworkScores) returns only citations for in-scope frameworks.
const POLICY_CITATIONS = {
  infosec: {
    "GLBA":       { label:"GLBA §501(b)",          note:"Requires administrative, technical & physical safeguards" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A", note:"Information security program required for all FICUs" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Board-approved IS policy covering all domains" },
    "NY DFS 500": { label:"NY DFS §500.3",          note:"Written cybersecurity policy required, board approval" },
    "SOC 2":      { label:"SOC 2 CC1.2",            note:"Board oversight of cybersecurity program" },
    "PCI DSS":    { label:"PCI DSS Req 12.1",       note:"Written IS policy covering all PCI DSS requirements, reviewed annually" },
  },
  irp: {
    "NCUA":       { label:"NCUA 12 CFR 748(c)",    note:"72-hour notification to NCUA of reportable cyber incidents" },
    "NY DFS 500": { label:"NY DFS §500.16",         note:"Written IRP with defined roles, goals, internal processes" },
    "FFIEC":      { label:"FFIEC BCP Booklet",      note:"Incident response as component of BCM; annual testing" },
    "GLBA":       { label:"GLBA §314.4(f)",         note:"Response program for unauthorized access to customer info" },
    "SOC 2":      { label:"SOC 2 CC7.3",            note:"Respond to identified security incidents" },
    "PCI DSS":    { label:"PCI DSS Req 12.10",      note:"IRP for cardholder data breaches; card brand notification procedures" },
  },
  bcp: {
    "FFIEC":      { label:"FFIEC BCM Booklet",      note:"BIA required; RTO/RPO for critical systems; annual test" },
    "NCUA":       { label:"NCUA 12 CFR 749",        note:"Vital records preservation program required" },
    "GLBA":       { label:"GLBA §314.4(f)",         note:"Recovery procedures for customer information systems" },
    "NY DFS 500": { label:"NY DFS §500.16",         note:"Business continuity as component of cybersecurity program" },
    "SOC 2":      { label:"SOC 2 A1.2",             note:"Recovery infrastructure and procedures for availability" },
    "PCI DSS":    { label:"PCI DSS Req 12.10",      note:"Business continuity for cardholder data environments" },
  },
  tprm: {
    "FFIEC":      { label:"FFIEC Outsourcing Booklet", note:"Due diligence, contracts, ongoing monitoring of TSPs" },
    "NY DFS 500": { label:"NY DFS §500.11",            note:"Written third-party security policy — mandatory requirement" },
    "GLBA":       { label:"GLBA §314.4(f)",             note:"Oversee service providers handling customer information" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",      note:"Controls for third parties accessing member information" },
    "SOC 2":      { label:"SOC 2 CC9.2",                note:"Vendor risk assessment and contractual requirements" },
    "PCI DSS":    { label:"PCI DSS Req 12.8",           note:"Service provider list; annual compliance confirmation required" },
  },
  access: {
    "NY DFS 500": { label:"NY DFS §500.7",          note:"Limit access privileges; annual access review required" },
    "NY DFS 500_mfa": { label:"NY DFS §500.12",     note:"MFA required for ALL users as of November 1, 2025" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Least privilege, separation of duties, quarterly reviews" },
    "GLBA":       { label:"GLBA §314.4(c)",         note:"Access controls to protect customer information" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",  note:"Access controls and authentication requirements" },
    "SOC 2":      { label:"SOC 2 CC6.1",            note:"Logical access security controls and authentication" },
    "PCI DSS":    { label:"PCI DSS Req 7 / Req 8",  note:"Least privilege access; MFA for all CDE access; unique user IDs" },
  },
  aup: {
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Employee responsibilities and acceptable use standards" },
    "GLBA":       { label:"GLBA §314.4(b)",         note:"Employee management and training on information security" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",  note:"Internal controls including employee responsibilities" },
    "NY DFS 500": { label:"NY DFS §500.14",         note:"Cybersecurity awareness training — annual requirement" },
    "SOC 2":      { label:"SOC 2 CC1.4",            note:"Commitment to competence; personnel policies" },
    "PCI DSS":    { label:"PCI DSS Req 12.6",       note:"Security awareness training; acceptable use for all personnel" },
  },
  data: {
    "NY DFS 500": { label:"NY DFS §500.13",         note:"Data retention limits; dispose of nonpublic info no longer needed" },
    "GLBA":       { label:"GLBA",                   note:"Nonpublic personal information (NPI) protection and handling" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Data inventory, classification, and labeling program" },
    "NCUA":       { label:"NCUA 12 CFR 749",        note:"Required retention periods for specific record categories" },
    "SOC 2":      { label:"SOC 2 CC6.5",            note:"Data disposal and retention controls" },
    "PCI DSS":    { label:"PCI DSS Req 3",          note:"CHD retention limits; SAD prohibition; PAN rendering requirements" },
  },
  patch: {
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Patch management program; vulnerability identification and remediation" },
    "NY DFS 500": { label:"NY DFS §500.05",         note:"Annual pen test + bi-annual vuln assessments + automated scanning" },
    "GLBA":       { label:"GLBA §314.4(e)",         note:"Regular testing and monitoring of systems" },
    "NCUA":       { label:"NCUA ACET",              note:"Patch management maturity assessed during examination" },
    "SOC 2":      { label:"SOC 2 CC7.1",            note:"Vulnerability identification and remediation" },
    "PCI DSS":    { label:"PCI DSS Req 6 / Req 11", note:"Critical patches within 1 month; quarterly ASV scans; annual pen test" },
  },
  cde_scope: {
    "PCI DSS":    { label:"PCI DSS Req 1",          note:"Network security controls; firewall rules restricting CDE traffic" },
    "PCI DSS_2":  { label:"PCI DSS Req 2",          note:"System inventory; hardening standards for all in-scope components" },
    "PCI DSS_3":  { label:"PCI DSS Req 3",          note:"Data flow mapping; CHD storage locations; SAD prohibition" },
    "PCI DSS_s":  { label:"PCI DSS Scoping",        note:"QSA scoping guidance; segmentation controls and validation" },
  },
  encryption: {
    "PCI DSS":    { label:"PCI DSS Req 4",          note:"TLS 1.2+ for all CHD transmission; certificate inventory required" },
    "NY DFS 500": { label:"NY DFS §500.15",          note:"Encryption of nonpublic information at rest and in transit" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Encryption standards for sensitive data transmission and storage" },
    "GLBA":       { label:"GLBA §314.4(e)",          note:"Encryption as safeguard for customer information" },
    "SOC 2":      { label:"SOC 2 CC6.1",            note:"Logical access controls including encryption of sensitive data" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",  note:"Encryption controls as part of information security program" },
  },
  audit_logging: {
    "PCI DSS":    { label:"PCI DSS Req 10",         note:"Audit logs for all CDE access; 12-month retention; daily review; tamper protection" },
    "NY DFS 500": { label:"NY DFS §500.06",          note:"Audit trail systems required; 6-year retention for covered entities" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Audit logging for all access to critical systems; anomaly detection" },
    "GLBA":       { label:"GLBA §314.4(e)",          note:"Monitoring and testing of information security controls" },
    "SOC 2":      { label:"SOC 2 CC7.2",            note:"Monitor system components for anomalous activity" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",  note:"Audit controls and monitoring as part of information security program" },
  },
  physical_security: {
    "PCI DSS":    { label:"PCI DSS Req 9",          note:"Physical access restrictions to CDE; visitor logs; media destruction; POI device inspection" },
    "NY DFS 500": { label:"NY DFS §500.02",          note:"Physical controls as part of cybersecurity program" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Physical security controls for systems housing sensitive data" },
    "GLBA":       { label:"GLBA §314.4(d)",          note:"Physical safeguards to protect customer information" },
    "SOC 2":      { label:"SOC 2 CC6.4",            note:"Physical access to facilities and protected information assets" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",  note:"Physical controls as part of information security program" },
  },
  antimalware: {
    "PCI DSS":    { label:"PCI DSS Req 5",          note:"Anti-malware on all susceptible systems; current definitions; logs retained; cannot be disabled by users" },
    "NY DFS 500": { label:"NY DFS §500.14",          note:"Cybersecurity awareness training including phishing and malware prevention" },
    "FFIEC":      { label:"FFIEC InfoSec Booklet",  note:"Malware protection and endpoint security controls" },
    "GLBA":       { label:"GLBA §314.4(d)",          note:"Technical safeguards against unauthorized access including malware" },
    "SOC 2":      { label:"SOC 2 CC6.8",            note:"Prevention and detection of unauthorized or malicious software" },
    "NCUA":       { label:"NCUA 12 CFR 748 App A",  note:"Malware controls as part of information security program" },
  },
};

function getRegs(policyId, frameworkScores) {
  const citations = POLICY_CITATIONS[policyId];
  if (!citations) return [];
  const inScope = Object.keys(frameworkScores);
  // For access policy, NY DFS 500 has two entries — handle specially
  if (policyId === "access" && inScope.includes("NY DFS 500")) {
    return Object.entries(citations)
      .filter(([fw]) => inScope.includes(fw) || fw === "NY DFS 500_mfa")
      .map(([, reg]) => reg);
  }
  // For CDE scope, always show all PCI citations if PCI DSS in scope
  if (policyId === "cde_scope") {
    return inScope.includes("PCI DSS") ? Object.values(citations) : [];
  }
  return Object.entries(citations)
    .filter(([fw]) => inScope.includes(fw))
    .map(([, reg]) => reg);
}

const POLICIES = [
  {
    id: "infosec",
    title: "Information Security Policy",
    icon: "🔐",
    description: "Master security policy covering program governance, risk management, and control objectives.",
    regs: [
      { label: "GLBA §501(b)", note: "Requires administrative, technical & physical safeguards" },
      { label: "NCUA 12 CFR 748 App A", note: "Information security program required for all FICUs" },
      { label: "FFIEC InfoSec Booklet", note: "Board-approved IS policy covering all domains" },
      { label: "NY DFS §500.3", note: "Written cybersecurity policy required, board approval" },
    ],
    prompt: (report) => `Write a comprehensive Information Security Policy for ${report.clientName} (${report.clientType}, approx ${report.answers?.employees || "small"} employees).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- GLBA §501(b): Administrative, technical, and physical safeguards for customer information
- NCUA 12 CFR 748, Appendix A: Information security program for federally insured credit unions
- FFIEC Information Security Booklet: Board-approved IS policy, risk-based approach
- NY DFS 23 NYCRR §500.3: Written cybersecurity policy approved by board or senior officer

ASSESSMENT CONTEXT:
Overall score: ${Math.round(report.overallScore * 100)}%
Gaps: ${report.gaps.map(g => g.domain).join(", ") || "None identified"}
Strengths: ${report.strengths.map(s => s.domain).join(", ") || "None identified"}

REQUIRED SECTIONS (cite the specific regulation each section satisfies):
1. Purpose & Scope
2. Roles & Responsibilities (CISO/designated officer, board, management, staff)
3. Risk Assessment Program (annual, risk-based, documented)
4. Access Controls & Identity Management
5. Data Protection & Encryption
6. Incident Response Overview
7. Vendor & Third-Party Oversight
8. Security Awareness Training
9. Audit & Compliance Review
10. Policy Review & Board Approval

FORMAT REQUIREMENTS:
- This is a POLICY TEMPLATE and GUIDE — not a final document. Frame it as such.
- Use [INSTITUTION NAME] wherever the institution name appears (they will customize)
- Use [DATE] for effective dates, [BOARD APPROVED DATE], [CISO NAME], etc.
- Add inline notes in brackets like [NOTE: Customize this section based on your core banking system] or [NOTE: If your institution is not NY DFS-regulated, this section is optional] where sections may not apply universally
- For each section, include the specific regulatory citation it satisfies
- At the top, include a short "How to Use This Template" note explaining they should review each section with their team and legal counsel before adopting
- Make the structure clear so they can see what a complete, audit-ready policy looks like — and what they need to fill in`
  },
  {
    id: "irp",
    title: "Incident Response Plan",
    icon: "🚨",
    description: "Written IRP with defined roles, escalation procedures, and 72-hour notification workflow.",
    regs: [
      { label: "NCUA 12 CFR 748(c)", note: "72-hour notification to NCUA of reportable cyber incidents" },
      { label: "NY DFS §500.16", note: "Written IRP with defined roles, goals, internal processes" },
      { label: "FFIEC BCP Booklet", note: "Incident response as component of BCM; annual testing" },
      { label: "GLBA §314.4(f)", note: "Response program for unauthorized access to customer info" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write a complete Incident Response Plan for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS PLAN MUST SATISFY:
- NCUA 12 CFR 748(c): 72-hour notification to NCUA upon reasonable belief of reportable cyber incident
- NY DFS §500.16: Written IRP with internal processes, clear roles, goals, and defined escalation
- FFIEC BCP Booklet: IRP as component of BCM framework; annual testing requirement
- GLBA §314.4(f) / NCUA 748 App B: Member/customer notification procedures for unauthorized access${isPCI ? `
- PCI DSS v4.0 Req 12.10: Written IRP specifically addressing cardholder data breaches; must include card brand and acquirer notification procedures, engagement of PCI forensic investigator (PFI) if required` : ""}

ASSESSMENT CONTEXT:
Incident Response gaps identified: ${report.gaps.filter(g => g.domain === "Incident Response").map(g => g.text).join("; ") || "None"}
Incident Response strengths: ${report.strengths.filter(s => s.domain === "Incident Response").map(s => s.text).join("; ") || "None"}

REQUIRED SECTIONS (cite specific regulation for each):
1. Purpose, Scope & Regulatory Authority
2. Incident Classification Framework (what constitutes a reportable incident under NCUA 748(c) and NY DFS §500.17${isPCI ? "; cardholder data breach definition under PCI DSS" : ""})
3. Incident Response Team — Roles & Responsibilities (IRT lead, IT, legal, communications, executive)
4. Detection & Initial Triage Procedures
5. Containment, Eradication & Recovery Steps
6. Regulatory Notification Procedures (72-hour rule — exact workflow, who notifies, how, documentation required)
7. Member/Customer Notification Procedures (GLBA/NCUA 748 App B thresholds and timing)${isPCI ? `
8. Card Brand & Acquirer Notification Procedures (PCI DSS Req 12.10 — Visa/Mastercard mandatory notification timelines, PFI engagement trigger, acquirer notification workflow)` : `
8. Evidence Preservation & Documentation`}
9. Post-Incident Review & Lessons Learned
10. Annual Testing & Tabletop Exercise Requirements

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE — not a final document. Frame it as such with a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [IRT LEAD NAME/ROLE], [DATE], [NCUA REGIONAL OFFICE CONTACT] as placeholders${isPCI ? "\n- Include [ACQUIRER NAME/CONTACT], [CARD BRAND SECURITY CONTACT] placeholders in notification section" : ""}
- Add [NOTE: ...] callouts where sections need institution-specific customization
- Every notification deadline must be explicitly stated with the regulatory citation
- Decision trees for incident classification and notification triggers should use placeholder thresholds with a note to customize based on their systems`;
    }
  },
  {
    id: "bcp",
    title: "Business Continuity & DR Plan",
    icon: "🔄",
    description: "BCP/DRP with BIA, RTO/RPO definitions, recovery strategies, and annual testing requirements.",
    regs: [
      { label: "FFIEC BCM Booklet", note: "BIA required; RTO/RPO for critical systems; annual test" },
      { label: "NCUA 12 CFR 749", note: "Vital records preservation program required" },
      { label: "NCUA 12 CFR 748(b)", note: "5-day notification of catastrophic act to regional director" },
      { label: "GLBA §314.4(f)", note: "Recovery procedures for customer information systems" },
    ],
    prompt: (report) => `Write a Business Continuity and Disaster Recovery Plan for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS PLAN MUST SATISFY:
- FFIEC Business Continuity Management Booklet: Business Impact Analysis, recovery strategies, annual testing
- NCUA 12 CFR 749: Vital records preservation program (member records, financial records)
- NCUA 12 CFR 748(b): Catastrophic act notification to regional director within 5 business days
- GLBA §314.4(f): Recovery procedures to protect customer information during disruptions

ASSESSMENT CONTEXT:
BCP/Continuity gaps: ${report.gaps.filter(g => g.domain === "Business Continuity").map(g => g.text).join("; ") || "None identified"}
BCP strengths: ${report.strengths.filter(s => s.domain === "Business Continuity").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Business Impact Analysis Summary (methodology, critical business functions, maximum tolerable downtime)
3. Recovery Objectives — RTO and RPO for each critical system category (core banking, member-facing, payments, back-office)
4. Recovery Strategies (primary and alternate sites, data backup procedures, vendor dependencies)
5. Vital Records Program (NCUA 12 CFR 749 — what records, format, off-site storage requirements)
6. Crisis Management & Communication Plan (internal escalation, member communication, regulator notification)
7. Regulatory Notification Procedures (NCUA catastrophic act — 5 business days, content required)
8. Plan Activation Criteria & Authority
9. Testing Program (annual full test requirement, tabletop exercises, test documentation)
10. Plan Maintenance & Board Reporting

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [BCM COORDINATOR NAME] as placeholders
- RTO/RPO values should be shown as [XX HOURS — customize based on your BIA results] with a note that institutions must determine their own based on actual BIA
- Add [NOTE: ...] callouts for sections requiring site-specific information (e.g., alternate facility address, off-site storage vendor)
- Annual testing requirement must reference FFIEC BCM guidance explicitly`
  },
  {
    id: "tprm",
    title: "Vendor / Third-Party Risk Management Policy",
    icon: "🤝",
    description: "Written TPRM policy covering due diligence, risk tiering, contracts, and ongoing monitoring.",
    regs: [
      { label: "FFIEC Outsourcing Booklet", note: "Due diligence, contracts, ongoing monitoring of TSPs" },
      { label: "NY DFS §500.11", note: "Written third-party security policy — mandatory requirement" },
      { label: "GLBA §314.4(f)", note: "Oversee service providers handling customer information" },
      { label: "NCUA 12 CFR 748 App A", note: "Controls for third parties accessing member information" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write a Vendor and Third-Party Risk Management Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- FFIEC Outsourcing Technology Services Booklet: Due diligence, contract requirements, ongoing oversight
- NY DFS 23 NYCRR §500.11: Written third-party service provider security policy (mandatory)
- GLBA §314.4(f): Oversight of service providers with access to customer information
- NCUA 12 CFR 748, App A: Controls ensuring security of member info held by third parties
- NYDFS October 2025 Industry Letter: Risk-based, continuously adaptive TPSP governance${isPCI ? `
- PCI DSS v4.0 Req 12.8: Maintain list of all service providers with access to cardholder data; written agreements requiring PCI DSS compliance; annual confirmation of each service provider's PCI DSS compliance status
- PCI DSS v4.0 Req 12.9: Service providers must acknowledge in writing their responsibility for securing cardholder data` : ""}

ASSESSMENT CONTEXT:
Vendor management gaps: ${report.gaps.filter(g => g.domain === "Vendor Management").map(g => g.text).join("; ") || "None identified"}
Vendor management strengths: ${report.strengths.filter(s => s.domain === "Vendor Management").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Vendor Risk Tiering Framework (Critical / High / Moderate / Low — define criteria for each)
3. Pre-Engagement Due Diligence Requirements (by tier — SOC 2, pen test reports, financial stability, references${isPCI ? "; PCI DSS compliance documentation (AOC or SAQ) required for any service provider touching cardholder data" : ""})
4. Contract Requirements (security clauses required by NY DFS §500.11: access controls, encryption, breach notification, audit rights, data return/destruction${isPCI ? "; PCI DSS Req 12.8.2 written acknowledgment of cardholder data responsibility" : ""})
5. Onboarding & Access Provisioning Controls
6. Ongoing Monitoring Program (periodic reassessment frequency by tier, incident notification requirements)${isPCI ? `
7. PCI DSS Service Provider Register (Req 12.8.4 — maintain current list, SAQ/AOC on file, annual compliance confirmation letter template)` : `
7. Concentration Risk Assessment (core processors, cloud providers — NCUA concern re: vendor failure)`}
8. Subcontractor / Fourth-Party Risk
9. Vendor Termination & Data Return Procedures
10. Board/Management Reporting on Third-Party Risk

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [TPRM OWNER ROLE] as placeholders
- Contract clause examples should be shown as model language with a [NOTE: Have legal counsel review before inserting into contracts]
- Tiering criteria should include [NOTE: Adjust thresholds to match your institution's risk appetite]${isPCI ? "\n- Include a sample PCI DSS Annual Compliance Confirmation Letter template as an appendix (Req 12.8.4)" : ""}
- List the exact clauses satisfying NY DFS §500.11 with clear annotation`;
    }
  },
  {
    id: "access",
    title: "Access Control Policy",
    icon: "🔑",
    description: "Least privilege, MFA, privileged access management, and quarterly access review requirements.",
    regs: [
      { label: "NY DFS §500.7", note: "Limit access privileges; annual access review required" },
      { label: "NY DFS §500.12", note: "MFA required for ALL users as of November 1, 2025" },
      { label: "FFIEC InfoSec Booklet", note: "Least privilege, separation of duties, quarterly reviews" },
      { label: "GLBA §314.4(c)", note: "Access controls to protect customer information" },
    ],
    prompt: (report) => `Write an Access Control Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- NY DFS §500.7: Limit user access privileges; annual review of access rights required
- NY DFS §500.12: MFA required for ALL individuals accessing ANY information system as of November 1, 2025 (universal MFA deadline)
- NY DFS §500.7 (May 2025 amendments): Enhanced access controls — privileged access management, just-in-time access
- FFIEC Information Security Booklet: Least privilege principle, separation of duties, periodic access reviews
- GLBA §314.4(c): Access controls to protect nonpublic personal information
- NCUA 12 CFR 748, App A: Access controls as part of information security program

ASSESSMENT CONTEXT:
Access control gaps: ${report.gaps.filter(g => g.domain === "Access Controls").map(g => g.text).join("; ") || "None identified"}
Access control strengths: ${report.strengths.filter(s => s.domain === "Access Controls").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Access Control Principles (least privilege, need-to-know, separation of duties)
3. User Account Management (provisioning, modification, termination — timelines and approvals)
4. Multi-Factor Authentication Requirements (NY DFS §500.12 — universal MFA; enumerate all covered systems; CISO exception process)
5. Privileged Access Management (PAM) — definition, additional controls, just-in-time access
6. Remote Access Controls
7. Service & Shared Account Management
8. Access Review Requirements (NY DFS §500.7 — annual review; FFIEC — quarterly for privileged accounts)
9. Password Standards (minimum requirements, rotation, prohibition on shared passwords)
10. Termination & Access Revocation Procedures (same-day revocation standard)
11. Logging & Monitoring of Access

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [CISO NAME], [SYSTEM ADMINISTRATOR ROLE] as placeholders
- For system-specific MFA requirements, use [LIST YOUR COVERED SYSTEMS HERE] with a note to enumerate all systems
- The November 2025 universal MFA requirement must be explicitly cited with a [NOTE: If not yet implemented, this section represents your target state — document your remediation timeline]
- Add [NOTE: ...] callouts for sections that depend on specific systems (PAM tooling, AD configuration, etc.)`
  },
  {
    id: "aup",
    title: "Acceptable Use Policy",
    icon: "📋",
    description: "Employee responsibilities for acceptable use of information systems, devices, and data.",
    regs: [
      { label: "FFIEC InfoSec Booklet", note: "Employee responsibilities and acceptable use standards" },
      { label: "GLBA §314.4(b)", note: "Employee management and training on information security" },
      { label: "NCUA 12 CFR 748 App A", note: "Internal controls including employee responsibilities" },
      { label: "NY DFS §500.14", note: "Cybersecurity awareness training — annual requirement" },
    ],
    prompt: (report) => `Write an Acceptable Use Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- FFIEC Information Security Booklet: Employee responsibilities; acceptable use as internal control
- GLBA §314.4(b): Employee training and management of information security responsibilities
- NCUA 12 CFR 748, App A: Internal controls including employee-facing security requirements
- NY DFS §500.14: Cybersecurity awareness training — annual requirement, social engineering coverage

ASSESSMENT CONTEXT:
Training/awareness gaps: ${report.gaps.filter(g => g.domain === "Security Awareness").map(g => g.text).join("; ") || "None identified"}
Training strengths: ${report.strengths.filter(s => s.domain === "Security Awareness").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Covered Systems & Assets (definition of institutional information systems, personal devices used for work)
3. Authorized Use Standards (permitted uses of institutional systems, data, and email)
4. Prohibited Activities (specific prohibitions with examples — must be enforceable)
5. Internet & Email Use Standards
6. Mobile Device & Remote Work Requirements
7. Social Engineering & Phishing Awareness (NY DFS §500.14 — annual training including social engineering)
8. Data Handling & Classification Requirements
9. Reporting Obligations (how and when to report suspected incidents or policy violations)
10. Personal Device / BYOD Policy
11. Consequences of Violation
12. Annual Acknowledgment Requirement

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [IT/SECURITY CONTACT] as placeholders
- Write in plain language — this is an employee-facing document
- Add [NOTE: ...] callouts where institutions need to insert specifics (e.g., approved device list, approved cloud services, HR disciplinary process reference)
- The annual acknowledgment section should include a sample signature block as a placeholder`
  },
  {
    id: "data",
    title: "Data Classification Policy",
    icon: "🗂️",
    description: "Data classification framework, retention schedules, and nonpublic information handling requirements.",
    regs: [
      { label: "NY DFS §500.13", note: "Data retention limits; dispose of nonpublic info no longer needed" },
      { label: "GLBA", note: "Nonpublic personal information (NPI) protection and handling" },
      { label: "FFIEC InfoSec Booklet", note: "Data inventory, classification, and labeling program" },
      { label: "NCUA 12 CFR 749", note: "Required retention periods for specific record categories" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write a Data Classification Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- NY DFS §500.13: Data retention limitations; must dispose of nonpublic information no longer necessary for business operations
- GLBA: Nonpublic personal information (NPI) — definition, handling, and protection requirements
- FFIEC Information Security Booklet: Data inventory and classification program
- NCUA 12 CFR 749: Preservation of vital records — specific retention periods for member records, financial records, board minutes
- NY DFS §500.9: Risk assessment must include data inventory${isPCI ? `
- PCI DSS v4.0 Req 3.2: Cardholder data retention policy — limit storage to minimum necessary; secure disposal procedures required
- PCI DSS v4.0 Req 3.3: Sensitive Authentication Data (SAD) — CVV, full magnetic stripe, PIN block — MUST NOT be stored after authorization under any circumstances, no exceptions
- PCI DSS v4.0 Req 3.5: Primary Account Numbers (PANs) must be rendered unreadable wherever stored (encryption, truncation, tokenization, or hashing)` : ""}

ASSESSMENT CONTEXT:
Data protection gaps: ${report.gaps.filter(g => g.domain === "Data Protection").map(g => g.text).join("; ") || "None identified"}
Data protection strengths: ${report.strengths.filter(s => s.domain === "Data Protection").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Data Classification Framework (define tiers: Restricted/Confidential/Internal/Public with examples for each${isPCI ? " — Cardholder Data and SAD must be explicitly mapped to Restricted tier" : ""})
3. ${isPCI ? "Cardholder Data & SAD Definitions and Handling (PCI DSS Req 3): define PAN, SAD, CHD; absolute prohibition on SAD post-authorization; PAN rendering requirements; acceptable storage methods" : "Nonpublic Personal Information (NPI) Definition & Handling (GLBA definition; specific controls required)"}
4. Data Inventory Requirements (NY DFS §500.9 — asset inventory deadline)${isPCI ? `
5. Cardholder Data Environment (CDE) Data Flow: document where CHD enters, is processed, stored, and transmitted; basis for CDE scoping (PCI DSS Req 3.2 / Scoping Guidance)` : ""}
${isPCI ? "6." : "5."} Data Retention Schedule by Category${isPCI ? " (including CHD retention limits — minimum necessary; must align with acquirer agreement)" : ":\n   - Member/customer account records (NCUA 12 CFR 749 minimum retention periods)\n   - Board minutes and governance records\n   - Financial records\n   - Loan files\n   - Electronic communications"}
${isPCI ? "7." : "6."} Data Disposal & Destruction Standards (methods required, documentation, certificates of destruction${isPCI ? "; PAN destruction must render data unrecoverable — cross-cut shredding, degaussing, or secure wipe standards" : ""})
${isPCI ? "8." : "7."} ${isPCI ? "PCI DSS Data Minimization Program (Req 3.2): process for cardholder data discovery scans; identifying and eliminating unnecessary CHD storage; quarterly confirmation procedures" : "NY DFS §500.13 Compliance — Data Minimization Program"}
${isPCI ? "9." : "8."} Encryption Requirements by Classification Tier${isPCI ? " (PANs at rest: AES-256 or equivalent; PANs in transit: TLS 1.2+ — Req 3.5, Req 4.2)" : ""}
${isPCI ? "10." : "9."} Third-Party Data Sharing Controls${isPCI ? " (service provider data sharing agreements — Req 12.8)" : ""}
${isPCI ? "11." : "10."} Data Breach Notification Triggers

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [DATA OWNER ROLE] as placeholders${isPCI ? `
- For CHD sections, include [NOTE: Perform a cardholder data discovery scan (tools: Spirion, Ground Labs Card Recon, or similar) to validate no unintended CHD storage exists before finalizing this policy]
- SAD prohibition section must carry a bold [CRITICAL: No exceptions exist to this requirement under PCI DSS — not for troubleshooting, not for testing environments] callout` : `
- Include actual NCUA 12 CFR 749 retention periods for key record categories as the regulatory baseline
- The data minimization section must directly address NY DFS §500.13 with a [NOTE: NY DFS-regulated institutions only] flag`}
- Add [NOTE: ...] callouts for institution-specific items (e.g., specific data systems, destruction vendors, state law requirements)`;
    }
  },
  {
    id: "patch",
    title: "Patch & Vulnerability Management Policy",
    icon: "🛡️",
    description: "Patch management program, vulnerability scanning cadence, and penetration testing requirements.",
    regs: [
      { label: "FFIEC InfoSec Booklet", note: "Patch management program; vulnerability identification and remediation" },
      { label: "NY DFS §500.05", note: "Annual pen test + bi-annual vuln assessments + automated scanning (May 2025)" },
      { label: "GLBA §314.4(e)", note: "Regular testing and monitoring of systems" },
      { label: "NCUA ACET", note: "Patch management maturity assessed during examination" },
    ],
    prompt: (report) => `Write a Patch and Vulnerability Management Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- NY DFS §500.05: Annual penetration testing + bi-annual vulnerability assessments + automated vulnerability scanning with remediation cadence (effective May 2025)
- FFIEC Information Security Booklet: Formal patch management program; timely remediation of critical vulnerabilities
- GLBA §314.4(e): Regular testing and monitoring of the effectiveness of key controls
- NCUA ACET: Patch management maturity domain assessed by examiners

ASSESSMENT CONTEXT:
Security testing gaps: ${report.gaps.filter(g => g.domain === "Risk Assessment").map(g => g.text).join("; ") || "None identified"}
Security testing strengths: ${report.strengths.filter(s => s.domain === "Risk Assessment").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Asset Inventory Scope (what systems are covered — servers, workstations, network devices, applications, cloud)
3. Vulnerability Scanning Program:
   - Automated scanning cadence (NY DFS §500.05 — risk-assessment-based frequency)
   - Authenticated vs. unauthenticated scans
   - Cloud and remote asset coverage
4. Penetration Testing Requirements (NY DFS §500.05 — annual; scope, methodology, qualified tester, reporting)
5. Patch Classification & Remediation SLAs:
   - Critical vulnerabilities (CVSS 9.0+): remediation within [X] days
   - High (CVSS 7.0-8.9): within [X] days
   - Medium/Low: within [X] days
   - Emergency out-of-band patching process
6. Patch Testing & Change Management Integration
7. Exceptions & Risk Acceptance Process (documented approval, compensating controls, CISO sign-off)
8. Legacy & End-of-Life System Management
9. Third-Party/Vendor Patch Coordination
10. Metrics, Reporting & Board Summary

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [PATCH MANAGEMENT OWNER] as placeholders
- SLA timeframes should be shown as [X DAYS — customize based on your risk tolerance and operational capacity] with regulatory minimums noted
- Add [NOTE: NY DFS-regulated institutions only] flags on pen test sections where applicable
- Add [NOTE: ...] callouts for institution-specific items (scanning tools, change management process, legacy system exceptions)
- Describe what qualifies as a "qualified penetration tester" per NY DFS §500.05`
  },
  {
    id: "cde_scope",
    title: "CDE Scoping & Network Segmentation Narrative",
    icon: "🗺️",
    description: "Cardholder data environment scope definition, system inventory, and segmentation documentation for PCI DSS v4.0 assessments.",
    regs: [
      { label: "PCI DSS Req 1", note: "Network security controls; firewall rules restricting CDE traffic" },
      { label: "PCI DSS Req 2", note: "System inventory; hardening standards for all in-scope components" },
      { label: "PCI DSS Req 3", note: "Data flow mapping; CHD storage locations; SAD prohibition" },
      { label: "PCI DSS Scoping", note: "QSA scoping guidance; segmentation controls and validation" },
    ],
    prompt: (report) => `Write a Cardholder Data Environment (CDE) Scoping and Network Segmentation Narrative for ${report.clientName} (${report.clientType}).

This is a standalone pre-QSA deliverable documenting the organization's PCI DSS v4.0 scope determination. QSAs use this document to validate that all in-scope systems are identified and that segmentation controls are sufficient to reduce scope.

REGULATORY BASIS:
- PCI DSS v4.0 Scoping Guidance (Section 4): All system components in the CDE, connected to the CDE, or that could impact the security of the CDE are in scope
- PCI DSS Req 1.3: Network access controls restricting inbound/outbound CDE traffic to only what is necessary
- PCI DSS Req 2.2: System inventory and configuration standards for all in-scope components
- PCI DSS Req 3.2: Data retention limits; CHD storage locations documented
- PCI DSS Req 12.5.2: Confirmed PCI DSS scope at least once every 12 months and after significant changes

ASSESSMENT CONTEXT:
Scoping/network gaps identified: ${report.gaps.filter(g => ["Network Security","Scoping","Data Protection"].includes(g.domain)).map(g => g.text).join("; ") || "None identified"}

REQUIRED SECTIONS:

1. SCOPE DETERMINATION METHODOLOGY
   - Definition of the CDE for this organization
   - How CHD flows through the environment (enter → process → store → transmit)
   - Scoping categories applied: CDE systems / Connected systems / Security-impacting systems / Out-of-scope systems
   - SAQ type determination with rationale (A / B / C / D — state which applies and why)

2. CARDHOLDER DATA FLOW DIAGRAM NARRATIVE
   - Text description of data flow (placeholder for actual diagram)
   - Entry points where CHD enters the environment
   - Processing locations (applications, terminals, APIs)
   - Storage locations — or explicit confirmation that storage is minimized/tokenized
   - Transmission paths (internal and external)
   - Exit points / where CHD leaves the environment

3. IN-SCOPE SYSTEM INVENTORY
   - Template table: System Name | System Type | Role in CDE | In-Scope Category | OS/Platform | Location
   - Categories: Payment applications, databases, network devices, servers, endpoints, cloud services
   - [NOTE: Complete this table for every system that stores, processes, or transmits CHD, or that is connected to such systems]

4. NETWORK SEGMENTATION CONTROLS
   - Description of segmentation mechanism (firewall, VLAN, network zone)
   - Rules restricting traffic between CDE and non-CDE networks
   - Confirmation that segmentation has been tested (Req 11.4.5 — pen test must include segmentation validation)
   - [NOTE: If no segmentation exists, the entire network is in scope — document flat network scope or implement segmentation before assessment]

5. SENSITIVE AUTHENTICATION DATA CONFIRMATION
   - Written confirmation that SAD (CVV, full magnetic stripe, PIN block) is not stored after authorization
   - Process used to verify (log review, data discovery scan, application review)
   - [CRITICAL: SAD storage after authorization is an automatic non-compliance finding with no compensating control option]

6. SCOPE REDUCTION CONTROLS
   - Tokenization or point-to-point encryption (P2PE) solutions in use, if any
   - Impact on scope reduction
   - [NOTE: P2PE solutions validated by PCI SSC may significantly reduce scope — confirm with QSA]

7. ANNUAL SCOPE CONFIRMATION
   - Process for re-confirming scope annually (Req 12.5.2)
   - Trigger events requiring scope re-evaluation (new system, new payment channel, new vendor)
   - Responsible role: [SCOPE OWNER ROLE]

FORMAT REQUIREMENTS:
- This is a WORKING DOCUMENT and TEMPLATE — designed to be completed by the organization and reviewed by the QSA
- Use [INSTITUTION NAME], [DATE], [QSA FIRM NAME], [SCOPE OWNER] as placeholders
- Every table should be pre-populated with example rows in italics or brackets showing what data to enter
- Add [NOTE: QSA will validate this section during assessment] callouts on sections requiring evidence
- Add [CRITICAL: ...] callouts on SAD and segmentation sections
- Include a document control block at the top: Version, Effective Date, Last Reviewed, Owner, QSA Reviewer`
  },
  {
    id: "encryption",
    title: "Encryption & Key Management Policy",
    icon: "🔑",
    description: "Encryption standards for data in transit and at rest, certificate inventory, and cryptographic key management procedures.",
    regs: [
      { label: "PCI DSS Req 4", note: "TLS 1.2+ for all CHD transmission; certificate and key inventory required" },
      { label: "NY DFS §500.15", note: "Encryption of nonpublic information at rest and in transit" },
      { label: "FFIEC InfoSec Booklet", note: "Encryption standards for sensitive data transmission and storage" },
      { label: "GLBA §314.4(e)", note: "Encryption as safeguard for customer information" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write an Encryption and Key Management Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- NY DFS §500.15: Encryption of nonpublic information in transit and at rest using industry-standard algorithms
- FFIEC Information Security Booklet: Encryption controls for sensitive data; key management procedures
- GLBA §314.4(e): Encryption and technical safeguards for protecting customer information${isPCI ? `
- PCI DSS v4.0 Req 4.2.1: Strong cryptography (TLS 1.2 minimum) required for all transmission of cardholder data over open, public networks
- PCI DSS v4.0 Req 4.2.2: Sending PANs via end-user messaging technologies (email, IM, SMS, chat) is prohibited unless encrypted
- PCI DSS v4.0 Req 3.5.1: Primary Account Numbers (PANs) must be rendered unreadable wherever stored — encryption, truncation, tokenization, or hashing
- PCI DSS v4.0 Req 3.6 / 3.7: Cryptographic key management procedures — key generation, distribution, storage, retirement, and destruction
- PCI DSS v4.0 Req 4.2.1.1: Inventory of trusted keys and certificates must be maintained` : ""}

ASSESSMENT CONTEXT:
Data protection gaps: ${report.gaps.filter(g => g.domain === "Data Protection").map(g => g.text).join("; ") || "None identified"}
Data protection strengths: ${report.strengths.filter(s => s.domain === "Data Protection").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Encryption Standards (approved algorithms, minimum key lengths, prohibited algorithms)
3. Data in Transit Requirements (TLS 1.2+ mandate; protocols explicitly prohibited — SSL, TLS 1.0, TLS 1.1; VPN requirements for remote access)
4. Data at Rest Requirements (encryption for stored sensitive data; database-level and file-level encryption standards)
5. Certificate Management (inventory of all certificates; renewal procedures; certificate authority requirements; revocation procedures)
6. Cryptographic Key Management
   - Key generation standards
   - Key distribution and storage (never store keys with encrypted data)
   - Key rotation schedules
   - Key custodian roles and dual control requirements
   - Key retirement and destruction procedures${isPCI ? `
7. Cardholder Data Specific Requirements
   - PAN rendering methods in use (encryption/truncation/tokenization/hashing)
   - PAN transmission prohibition via unencrypted messaging
   - SAD prohibition (CVV, magnetic stripe, PIN — no storage after authorization under any circumstances)` : ""}
${isPCI ? "8." : "7."} Roles and Responsibilities (CISO, system administrators, key custodians)
${isPCI ? "9." : "8."} Annual Review and Testing Requirements
${isPCI ? "10." : "9."} Exceptions Process

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [CISO NAME] as placeholders
- Include a table of approved and prohibited cryptographic algorithms
- Add [NOTE: ...] callouts where specific system details must be inserted
- Add [CRITICAL: ...] callouts on any PAN/SAD-related prohibitions${isPCI ? "\n- Include a sample Certificate Inventory table as a template appendix (Req 4.2.1.1)" : ""}`;
    }
  },
  {
    id: "audit_logging",
    title: "Audit Logging & Monitoring Policy",
    icon: "📊",
    description: "Audit log requirements, retention schedules, review procedures, and tamper protection for all in-scope systems.",
    regs: [
      { label: "PCI DSS Req 10", note: "Audit logs for all CDE access; 12-month retention; daily review; tamper protection" },
      { label: "NY DFS §500.06", note: "Audit trail systems required; 6-year retention for covered entities" },
      { label: "FFIEC InfoSec Booklet", note: "Audit logging for all access to critical systems; anomaly detection" },
      { label: "SOC 2 CC7.2", note: "Monitor system components for anomalous activity" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write an Audit Logging and Monitoring Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- NY DFS §500.06: Audit trail systems that log and detect cybersecurity events — 6-year retention required for covered entities
- FFIEC Information Security Booklet: Audit logging for all access to critical systems; log review and anomaly detection procedures
- GLBA §314.4(e): Regular testing and monitoring of information security controls${isPCI ? `
- PCI DSS v4.0 Req 10.2: Audit logs must capture: user ID, event type, date/time, success or failure indication, origination, and identity of affected resource
- PCI DSS v4.0 Req 10.3.1: Logs must be protected from destruction and unauthorized modification (read-only, SIEM, append-only storage)
- PCI DSS v4.0 Req 10.3.2: Audit log files must be reviewed at least daily to identify anomalies or suspicious activity
- PCI DSS v4.0 Req 10.5.1: Retain audit log history for at least 12 months, with at least the most recent 3 months available for immediate analysis
- PCI DSS v4.0 Req 10.7: Failures of critical security controls must be detected, alerted, and addressed promptly` : ""}

ASSESSMENT CONTEXT:
Monitoring gaps: ${report.gaps.filter(g => g.domain === "Monitoring").map(g => g.text).join("; ") || "None identified"}
Monitoring strengths: ${report.strengths.filter(s => s.domain === "Monitoring").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Logging Requirements
   - Systems in scope for mandatory logging
   - Minimum log event types required (authentication, access, privilege changes, system events, configuration changes)
   - Required data elements per log entry (user ID, timestamp, event type, source IP, success/failure)
3. Log Protection and Integrity
   - Controls preventing log modification or deletion
   - Centralized log management / SIEM requirements
   - Access controls on log data
4. Log Retention Schedule
   - Online retention period (immediately accessible)
   - Archive retention period
   - Secure disposal of expired logs${isPCI ? `
   - PCI DSS minimum: 12 months total, 3 months immediately accessible` : ""}
5. Log Review Procedures
   - Review frequency (daily automated review minimum; manual review triggers)
   - Roles responsible for review
   - Escalation procedures for anomalies
   - Documentation of review activities
6. Alerting and Incident Escalation
   - Automated alert thresholds
   - On-call and escalation procedures
   - Integration with Incident Response Plan
7. Roles and Responsibilities
8. Annual Policy Review

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [SIEM TOOL / LOG MANAGEMENT PLATFORM] as placeholders
- Include a table of required log sources and event types
- Add [NOTE: ...] callouts where tool-specific configuration details must be inserted`;
    }
  },
  {
    id: "physical_security",
    title: "Physical Security Policy",
    icon: "🏢",
    description: "Physical access controls for facilities, server rooms, and point-of-interaction devices. Required for SAQ C, SAQ D, and SAQ D-SP.",
    regs: [
      { label: "PCI DSS Req 9", note: "Physical access to CDE; visitor logs; media destruction; POI device tamper inspection" },
      { label: "FFIEC InfoSec Booklet", note: "Physical security controls for systems housing sensitive data" },
      { label: "GLBA §314.4(d)", note: "Physical safeguards to protect customer information" },
      { label: "SOC 2 CC6.4", note: "Physical access to facilities and protected information assets" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write a Physical Security Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- FFIEC Information Security Booklet: Physical security controls for systems housing sensitive data; access control to server rooms and data centers
- GLBA §314.4(d): Physical safeguards protecting customer information from unauthorized access
- SOC 2 CC6.4: Physical access restrictions to facilities and protected information assets${isPCI ? `
- PCI DSS v4.0 Req 9.1: Physical access controls protecting CDE systems — badge readers, locks, cameras
- PCI DSS v4.0 Req 9.2: Procedures for authorizing and managing physical access, including revocation
- PCI DSS v4.0 Req 9.3: Controls for visitors — badges, escort requirements, visitor logs retained for 3 months minimum
- PCI DSS v4.0 Req 9.4: Media protection — physical media containing CHD must be secured; destruction procedures required
- PCI DSS v4.0 Req 9.5: Point-of-interaction (POI) device security — inventory of devices, tamper inspection procedures, training personnel to detect tampering` : ""}

ASSESSMENT CONTEXT:
Physical security gaps: ${report.gaps.filter(g => g.domain === "Physical Security").map(g => g.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Facility Access Controls
   - Access authorization procedures
   - Badge/key access systems and review cadence
   - Restricted area designations (server rooms, network closets, data centers)
   - After-hours access procedures
3. Visitor Management
   - Visitor registration and badge procedures
   - Escort requirements in restricted areas
   - Visitor log requirements and retention period
   - Contractor and vendor access procedures
4. Server Room and Data Center Controls
   - Entry authorization list and review
   - Environmental monitoring (temperature, humidity, power)
   - Camera and surveillance requirements
5. Physical Media Handling
   - Labeling and classification of physical media containing sensitive data
   - Secure storage requirements
   - Transport procedures for physical media
   - Secure destruction and disposal procedures (certificates of destruction)${isPCI ? `
6. Point-of-Interaction (POI) Device Security
   - Inventory of all POI devices (make, model, serial number, location, assigned user)
   - Procedures for verifying devices have not been tampered with or substituted
   - Training for personnel to identify tampering signs
   - Incident reporting for suspected device tampering
   - Review of POI device inventory at least annually` : ""}
${isPCI ? "7." : "6."} Access Revocation (termination and role change procedures)
${isPCI ? "8." : "7."} Roles and Responsibilities
${isPCI ? "9." : "8."} Annual Review

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [FACILITIES MANAGER], [IT/SECURITY CONTACT] as placeholders${isPCI ? `
- Include a POI Device Inventory table template as an appendix (Req 9.5.1)` : ""}
- Add [NOTE: ...] callouts where site-specific details must be inserted`;
    }
  },
  {
    id: "antimalware",
    title: "Anti-Malware & Endpoint Security Policy",
    icon: "🛡️",
    description: "Anti-malware deployment, endpoint protection standards, and procedures for all systems susceptible to malicious software.",
    regs: [
      { label: "PCI DSS Req 5", note: "Anti-malware on all susceptible systems; current definitions; logs retained; cannot be disabled by users" },
      { label: "FFIEC InfoSec Booklet", note: "Malware protection and endpoint security controls" },
      { label: "GLBA §314.4(d)", note: "Technical safeguards against unauthorized access including malware" },
      { label: "SOC 2 CC6.8", note: "Prevention and detection of unauthorized or malicious software" },
    ],
    prompt: (report) => {
      const isPCI = report.clientType && ["ISO","ISV","Payment Processor","Fintech"].some(t => report.clientType.includes(t));
      return `Write an Anti-Malware and Endpoint Security Policy for ${report.clientName} (${report.clientType}).

REGULATORY REQUIREMENTS THIS POLICY MUST SATISFY:
- FFIEC Information Security Booklet: Malware protection controls; endpoint security as part of information security program
- GLBA §314.4(d): Technical safeguards to protect customer information from malicious software and unauthorized access
- SOC 2 CC6.8: Prevention and detection of unauthorized or malicious software${isPCI ? `
- PCI DSS v4.0 Req 5.2.1: Anti-malware solutions deployed on all system components except those confirmed not susceptible; documented justification required for exclusions
- PCI DSS v4.0 Req 5.2.2: Anti-malware solutions must be kept current, perform periodic scans or continuous behavioral analysis
- PCI DSS v4.0 Req 5.2.3: Systems determined not at risk of malware must be evaluated periodically — risk must be documented
- PCI DSS v4.0 Req 5.3.1: Anti-malware solutions must generate audit logs; logs retained per log retention policy
- PCI DSS v4.0 Req 5.3.2: Anti-malware solutions must not be disabled or altered by users — management console controls required
- PCI DSS v4.0 Req 5.4.1: Phishing-resistant controls required — email security, anti-phishing, user training` : ""}

ASSESSMENT CONTEXT:
System security gaps: ${report.gaps.filter(g => g.domain === "System Security").map(g => g.text).join("; ") || "None identified"}
System security strengths: ${report.strengths.filter(s => s.domain === "System Security").map(s => s.text).join("; ") || "None identified"}

REQUIRED SECTIONS:
1. Purpose, Scope & Regulatory Authority
2. Anti-Malware Deployment Requirements
   - Mandatory deployment on all applicable system types (endpoints, servers, mobile devices)
   - Approved anti-malware solutions list
   - Exclusion process — systems potentially not susceptible (must be documented and reviewed)
3. Anti-Malware Configuration Standards
   - Real-time scanning requirements
   - Definition/signature update frequency
   - Scan scheduling (periodic full scans)
   - Behavioral analysis / heuristic detection settings
4. Management and Enforcement
   - Centralized management console requirements
   - Prohibition on user-initiated disablement
   - Exception process for authorized temporary disablement (requires security team approval and compensating controls)
5. Phishing and Social Engineering Controls
   - Email filtering and anti-phishing controls
   - Attachment and link scanning requirements
   - User reporting procedures for suspected phishing${isPCI ? `
   - PCI DSS Req 5.4.1: Phishing-resistant mechanisms — enumerate required technical controls` : ""}
6. Endpoint Hardening Standards
   - OS hardening baseline requirements
   - Application whitelisting / software restriction policies
   - Removable media controls
7. Logging and Alerting
   - Anti-malware event log requirements
   - Alert thresholds and escalation procedures
   - Log retention (retain per Audit Logging Policy)
8. Incident Response Integration (reference IRP for malware incident procedures)
9. Mobile Device Requirements
10. Roles and Responsibilities
11. Annual Review and Testing

FORMAT REQUIREMENTS:
- This is a TEMPLATE and GUIDE. Include a "How to Use This Template" note at the top.
- Use [INSTITUTION NAME], [DATE], [APPROVED AV/EDR SOLUTION], [IT SECURITY CONTACT] as placeholders
- Include a table of system types and their mandatory anti-malware deployment status
- Add [NOTE: ...] callouts where solution-specific configuration details must be inserted`;
    }
  },
];

function PolicyLibrary({ report }) {
  const [selected, setSelected] = useState(null);
  const [generated, setGenerated] = useState({});
  const [loading, setLoading] = useState(null);

  async function generatePolicy(policy) {
    setSelected(policy.id);
    if (generated[policy.id]) return;
    setLoading(policy.id);
    const prompt = policy.prompt(report);
    try {
      const text = await groundedAICall({
        system: `You are a regulatory compliance attorney and policy writer specializing in financial institution regulations. 
You generate precise, examination-ready policy templates grounded in current regulatory text.
Every section you write must cite the exact regulation that requires it.
Use [INSTITUTION NAME], [DATE], and other placeholders as instructed.
Include [NOTE: ...] callouts where institutions must customize content.
Policies must be complete enough to satisfy an NCUA, FFIEC, NY DFS, GLBA, or PCI DSS examiner or auditor reviewing the document.
For PCI DSS policies, cite the specific Requirement number (e.g., Req 12.1, Req 8.4) and align language to PCI DSS v4.0.`,
        userPrompt: prompt,
        frameworks: Object.keys(report.frameworkScores || {}),
        maxTokens: 1800,
        temperature: 0,
        context: `${policy.title} policy for a ${report.clientType}`
      });
      setGenerated(prev => ({ ...prev, [policy.id]: text }));
    } catch { setGenerated(prev => ({ ...prev, [policy.id]: "Generation failed. Please try again." })); }
    setLoading(null);
  }

  const current = POLICIES.find(p => p.id === selected);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      {/* Policy List */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 16 }}>POLICY LIBRARY · {POLICIES.length} DOCUMENTS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {POLICIES.map(p => {
            const isSelected = selected === p.id;
            const isDone = !!generated[p.id];
            const isLoading = loading === p.id;
            return (
              <button key={p.id} onClick={() => generatePolicy(p)} style={{
                background: isSelected ? `${T.accent}15` : T.surface,
                border: `1px solid ${isSelected ? T.accent : T.border}`,
                borderRadius: 8, padding: "12px 14px", textAlign: "left", cursor: "pointer",
                transition: "all 0.15s"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? T.text : T.textMid, lineHeight: 1.3 }}>{p.title}</div>
                  </div>
                  {isDone && <span style={{ color: T.green, fontSize: 12 }}>✓</span>}
                  {isLoading && <div style={{ width: 12, height: 12, border: `2px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Policy Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected && (
          <Card style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Policy Template Library</div>
            <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
              Select a policy to generate a regulatory-aligned template for {report.clientName}. Each template maps to the exact sections required by the applicable regulations — use it as a structured starting point, then customize to your institution's specifics before board adoption.
            </div>
          </Card>
        )}
        {selected && current && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 8 }}>POLICY DOCUMENT</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>{current.icon} {current.title}</div>
                  <div style={{ fontSize: 13, color: T.textMid, marginBottom: 16 }}>{current.description} <span style={{ color: T.textDim, fontStyle: "italic" }}>Use as a starting point — customize to your institution.</span></div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>REGULATORY CITATIONS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {getRegs(current.id, report.frameworkScores || {}).map((r, i) => (
                  <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{r.note}</div>
                  </div>
                ))}
              </div>
            </Card>

            {loading === selected && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                  <div style={{ width: 18, height: 18, border: `2px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <div style={{ fontSize: 14, color: T.textMid }}>Generating {current.title}... This may take 15-20 seconds.</div>
                </div>
              </Card>
            )}

            {generated[selected] && (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <SectionLabel style={{ marginBottom: 0 }}>Policy Template</SectionLabel>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="success" onClick={() => navigator.clipboard.writeText(generated[selected])}>
                      Copy
                    </Btn>
                    <Btn onClick={() => { setGenerated(prev => { const n = {...prev}; delete n[selected]; return n; }); setLoading(null); }}>
                      Regenerate
                    </Btn>
                  </div>
                </div>
                <div style={{ maxHeight: 560, overflowY: "auto", paddingRight: 8 }}>
                  <MarkdownReport text={generated[selected]} />
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportView({ report, onGeneratePolicy, policyLoading, generatedPolicy, onBack }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [boardReport, setBoardReport] = useState("");
  const [boardLoading, setBoardLoading] = useState(false);
  const { frameworkScores, gaps, strengths, overallScore, clientName, clientType, date } = report;
  const statusColor = overallScore >= 0.75 ? T.green : overallScore >= 0.45 ? T.yellow : T.red;
  const statusLabel = overallScore >= 0.75 ? "Satisfactory" : overallScore >= 0.45 ? "Needs Attention" : "Critical Gaps";
  const tabs = ["summary","gaps","strengths","board","policy","package"];

  async function generateBoardReport() {
    setBoardLoading(true);
    const scopedFrameworks = Object.keys(frameworkScores);
    const criticalGaps = gaps.filter(g => g.frameworks.some(f => scopedFrameworks.includes(f)));
    const fwSummary = Object.entries(frameworkScores).map(([fw, sc]) =>
      `${fw}: ${Math.round(sc*100)}% (${sc >= 0.75 ? "Satisfactory" : sc >= 0.45 ? "Needs Attention" : "Critical Gaps"})`
    ).join(", ");
    try {
      const text = await groundedAICall({
        frameworks: Object.keys(frameworkScores),
        context: "board of directors cybersecurity governance requirements for financial institutions",
        maxTokens: 2000,
        temperature: 0,
        system: `You write plain-English cybersecurity compliance summaries for ${["ISO","ISV","Payment Processor","Fintech"].some(t => clientType.includes(t)) ? "executive leadership and board-level stakeholders at payment technology companies" : "bank and credit union boards of directors"}. No jargon, no acronyms without explanation. Traffic light language (Green/Yellow/Red). Dollar risk framing where relevant. Short sentences. Only reference the specific regulatory frameworks that were assessed — do not mention frameworks that were not in scope. Always end with exactly 3 specific board-level actions with the regulatory section that requires board action. Fetch current regulatory requirements before writing so your board actions cite accurate section numbers. FORMATTING RULES: When using numbered lists, each list item must be a single self-contained sentence or phrase on one line. Never put a paragraph, description, or bullet point on a separate line after a numbered item — fold all content into the list item itself on the same line. Do not break a numbered list with blank lines, prose paragraphs, or bullet points between items. NUMBERED LISTS MUST BE PURELY SEQUENTIAL — no sub-bullets, no nested lists, no bullet points mixed in between numbered items under any circumstances. If you need to add detail to a numbered item, include it inline on the same line after a dash. CRITICAL: When citing regulatory requirements, write only the requirement number and your own plain-English summary of what it requires — do NOT copy or quote any text directly from the source document. Never reproduce document boilerplate, section descriptions, or examples from fetched regulatory text. CAPITALIZATION: Use standard sentence case throughout. Do not capitalize words mid-sentence unless they are proper nouns, acronyms, or regulatory framework names (e.g. PCI DSS, CDE, MFA). Do not capitalize words like Board, Management, Organization, Requirements mid-sentence. COMPLIANCE DEADLINES: Do not cite any specific compliance deadline dates (e.g. "must be compliant by March 31, 2025"). PCI DSS compliance is an ongoing contractual obligation enforced by acquiring banks and payment brands — there is no universal statutory deadline. Version transition dates (such as the PCI DSS v4.0 transition) are not client compliance deadlines and must not be presented as such. LANGUAGE: Never write "Our assessment" — always write "This assessment" instead. Never use first-person plural ("we", "our", "us") when referring to the assessment, findings, or report.`,
        userPrompt: `Write a Board of Directors Cybersecurity & Compliance Summary for ${clientName} (${clientType}).
DATE: ${date} | SCORE: ${Math.round(overallScore*100)}% | STATUS: ${statusLabel.toUpperCase()} | FRAMEWORKS IN SCOPE: ${fwSummary}

LOCKED NUMBERS — COPY THESE EXACTLY, WORD FOR WORD, DO NOT CHANGE ANY NUMBER:
- Critical gaps (controls not in place): ${gaps.filter(g => g.answer === "no").length}
- Partial gaps (controls in progress): ${gaps.filter(g => g.answer !== "no").length}
- Total gaps: ${gaps.length}
- Controls passing: ${strengths.length}
- Total controls assessed: ${gaps.length + strengths.length}
- Overall score: ${Math.round(overallScore*100)}%
- Overall status: ${statusLabel}

LOCKED COLOR THRESHOLDS — USE THESE EXACTLY, DO NOT SUBSTITUTE YOUR OWN:
- GREEN = Satisfactory (75% and above)
- YELLOW = Needs Attention (45%–74%)
- RED = Critical Gaps (below 45%)
The overall status for this engagement is: ${statusLabel} = ${overallScore >= 0.75 ? "GREEN" : overallScore >= 0.45 ? "YELLOW" : "RED"}
Each framework's color must match this same logic applied to its individual score.

RULE: Every number in your response MUST match the locked numbers above exactly. If you write any number that differs from the above, you have made an error. Do not round, estimate, recalculate, or infer any number. Use only the numbers above.

TOP GAPS: ${gaps.filter(g => g.answer === "no").concat(gaps.filter(g => g.answer !== "no")).slice(0,5).map(g => `${g.domain}: ${g.text} (${g.frameworks.filter(f => scopedFrameworks.includes(f)).join(", ")})`).join("; ")}
IMPORTANT: Only reference the frameworks listed above as IN SCOPE. Do not mention NCUA, FFIEC, NY DFS, GLBA, or SOC 2 unless they appear in the FRAMEWORKS IN SCOPE list above.
Sections: (1) Executive Summary — use locked numbers above verbatim (2) Compliance Status by Framework — only the frameworks listed above, with RED/YELLOW/GREEN text status labels per the locked thresholds above (3) Top Risks with regulatory consequence of inaction — only cite in-scope regulations (4) What Has Been Done (5) Board Actions Required - exactly 3, each citing only in-scope regulatory requirements fetched from source.`
      });
      setBoardReport(text);
    } catch { setBoardReport("Generation failed. Please try again."); }
    setBoardLoading(false);
  }

  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:1000 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:8 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer", fontSize:13 }}>← Back</button>
      </div>

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:32, flexWrap:"wrap", gap:16 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em" }}>{clientName}</div>
          <div style={{ fontSize:13, color:T.textDim, marginBottom:10 }}>{clientType} · Assessment {date}</div>
          <Pill label={statusLabel} color={statusColor} />
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          {Object.entries(frameworkScores).map(([fw, sc]) => (
            <Ring key={fw} score={sc} size={64} label={fw.replace("NY ","").replace(" 500","")} />
          ))}
          <Btn variant="ghost" onClick={() => {
            if (activeTab === "board" && boardReport) {
              exportBoardReportPDF(clientName, clientType, date, boardReport, report);
            } else {
              exportGapReportPDF(report);
            }
          }}>↓ Export PDF</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:24, background:T.surface2,
        border:`1px solid ${T.border}`, borderRadius:10, padding:4, width:"fit-content" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding:"8px 20px", borderRadius:8, border:"none", cursor:"pointer",
            background: activeTab===t ? T.accent : "transparent",
            color: activeTab===t ? "#fff" : T.textDim,
            fontSize:12, fontWeight:700, letterSpacing:"0.04em",
            fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize",
            transition:"all 0.15s" }}>
            {t === "policy" ? "Policy Gen" : t === "board" ? "Board Report" : t === "package" ? "📦 Package" : t}
            {t === "gaps" && gaps.length > 0 && (
              <span style={{ marginLeft:6, background:`${T.red}30`, color:T.red,
                padding:"1px 6px", borderRadius:8, fontSize:10 }}>{gaps.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
            {[
              { label:"Overall Score", value:`${Math.round(overallScore*100)}%`, color:statusColor },
              { label:"Gaps Identified", value:gaps.length, color:T.red },
              { label:"Controls Passing", value:strengths.length, color:T.green },
            ].map(k => (
              <Card key={k.label} style={{ textAlign:"center", padding:"22px" }}>
                <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em", marginBottom:8 }}>{k.label.toUpperCase()}</div>
                <div style={{ fontSize:36, fontWeight:800, color:k.color }}>{k.value}</div>
              </Card>
            ))}
          </div>
          <Card>
            <SectionLabel>Framework Coverage</SectionLabel>
            {Object.entries(frameworkScores).map(([fw, sc]) => (
              <div key={fw} style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
                <div style={{ width:100, fontSize:12, fontWeight:600, color:FW_COLOR[fw] }}>{fw}</div>
                <ScoreBar score={sc} width={240} />
                <div style={{ fontSize:12, color:T.textDim, marginLeft:"auto" }}>
                  {sc >= 0.75 ? "✓ Strong" : sc >= 0.45 ? "⚠ Partial" : "✗ Gap"}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Gaps Tab */}
      {activeTab === "gaps" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {gaps.length === 0 && (
            <Card style={{ textAlign:"center", padding:"48px" }}>
              <div style={{ fontSize:24, marginBottom:12 }}>✓</div>
              <div style={{ color:T.green, fontWeight:700 }}>No critical gaps identified</div>
            </Card>
          )}
          {gaps.map((g, i) => {
            const priority = g.answer === "no" ? "HIGH" : "MEDIUM";
            const pc = g.answer === "no" ? T.red : T.yellow;
            return (
              <Card key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                  <div>
                    <Mono style={{ fontSize:10, color:T.accent, fontWeight:700, letterSpacing:"0.1em", display:"block", marginBottom:6 }}>{g.domain}</Mono>
                    <div style={{ fontSize:15, fontWeight:700, color:T.text, lineHeight:1.4 }}>{g.text}</div>
                  </div>
                  <Pill label={`${priority} PRIORITY`} color={pc} />
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
                  {g.frameworks.map(f => <Tag key={f} fw={f} small />)}
                </div>
                {g.followUp && (
                  <div style={{ fontSize:12, color:T.textDim, marginBottom:10, padding:"8px 12px",
                    background:T.surface, borderRadius:6, fontStyle:"italic" }}>
                    Context: {g.followUp}
                  </div>
                )}
                <div style={{ fontSize:13, color:T.textMid, borderTop:`1px solid ${T.border}`, paddingTop:12, lineHeight:1.5 }}>
                  <span style={{ color:T.accent, fontWeight:700, fontSize:10, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em" }}>REMEDIATION · </span>
                  {g.answer === "no"
                    ? `Implement ${g.domain.toLowerCase()} controls. Assign an owner, document in risk register, and set a 90-day remediation target. Evidence of implementation will be required for ${g.frameworks[0]} compliance.`
                    : `Accelerate in-progress ${g.domain.toLowerCase()} work. Ensure evidence is documented and audit-ready. Schedule a follow-up review within 30 days to verify completion.`}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Strengths Tab */}
      {activeTab === "strengths" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {strengths.map((s, i) => (
            <Card key={i} style={{ borderLeft:`3px solid ${T.green}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <span style={{ color:T.green, fontSize:16 }}>✓</span>
                <Mono style={{ fontSize:10, color:T.green, fontWeight:700, letterSpacing:"0.1em" }}>{s.domain.toUpperCase()}</Mono>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:8 }}>{s.text}</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {s.frameworks.map(f => <Tag key={f} fw={f} small />)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Board Report Tab */}
      {activeTab === "board" && (
        <div>
          {!boardReport && !boardLoading && (
            <Card style={{ textAlign:"center", padding:"48px 32px" }}>
              <div style={{ fontSize:32, marginBottom:16 }}>📋</div>
              <div style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Board of Directors Summary</div>
              <div style={{ fontSize:14, color:T.textDim, maxWidth:480, margin:"0 auto 28px",lineHeight:1.7 }}>
                Generate a plain-English compliance summary for the board — traffic light status, regulatory risk framing, and three specific board actions required. Ready to drop into board minutes.
              </div>
              <Btn onClick={generateBoardReport}>Generate Board Report</Btn>
            </Card>
          )}
          {boardLoading && <Card><AIBox text="" loading={true} /></Card>}
          {boardReport && (
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <SectionLabel style={{ marginBottom:2 }}>Board of Directors Summary</SectionLabel>
                  <div style={{ fontSize:12, color:T.textDim }}>{clientName} · {date} · Prepared by Veritaq</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn variant="ghost" onClick={generateBoardReport}>Regenerate</Btn>
                  <Btn variant="ghost" onClick={() => exportBoardReportPDF(clientName, clientType, date, boardReport, report)}>↓ Export PDF</Btn>
                  <Btn variant="success" onClick={() => navigator.clipboard.writeText(boardReport)}>Copy</Btn>
                </div>
              </div>
              <div style={{ maxHeight:560, overflowY:"auto", paddingRight:8 }}>
                <MarkdownReport text={boardReport} />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Policy Tab */}
      {activeTab === "policy" && (
        <PolicyLibrary report={report} />
      )}

      {/* Package Tab */}
      {activeTab === "package" && (
        <div className="fade-in">
          <Card style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.1em", marginBottom:8 }}>ENGAGEMENT DELIVERABLE</div>
                <div style={{ fontSize:20, fontWeight:800, color:T.text, marginBottom:6 }}>📦 Client Engagement Package</div>
                <div style={{ fontSize:13, color:T.textMid, lineHeight:1.6, maxWidth:540 }}>
                  A single combined PDF containing everything your client needs — cover page, board summary, compliance status, gap analysis, and remediation action plan. Ready to send at engagement close.
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, margin:"20px 0", padding:"16px", background:T.surface, borderRadius:10, border:`1px solid ${T.border}` }}>
              {[
                { num:"1", label:"Cover Page", desc:"Client name, score badge, frameworks, package contents" },
                { num:"2", label:"Executive Summary", desc:"Board narrative (generate in Board Report tab first)" },
                { num:"3", label:"Compliance Status", desc:"Framework scores with traffic light bars" },
                { num:"4", label:"Gap Analysis", desc:"All findings prioritized HIGH / MEDIUM with remediation notes" },
                { num:"5", label:"Action Plan", desc:"Remediation roadmap organized by 30/60/90 day timeline" },
                { num:"6", label:"Next Steps", desc:"Follow-up engagement CTA with contact info" },
              ].map(item => (
                <div key={item.num} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:T.accent, color:"#fff", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{item.num}</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{item.label}</div>
                    <div style={{ fontSize:11, color:T.textDim, lineHeight:1.4 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {!boardReport && (
              <div style={{ padding:"12px 16px", background:`${T.yellow}15`, border:`1px solid ${T.yellow}40`, borderRadius:8, marginBottom:16, fontSize:12, color:T.textMid }}>
                ⚠️ <strong>Tip:</strong> Generate the Board Report first for a richer executive summary in the package. The package will still export without it.
              </div>
            )}

            <Btn
              onClick={() => exportEngagementPackagePDF(report, boardReport, null)}
              style={{ width:"100%", padding:"14px", fontSize:14, fontWeight:700 }}
            >
              ↓ Export Engagement Package PDF
            </Btn>
          </Card>

          <Card>
            <SectionLabel>What's Included</SectionLabel>
            <div style={{ fontSize:13, color:T.textMid, lineHeight:1.8 }}>
              The package does <strong>not</strong> include policy templates — these are typically delivered as a separate follow-on document or as part of a policy development engagement. If your client requests policies, export them individually from the Policy Gen tab.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── KNOWLEDGE VIEW ───────────────────────────────────────────────────────────
function KnowledgeView({ query, setQuery, answer, loading, onSearch }) {
  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:860 }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>Knowledge Base</div>
        <div style={{ color:T.textDim, fontSize:14 }}>Search regulatory text and get AI-cited answers across all frameworks</div>
      </div>

      <Card style={{ marginBottom:24 }}>
        <SectionLabel>Ask a Compliance Question</SectionLabel>
        <div style={{ display:"flex", gap:12 }}>
          <input
            style={{ flex:1, padding:"12px 16px", background:T.surface, border:`1px solid ${T.border}`,
              borderRadius:8, color:T.text, fontSize:14, outline:"none" }}
            placeholder="e.g. What are the MFA requirements under NY DFS 500?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && query && onSearch(query)}
          />
          <Btn onClick={() => onSearch(query)} disabled={!query || loading}>
            {loading ? "Searching..." : "Ask →"}
          </Btn>
        </div>
      </Card>

      {(loading || answer) && (
        <Card style={{ marginBottom:24 }}>
          <SectionLabel>AI Answer</SectionLabel>
          <AIBox text={answer} loading={loading} />
        </Card>
      )}

      <Card>
        <SectionLabel>Regulatory Knowledge Index</SectionLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {KNOWLEDGE.map(k => (
            <div key={k.id} style={{ padding:"14px 16px", background:T.surface, borderRadius:8,
              border:`1px solid ${T.border}`, cursor:"pointer" }}
              onClick={() => { setQuery(`Explain ${k.title} under ${k.fw}`); onSearch(`Explain ${k.title} under ${k.fw} and its cross-framework implications`); }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:6 }}>
                <Tag fw={k.fw} small />
                <Mono style={{ fontSize:10, color:T.textDim }}>{k.section}</Mono>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{k.title}</div>
              </div>
              <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>{k.text.substring(0,120)}...</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── MONITORING VIEW ──────────────────────────────────────────────────────────
function MonitoringView({ alerts, clients, loading, onDismiss, onTriage }) {
  const [triageResults, setTriageResults] = useState({});
  const open = alerts.filter(a => a.status === "open");
  const dismissed = alerts.filter(a => a.status === "dismissed");

  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:900 }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>
          Continuous Monitoring
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ color:T.textDim, fontSize:14 }}>Real-time control drift detection across all client environments</div>
          <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.08em", background:T.yellow+"22", color:T.yellow, border:`1px solid ${T.yellow}55`, borderRadius:4, padding:"2px 8px", whiteSpace:"nowrap" }}>SAMPLE DATA</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:32 }}>
        {[
          { label:"Open Alerts", value:open.length, color:open.length>3?T.red:T.yellow },
          { label:"High Severity", value:open.filter(a=>a.severity==="HIGH").length, color:T.red },
          { label:"Dismissed", value:dismissed.length, color:T.green },
        ].map(k => (
          <Card key={k.label} style={{ padding:"18px 22px" }}>
            <div style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em", marginBottom:8 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize:28, fontWeight:800, color:k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionLabel>Active Alerts</SectionLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {open.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px", color:T.textDim, fontSize:13 }}>
              ✓ All clear — no active alerts
            </div>
          )}
          {open.map(a => {
            const client = clients.find(c => c.id === a.clientId);
            const sevColor = a.severity==="HIGH" ? T.red : a.severity==="MEDIUM" ? T.yellow : T.textDim;
            const triage = triageResults[a.id];
            return (
              <div key={a.id} style={{ background:T.surface, border:`1px solid ${T.border}`,
                borderLeft:`3px solid ${sevColor}`, borderRadius:10, padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                      <Pill label={a.severity} color={sevColor} />
                      <Mono style={{ fontSize:10, color:T.textDim }}>{a.domain}</Mono>
                      <Mono style={{ fontSize:10, color:T.textDim }}>· {a.time}</Mono>
                    </div>
                    <div style={{ fontSize:14, color:T.text, lineHeight:1.5, marginBottom:6 }}>{a.text}</div>
                    <div style={{ fontSize:12, color:T.textDim, marginBottom:8 }}>{client?.name}</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {a.fw.map(f => <Tag key={f} fw={f} small />)}
                    </div>
                  </div>
                </div>
                {triage && (
                  <div style={{ marginTop:10 }}>
                    <AIBox text={triage} loading={loading} />
                  </div>
                )}
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <Btn variant="ghost" style={{ fontSize:11, padding:"7px 14px" }}
                    onClick={() => onTriage(a, (text) => setTriageResults(r => ({...r, [a.id]:text})))}>
                    AI Triage
                  </Btn>
                  <Btn variant="danger" style={{ fontSize:11, padding:"7px 14px" }} onClick={() => onDismiss(a.id)}>
                    Dismiss
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function ClientsView({ clients, savedReports, onStartAssessment, onViewReport }) {
  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:900 }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>Client Roster</div>
        <div style={{ color:T.textDim, fontSize:14 }}>{clients.length} clients under active management</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {clients.map(c => {
          const report = savedReports.find(r => r.clientId === c.id);
          const sc = c.score;
          return (
            <Card key={c.id}>
              <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ width:48, height:48, borderRadius:12, background:`${T.accent}18`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:20, fontWeight:800, color:T.accent, flexShrink:0 }}>
                  {c.name[0]}
                </div>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{c.name}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{c.type} · {c.employees} employees</div>
                  <div style={{ fontSize:11, color:T.textDim, marginTop:2, fontFamily:"'IBM Plex Mono', monospace" }}>
                    {c.lastAssessment ? `Last assessed: ${c.lastAssessment}` : "Not yet assessed"}
                  </div>
                </div>
                {sc != null && (
                  <div style={{ textAlign:"center" }}>
                    <Ring score={sc} size={68} />
                  </div>
                )}
                <Pill label={c.tier} color={c.tier==="Premium" ? T.purple : T.accent} />
                <div style={{ display:"flex", gap:8 }}>
                  {report && <Btn variant="ghost" onClick={() => onViewReport(report)}>View Report</Btn>}
                  <Btn onClick={() => onStartAssessment(c)}>
                    {c.lastAssessment ? "Re-assess" : "Assess Now"}
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── SOC 2 TSC CRITERION MAP ──────────────────────────────────────────────────
// Each question ID appears in exactly ONE criterion — no double-counting.
// Assignment rationale:
//   ciso        → CC1  (board/management oversight is the control environment)
//   board_rep   → CC1  (board reporting is control environment, not comms infrastructure)
//   training    → CC1  (competence/awareness is a CC1 entity-level control)
//   risk_assess → CC3  (risk assessment is the primary CC3 activity)
//   pentest     → CC3  (pen testing is a risk assessment/monitoring activity)
//   logging     → CC4  (log review is the monitoring activity; CC4 owns detection)
//   patch       → CC5  (patch mgmt is a control activity)
//   ffiec_change_mgmt → CC8 (change management is definitionally CC8)
//   mfa         → CC6  (logical access controls are the primary CC6 subject)
//   access_rev  → CC6  (access reviews are CC6.2 specifically)
//   ffiec_network_seg → CC6 (network segmentation is CC6.6)
//   ir_plan     → CC7  (incident response is CC7.3)
//   vendor      → CC9  (vendor risk mitigation is CC9.2)
//   encrypt     → CC9  (encryption is a risk mitigation control — CC9.1)
//   bcdr        → A1   (availability/recovery is the A1 Trust Service Criterion)
// CC2 has no mapped questions — drops out of scoring via the total > 0 gate.
const SOC2_CRITERIA_MAP = {
  "CC1": ["ciso", "board_rep", "training"],
  "CC2": [],
  "CC3": ["risk_assess", "pentest"],
  "CC4": ["logging"],
  "CC5": ["patch"],
  "CC6": ["mfa", "access_rev", "ffiec_network_seg"],
  "CC7": ["ir_plan"],
  "CC8": ["ffiec_change_mgmt"],
  "CC9": ["vendor", "encrypt"],
  "A1":  ["bcdr"],
};

// ─── COMPUTE REPORT ───────────────────────────────────────────────────────────
function computeReport(answers, client, questions) {
  const allFW = ["NY DFS 500","FFIEC","GLBA","SOC 2","NCUA","PCI DSS"];
  const frameworkScores = {};
  const gaps = [], strengths = [];

  allFW.forEach(fw => {
    if (fw === "SOC 2") {
      // SOC 2: score by TSC criterion (one question per criterion max),
      // then average across criteria with at least one answered question.
      // This prevents weighted-average variance from uneven question distribution.
      const soc2Questions = (questions||[]).filter(q => q.frameworks.includes("SOC 2"));
      const anyAnswered = soc2Questions.some(q => {
        const ans = answers[q.id];
        return ans && ans.value !== "na";
      });
      if (!anyAnswered) return;

      const criterionScores = [];
      Object.values(SOC2_CRITERIA_MAP).forEach(qids => {
        let earned = 0, total = 0;
        qids.forEach(qid => {
          const ans = answers[qid];
          if (!ans || ans.value === "na") return;
          const opt = ANSWER_OPTIONS.find(o => o.value === ans.value);
          if (opt?.score != null) { total += 1; earned += opt.score; }
        });
        if (total > 0) criterionScores.push(earned / total);
      });

      if (criterionScores.length > 0)
        frameworkScores["SOC 2"] = criterionScores.reduce((a,b) => a+b, 0) / criterionScores.length;
      return;
    }

    // All other frameworks: weighted average
    const applicable = (questions||[]).filter(q => q.frameworks.includes(fw));
    let earned = 0, total = 0;
    applicable.forEach(q => {
      const ans = answers[q.id];
      if (!ans || ans.value === "na") return;
      const opt = ANSWER_OPTIONS.find(o => o.value === ans.value);
      if (opt?.score != null) { total += q.weight; earned += opt.score * q.weight; }
    });
    if (total > 0) frameworkScores[fw] = earned / total;
  });

  const seen = new Set();
  (questions||[]).forEach(q => {
    const ans = answers[q.id];
    if (!ans || ans.value === "na") return;
    if (ans.value === "yes") {
      if (!seen.has(q.id+"s")) {
        seen.add(q.id+"s");
        strengths.push({ domain:q.domain, text:q.text, frameworks:q.frameworks });
      }
    } else if (!seen.has(q.id+"g")) {
      seen.add(q.id+"g");
      gaps.push({ domain:q.domain, text:q.text, frameworks:q.frameworks, answer:ans.value, followUp:ans.followUp||"" });
    }
  });

  const scoredValues = Object.values(frameworkScores);
  const overallScore = scoredValues.length > 0
    ? scoredValues.reduce((a,b) => a+b, 0) / scoredValues.length
    : 0;

  return {
    clientId: client?.id, clientName: client?.name, clientType: client?.type,
    date: new Date().toISOString().split("T")[0],
    frameworkScores, gaps, strengths, overallScore,
    answers,
  };
}

// ─── AI FUNCTIONS ─────────────────────────────────────────────────────────────
async function searchKnowledge(query, setLoading, setAnswer) {
  setLoading(true); setAnswer("");
  const q = query.toLowerCase();

  // Score each knowledge entry by relevance using structure only (no static text)
  const scored = KNOWLEDGE.map(k => {
    let score = 0;
    const target = `${k.fw} ${k.section} ${k.title}`.toLowerCase();
    if (target.includes(q)) score += 10;
    q.split(/\s+/).forEach(word => {
      if (word.length < 3) return;
      if (target.includes(word)) score += 1;
      if (k.title.toLowerCase().includes(word)) score += 2;
      if (k.fw.toLowerCase().includes(word)) score += 3;
    });
    if ((q.includes("ncua") || q.includes("credit union")) && k.fw === "NCUA") score += 5;
    if ((q.includes("glba") || q.includes("gramm")) && k.fw === "GLBA") score += 5;
    if ((q.includes("ffiec") || q.includes("bank")) && k.fw === "FFIEC") score += 5;
    if ((q.includes("dfs") || q.includes("new york") || q.includes("500")) && k.fw === "NY DFS 500") score += 5;
    if ((q.includes("soc") || q.includes("soc 2") || q.includes("aicpa")) && k.fw === "SOC 2") score += 5;
    if ((q.includes("pci") || q.includes("payment card") || q.includes("cardholder") || q.includes("saq") || q.includes("qsa") || q.includes("asv")) && k.fw === "PCI DSS") score += 5;
    if ((q.includes("differ") || q.includes("vs") || q.includes("compare")) && k.title.toLowerCase().includes("differ")) score += 8;
    if ((q.includes("incident") || q.includes("breach") || q.includes("notification")) && k.title.toLowerCase().includes("incident")) score += 4;
    if ((q.includes("vendor") || q.includes("third") || q.includes("tprm")) && k.title.toLowerCase().includes("third")) score += 4;
    if ((q.includes("mfa") || q.includes("multi-factor") || q.includes("authentication")) && k.title.toLowerCase().includes("auth")) score += 4;
    if ((q.includes("patch") || q.includes("vuln") || q.includes("scan")) && k.title.toLowerCase().includes("patch")) score += 4;
    if ((q.includes("bcp") || q.includes("continuity") || q.includes("disaster")) && k.title.toLowerCase().includes("business contin")) score += 4;
    return { ...k, score };
  }).filter(k => k.score > 0).sort((a,b) => b.score - a.score);

  // Build a structural index (section numbers + titles only) to guide the live fetch
  const toUse = scored.slice(0, 8).length > 0 ? scored.slice(0, 8) : KNOWLEDGE.slice(0, 8);
  const index = toUse.map(k => `[${k.fw} | ${k.section}] ${k.title}`).join("\n");

  // Detect which frameworks are relevant so grounding fetches the right sources
  const frameworks = [...new Set(toUse.map(k => k.fw))];

  try {
    // Use groundedAICall so the answer is fetched live from authoritative regulatory sources
    const answer = await groundedAICall({
      system: `You are a regulatory compliance expert specializing in financial institution regulations: GLBA, NCUA, FFIEC, NY DFS Part 500, and SOC 2. Answer questions by fetching and reading the current text of the actual regulations — never rely on memory alone. Cite exact section numbers. Be direct and practical. 4-6 sentences.`,
      userPrompt: `RELEVANT REGULATORY SECTIONS (for reference):\n${index}\n\n---\n\nQUESTION: ${query}\n\nFetch the current regulatory text from the authoritative sources, then answer with specific citations. Answer in 4-6 sentences.`,
      frameworks,
      maxTokens: 700
    });
    setAnswer(answer);
  } catch { setAnswer("Search failed. Please try again."); }
  setLoading(false);
}

async function generatePolicy(report, setLoading, setGenerated, cb) {
  setLoading(true); setGenerated("");
  const gapList = report.gaps.map(g => `- ${g.domain}: ${g.text} (${g.answer})`).join("\n");
  const strengthList = report.strengths.map(s => `- ${s.domain}: ${s.text}`).join("\n");
  try {
    const text = await groundedAICall({
      frameworks: ["FFIEC", "NY DFS 500", "GLBA", "NCUA"],
      context: "information security policy requirements for financial institutions",
      maxTokens: 1000,
      temperature: 0,
      system: `You are a compliance attorney and policy writer for community financial institutions. Every section must cite the exact regulation and section number that requires it. Fetch and verify all citations from live source documents before writing.`,
      userPrompt: `Write an Information Security Policy for ${report.clientName} (${report.clientType}). Score: ${Math.round(report.overallScore*100)}%.\nGAPS:\n${gapList}\nCONTROLS IN PLACE:\n${strengthList}\nSections: Purpose, Scope, Access Controls, Data Protection, Incident Response, Vendor Management, Training, Governance. Each section 2-3 sentences with exact citations fetched from source docs (e.g., 23 NYCRR §500.7, FFIEC IS Booklet Section III.C).`
    });
    setGenerated(text);
    cb && cb(text);
  } catch { setGenerated("Policy generation failed. Please try again."); }
  setLoading(false);
}

async function triageAlert(alert, clients, setLoading, cb) {
  setLoading(true);
  const client = clients.find(c => c.id === alert.clientId);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{ "Content-Type":"application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:150,
        messages:[{ role:"user", content:
          `Compliance alert for ${client?.name} (${client?.type}): "${alert.text}"
Frameworks: ${alert.fw.join(", ")}. Severity: ${alert.severity}.
Give 2 sentences: (1) exact regulatory exposure, (2) specific immediate action. Be direct.` }]
      })
    });
    const d = await resp.json();
    cb(d.content?.[0]?.text || "");
  } catch { cb("Triage failed."); }
  setLoading(false);
}

// ─── POLICY REVIEW VIEW ───────────────────────────────────────────────────────
function PolicyReviewView() {
  const [files, setFiles] = useState([]);
  const [fileTexts, setFileTexts] = useState({});
  const [selectedFrameworks, setSelectedFrameworks] = useState(["NCUA","FFIEC","NY DFS 500","GLBA"]);
  const [institutionType, setInstitutionType] = useState("Credit Union");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("gaps");
  const [dragOver, setDragOver] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [generatedPolicies, setGeneratedPolicies] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [policyFwFilter, setPolicyFwFilter] = useState(null);
  const fileRef = useRef(null);

  const ALL_FRAMEWORKS = ["NCUA","FFIEC","NY DFS 500","GLBA","SOC 2","PCI DSS"];
  const INST_TYPES = ["Credit Union","Community Bank","Insurance Co.","ISO","ISV","Payment Processor","Fintech","Other Financial Institution"];

  function toggleFramework(fw) {
    setSelectedFrameworks(prev =>
      prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]
    );
  }

  async function readFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve("");
      reader.readAsText(file);
    });
  }

  async function handleFiles(newFiles) {
    const arr = Array.from(newFiles).filter(f =>
      f.type === "text/plain" ||
      f.name.endsWith(".txt") ||
      f.name.endsWith(".md") ||
      f.name.endsWith(".doc") ||
      f.name.endsWith(".docx") ||
      f.type === "application/pdf" ||
      f.type.includes("text")
    );
    if (!arr.length) return;
    const texts = {};
    for (const f of arr) {
      texts[f.name] = await readFile(f);
    }
    setFiles(prev => {
      const existing = prev.map(f => f.name);
      return [...prev, ...arr.filter(f => !existing.includes(f.name))];
    });
    setFileTexts(prev => ({ ...prev, ...texts }));
    setResults(null);
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name));
    setFileTexts(prev => { const n = {...prev}; delete n[name]; return n; });
    setResults(null);
  }

  async function runReview() {
    if (!files.length || !selectedFrameworks.length) return;
    setLoading(true);
    setResults(null);

    // Combine uploaded policy text
    const combinedText = files.map(f => {
      const raw = fileTexts[f.name] || "[Binary file — analyzing filename and structure only]";
      const truncated = raw.length > 3000 ? raw.substring(0, 3000) + "\n[... truncated ...]" : raw;
      return "=== DOCUMENT: " + f.name + " ===\n" + truncated;
    }).join("\n\n").substring(0, 8000);

    // Pull relevant requirements from static KNOWLEDGE — versioned, reliable, no token bloat
    const relevantKnowledge = KNOWLEDGE
      .filter(k => selectedFrameworks.includes(k.fw))
      .map(k => "[" + k.fw + " | " + k.section + "] " + k.title + ": " + k.text)
      .join("\n\n");

    const systemPrompt = "You are a senior regulatory examiner conducting a policy suite review for a " + institutionType + ". Analyze the uploaded policy documents against the regulatory requirements provided and produce an examiner-ready gap analysis. You approach this exactly as an NCUA, FFIEC, or NY DFS examiner would — checking not just whether a policy exists, but whether it contains all required elements, is specific enough to be enforceable, and would satisfy examiner scrutiny. Respond ONLY in valid JSON — no preamble, no markdown fences:\n{\n  \"summary\": \"2-3 sentence overall assessment\",\n  \"overallRating\": \"Strong\" | \"Adequate\" | \"Needs Work\" | \"Critical Gaps\",\n  \"coverageScore\": <number 0-100>,\n  \"gaps\": [{ \"severity\": \"HIGH\" | \"MEDIUM\" | \"LOW\", \"framework\": \"<framework>\", \"citation\": \"<exact section>\", \"requirement\": \"<what is required>\", \"finding\": \"<what is missing>\", \"examinerNote\": \"<examiner finding language>\" }],\n  \"present\": [{ \"framework\": \"<fw>\", \"citation\": \"<section>\", \"element\": \"<requirement met>\", \"location\": \"<which document>\" }],\n  \"recommendations\": [{ \"priority\": \"Immediate\" | \"30 Days\" | \"90 Days\", \"action\": \"<action>\", \"rationale\": \"<why it matters to an examiner>\" }]\n}";

    const userPrompt = "REGULATORY REQUIREMENTS:\n" + relevantKnowledge + "\n\n---\n\nUPLOADED POLICY DOCUMENTS:\n" + combinedText + "\n\n---\n\nINSTITUTION TYPE: " + institutionType + "\nFRAMEWORKS IN SCOPE: " + selectedFrameworks.join(", ") + "\n\nFor each gap cite the EXACT regulatory section and explain what is missing. For each present element note which document contains it. Return ONLY valid JSON.";

    try {
      const makeCall = async () => fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      let resp = await makeCall();
      if (resp.status === 429) {
        await new Promise(r => setTimeout(r, 8000));
        resp = await makeCall();
      }
      if (!resp.ok) {
        let errBody = "";
        try { errBody = await resp.text(); } catch {}
        throw new Error("API " + resp.status + ": " + errBody.substring(0, 200));
      }
      const data = await resp.json();
      const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON found: " + raw.substring(0, 200));
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      setResults(parsed);
      setActiveTab("gaps");
      setGeneratedPolicies(null);
    } catch (e) {
      setResults({ error: "Error: " + e.message });
    }
    setLoading(false);
  }

  async function generatePolicyTemplates(fwFilter) {
    if (!results?.gaps?.length) return;
    setPolicyLoading(true);
    setGeneratedPolicies(null);
    setActiveTab("policies");

    const gaps = results.gaps.filter(g =>
      (g.severity === "HIGH" || g.severity === "MEDIUM") &&
      (!fwFilter || g.framework === fwFilter)
    );

    if (!gaps.length) {
      setGeneratedPolicies([{ error: "No HIGH or MEDIUM gaps found for the selected framework." }]);
      setPolicyLoading(false);
      return;
    }

    const relevantKnowledge = KNOWLEDGE
      .filter(k => fwFilter ? k.fw === fwFilter : selectedFrameworks.includes(k.fw))
      .map(k => "[" + k.fw + " | " + k.section + "] " + k.title + ": " + k.text)
      .join("\n\n");

    const systemPrompt = `You are a senior regulatory compliance attorney and former FFIEC/NCUA examiner.
Draft the MINIMUM number of board-approvable policy documents needed to close ALL identified gaps for a ${institutionType}.

GROUPING RULES:
- Group related gaps into a single policy wherever logical (e.g. all access control gaps into one Access Control Policy, all IR gaps into one IRP, all vendor gaps into one TPRM Policy)
- Do NOT create one policy per gap — consolidate intelligently by topic
- A single policy can satisfy gaps across multiple frameworks if requirements overlap
- Aim for 2-5 policies total regardless of how many gaps exist
- Every gap must be assigned to exactly one policy

POLICY LANGUAGE FORMAT — each policyLanguage field must be a structured policy document using these exact section headers on their own lines:
1. PURPOSE
2. SCOPE
3. BACKGROUND
4. POLICY REQUIREMENTS
5. ROLES AND RESPONSIBILITIES
6. COMPLIANCE AND ENFORCEMENT
7. REVIEW AND REVISION

Use plain text section headers in ALL CAPS followed by a newline and the section content. Do not use markdown. Each section should be 2-5 sentences. Total 350-500 words. Use placeholders [INSTITUTION NAME], [BOARD APPROVAL DATE], [EFFECTIVE DATE], [POLICY OWNER TITLE] where appropriate. Cite the exact regulatory sections satisfied within the BACKGROUND or POLICY REQUIREMENTS section.

Respond ONLY in valid JSON, no preamble, no markdown fences:
{"policies":[{
  "title":"<Policy Name>",
  "frameworks":["<fw1>","<fw2>"],
  "citations":["<section1>","<section2>"],
  "severity":"HIGH|MEDIUM",
  "purpose":"<1-2 sentences>",
  "scope":"<who and what this covers>",
  "owner":"<role>",
  "reviewFrequency":"<Annual|Quarterly|etc>",
  "gapsClosed":[{"framework":"<fw>","citation":"<section>","requirement":"<brief description>"}],
  "policyLanguage":"<structured policy document with labeled sections as described above>",
  "examinerNote":"<what an examiner would conclude upon reviewing this policy>"
}]}`;

    const userPrompt = `INSTITUTION: ${institutionType}
FRAMEWORK FILTER: ${fwFilter || selectedFrameworks.join(", ")}

REGULATORY REQUIREMENTS:
${relevantKnowledge}

ALL GAPS TO CLOSE (${gaps.length} total — group into minimum logical policies):
${gaps.map((g, i) => `${i+1}. [${g.severity}] ${g.framework} ${g.citation} — ${g.requirement}
   Missing: ${g.finding}`).join("\n\n")}

Group related gaps. Every gap above must be assigned to exactly one policy. Return ONLY valid JSON.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });
      if (!resp.ok) throw new Error("API " + resp.status);
      const data = await resp.json();
      const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON found in response");
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      setGeneratedPolicies(parsed.policies || []);
    } catch (e) {
      setGeneratedPolicies([{ error: "Generation failed: " + e.message }]);
    }
    setPolicyLoading(false);
  }


  const ratingColor = results ? (
    results.overallRating === "Strong" ? T.green :
    results.overallRating === "Adequate" ? T.accent :
    results.overallRating === "Needs Work" ? T.yellow : T.red
  ) : T.textDim;

  const highGaps = results?.gaps?.filter(g => g.severity === "HIGH") || [];
  const medGaps  = results?.gaps?.filter(g => g.severity === "MEDIUM") || [];
  const lowGaps  = results?.gaps?.filter(g => g.severity === "LOW") || [];

  return (
    <div className="fade-in" style={{ padding:"40px 48px", maxWidth:1000 }}>
      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>
          Policy Review
        </div>
        <div style={{ color:T.textDim, fontSize:14 }}>
          Upload a client's existing policy suite — get an examiner-ready gap analysis against actual regulatory requirements
        </div>
      </div>

      {/* Config Panel */}
      {!results && (
        <Card style={{ marginBottom:24 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
            {/* Left — Upload */}
            <div>
              <SectionLabel>Upload Policy Documents</SectionLabel>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? T.accent : T.border2}`,
                  borderRadius:10, padding:"28px 20px", textAlign:"center",
                  cursor:"pointer", background: dragOver ? `${T.accent}08` : T.surface,
                  transition:"all 0.15s", marginBottom:16
                }}>
                <input ref={fileRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,text/*"
                  style={{ display:"none" }} onChange={e => handleFiles(e.target.files)} />
                <div style={{ fontSize:24, marginBottom:8 }}>⬆</div>
                <div style={{ fontSize:13, fontWeight:600, color:T.textMid, marginBottom:4 }}>
                  Drop policy files here or click to browse
                </div>
                <div style={{ fontSize:11, color:T.textDim }}>
                  .txt, .md, .doc, .docx, .pdf supported
                </div>
              </div>

              {files.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {files.map(f => (
                    <div key={f.name} style={{
                      display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                      background:T.surface, border:`1px solid ${T.border}`, borderRadius:7
                    }}>
                      <span style={{ fontSize:14 }}>📄</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                        <div style={{ fontSize:10, color:T.textDim }}>{(f.size/1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => removeFile(f.name)} style={{
                        background:"none", border:"none", color:T.textDim, cursor:"pointer",
                        fontSize:14, padding:"2px 6px", borderRadius:4
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — Config */}
            <div>
              <SectionLabel>Institution Type</SectionLabel>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:24 }}>
                {INST_TYPES.map(t => (
                  <button key={t} onClick={() => setInstitutionType(t)} style={{
                    padding:"7px 14px", borderRadius:6, border:`1px solid ${institutionType===t ? T.accent : T.border}`,
                    background: institutionType===t ? `${T.accent}18` : T.surface,
                    color: institutionType===t ? T.text : T.textDim,
                    fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s"
                  }}>{t}</button>
                ))}
              </div>

              <SectionLabel>Frameworks to Evaluate Against</SectionLabel>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:28 }}>
                {ALL_FRAMEWORKS.map(fw => {
                  const on = selectedFrameworks.includes(fw);
                  const c = FW_COLOR[fw] || T.accent;
                  return (
                    <button key={fw} onClick={() => toggleFramework(fw)} style={{
                      padding:"7px 14px", borderRadius:6,
                      border:`1px solid ${on ? c : T.border}`,
                      background: on ? `${c}18` : T.surface,
                      color: on ? c : T.textDim,
                      fontSize:11, fontWeight:700, cursor:"pointer",
                      fontFamily:"'IBM Plex Mono', monospace",
                      letterSpacing:"0.04em", transition:"all 0.15s"
                    }}>{fw}</button>
                  );
                })}
              </div>

              <Btn
                onClick={runReview}
                disabled={!files.length || !selectedFrameworks.length || loading}
                style={{ width:"100%", padding:"14px", fontSize:14 }}>
                {loading ? "Analyzing policies..." : `Run Examiner Review →`}
              </Btn>
              {loading && (
                <div style={{ marginTop:12, fontSize:11, color:T.textDim, textAlign:"center",
                  fontFamily:"'IBM Plex Mono', monospace" }}>
                  Fetching live regulatory requirements · Comparing against uploaded policies...
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {results && !results.error && (
        <>
          {/* Score Banner */}
          <div style={{
            background: T.surface, border:`1px solid ${T.border}`,
            borderLeft:`4px solid ${ratingColor}`,
            borderRadius:12, padding:"24px 28px", marginBottom:24,
            display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16
          }}>
            <div>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em", marginBottom:6 }}>
                EXAMINER REVIEW · {files.map(f=>f.name).join(", ")}
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:T.text, marginBottom:6 }}>
                {results.overallRating}
              </div>
              <div style={{ fontSize:13, color:T.textMid, maxWidth:560, lineHeight:1.6 }}>
                {results.summary}
              </div>
            </div>
            <div style={{ display:"flex", gap:24, alignItems:"center", flexShrink:0 }}>
              <div style={{ textAlign:"center" }}>
                <Ring score={(results.coverageScore||0)/100} size={80} />
                <div style={{ fontSize:10, color:T.textDim, marginTop:4, fontFamily:"'IBM Plex Mono', monospace" }}>COVERAGE</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { label:"HIGH", count:highGaps.length, color:T.red },
                  { label:"MEDIUM", count:medGaps.length, color:T.yellow },
                  { label:"LOW", count:lowGaps.length, color:T.textDim },
                  { label:"PRESENT", count:results.present?.length||0, color:T.green },
                ].map(s => (
                  <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Mono style={{ fontSize:9, color:s.color, fontWeight:700, width:48 }}>{s.label}</Mono>
                    <div style={{ fontSize:18, fontWeight:800, color:s.color, width:28, textAlign:"right" }}>{s.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, alignSelf:"flex-start" }}>
              <Btn variant="ghost"
                onClick={() => exportPolicyReviewPDF(
                  files.map(f => f.name.replace(/\.[^/.]+$/, "")).join(", "),
                  institutionType,
                  selectedFrameworks,
                  results
                )}>
                ↓ Export PDF
              </Btn>
              <Btn
                onClick={() => generatePolicyTemplates(policyFwFilter)}
                disabled={policyLoading}
                style={{ fontSize:12, padding:"8px 16px", background: policyLoading ? T.accentDim : T.purple }}>
                {policyLoading ? "Generating..." : "✦ Generate Policy Templates"}
              </Btn>
              <Btn variant="ghost"
                onClick={() => { setResults(null); setFiles([]); setFileTexts({}); setGeneratedPolicies(null); }}>
                ← New Review
              </Btn>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:2, marginBottom:24, background:T.surface2,
            border:`1px solid ${T.border}`, borderRadius:10, padding:4, width:"fit-content" }}>
            {[
              { id:"gaps", label:`Gaps (${(results.gaps||[]).length})` },
              { id:"present", label:`Present (${(results.present||[]).length})` },
              { id:"recommendations", label:"Action Plan" },
              { id:"policies", label: generatedPolicies ? `Policy Templates (${generatedPolicies.length})` : "Policy Templates", accent: true },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer",
                background: activeTab===t.id ? (t.accent ? T.purple : T.accent) : "transparent",
                color: activeTab===t.id ? "#fff" : t.accent ? T.purple : T.textDim,
                fontSize:12, fontWeight:700, fontFamily:"'Plus Jakarta Sans', sans-serif",
                transition:"all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>

          {/* Gaps Tab */}
          {activeTab === "gaps" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {(results.gaps||[]).length === 0 && (
                <Card style={{ textAlign:"center", padding:"48px" }}>
                  <div style={{ fontSize:24, marginBottom:12, color:T.green }}>✓</div>
                  <div style={{ fontWeight:700, color:T.green }}>No gaps identified across selected frameworks</div>
                </Card>
              )}
              {(results.gaps||[]).map((g, i) => {
                const sevColor = g.severity==="HIGH" ? T.red : g.severity==="MEDIUM" ? T.yellow : T.textDim;
                const fwColor = FW_COLOR[g.framework] || T.accent;
                return (
                  <Card key={i} style={{ borderLeft:`3px solid ${sevColor}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                        <Pill label={g.severity} color={sevColor} />
                        <Tag fw={g.framework} small />
                        <Mono style={{ fontSize:10, color:fwColor, fontWeight:700 }}>{g.citation}</Mono>
                      </div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:8, lineHeight:1.4 }}>
                      {g.requirement}
                    </div>
                    <div style={{ fontSize:13, color:T.textMid, marginBottom:12, lineHeight:1.6 }}>
                      {g.finding}
                    </div>
                    <div style={{
                      background:`${T.red}08`, border:`1px solid ${T.red}20`,
                      borderRadius:6, padding:"10px 14px"
                    }}>
                      <Mono style={{ fontSize:9, color:T.red, fontWeight:700, letterSpacing:"0.1em", display:"block", marginBottom:4 }}>
                        EXAMINER FINDING
                      </Mono>
                      <div style={{ fontSize:12, color:T.textMid, lineHeight:1.6, fontStyle:"italic" }}>
                        "{g.examinerNote}"
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Present Tab */}
          {activeTab === "present" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(results.present||[]).length === 0 && (
                <Card style={{ textAlign:"center", padding:"48px" }}>
                  <div style={{ fontSize:13, color:T.textDim }}>No required elements were found in the uploaded documents.</div>
                </Card>
              )}
              {(results.present||[]).map((p, i) => (
                <Card key={i} style={{ borderLeft:`3px solid ${T.green}`, padding:"16px 20px" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ color:T.green, fontSize:14 }}>✓</span>
                    <Tag fw={p.framework} small />
                    <Mono style={{ fontSize:10, color:FW_COLOR[p.framework]||T.accent, fontWeight:700 }}>{p.citation}</Mono>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{p.element}</div>
                  <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace" }}>
                    Found in: {p.location}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === "recommendations" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {(results.recommendations||[]).length === 0 && (
                <Card style={{ textAlign:"center", padding:"48px" }}>
                  <div style={{ fontSize:13, color:T.textDim }}>No recommendations generated.</div>
                </Card>
              )}
              {(results.recommendations||[]).map((r, i) => {
                const pc = r.priority==="Immediate" ? T.red : r.priority==="30 Days" ? T.yellow : T.green;
                return (
                  <Card key={i}>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <div style={{
                        background:`${pc}18`, border:`1px solid ${pc}30`,
                        borderRadius:8, padding:"6px 12px", flexShrink:0, textAlign:"center", minWidth:80
                      }}>
                        <Mono style={{ fontSize:9, color:pc, fontWeight:700, display:"block", letterSpacing:"0.08em" }}>
                          {r.priority.toUpperCase()}
                        </Mono>
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:6 }}>{r.action}</div>
                        <div style={{ fontSize:12, color:T.textDim, lineHeight:1.6 }}>{r.rationale}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Policy Templates Tab */}
          {activeTab === "policies" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {!generatedPolicies && !policyLoading && (
                <Card style={{ textAlign:"center", padding:"48px 32px" }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>✦</div>
                  <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:8 }}>
                    Generate Policy Templates
                  </div>
                  <div style={{ fontSize:13, color:T.textDim, maxWidth:480, margin:"0 auto 20px", lineHeight:1.7 }}>
                    Veritaq will draft board-approvable policy templates for each identified gap — written in examiner-ready language with all required regulatory elements included.
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.08em", marginBottom:10 }}>
                      GENERATE FOR FRAMEWORK
                    </div>
                    <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                      <button
                        onClick={() => setPolicyFwFilter(null)}
                        style={{
                          padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700,
                          fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.04em", transition:"all 0.15s",
                          border:`1px solid ${!policyFwFilter ? T.purple : T.border}`,
                          background: !policyFwFilter ? `${T.purple}18` : T.surface,
                          color: !policyFwFilter ? T.purple : T.textDim,
                        }}>ALL FRAMEWORKS</button>
                      {[...new Set((results.gaps||[]).filter(g => g.severity==="HIGH"||g.severity==="MEDIUM").map(g => g.framework))].map(fw => {
                        const c = FW_COLOR[fw] || T.accent;
                        const active = policyFwFilter === fw;
                        const count = results.gaps.filter(g => g.framework === fw && (g.severity === "HIGH" || g.severity === "MEDIUM")).length;
                        return (
                          <button key={fw} onClick={() => setPolicyFwFilter(fw)} style={{
                            padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700,
                            fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.04em", transition:"all 0.15s",
                            border:`1px solid ${active ? c : T.border}`,
                            background: active ? `${c}18` : T.surface,
                            color: active ? c : T.textDim,
                          }}>{fw} ({count})</button>
                        );
                      })}
                    </div>
                  </div>
                  <Btn onClick={() => generatePolicyTemplates(policyFwFilter)} style={{ padding:"12px 28px", background:T.purple }}>
                    ✦ Generate {policyFwFilter ? policyFwFilter : "All"} Policy Templates →
                  </Btn>
                </Card>
              )}

              {policyLoading && (
                <Card style={{ textAlign:"center", padding:"48px 32px" }}>
                  <div style={{ fontSize:13, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", marginBottom:8 }}>
                    Drafting examiner-ready policy templates...
                  </div>
                  <div style={{ fontSize:11, color:T.textFaint, fontFamily:"'IBM Plex Mono', monospace" }}>
                    Grounding against {selectedFrameworks.join(", ")} requirements
                  </div>
                </Card>
              )}

              {generatedPolicies && !policyLoading && (
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:4 }}>
                  <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.08em" }}>
                    FRAMEWORK:
                  </div>
                  <button onClick={() => { setPolicyFwFilter(null); setGeneratedPolicies(null); }} style={{
                    padding:"5px 12px", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700,
                    fontFamily:"'IBM Plex Mono', monospace", border:`1px solid ${!policyFwFilter ? T.purple : T.border}`,
                    background: !policyFwFilter ? `${T.purple}18` : T.surface, color: !policyFwFilter ? T.purple : T.textDim, transition:"all 0.15s"
                  }}>ALL</button>
                  {[...new Set((results.gaps||[]).filter(g => g.severity==="HIGH"||g.severity==="MEDIUM").map(g => g.framework))].map(fw => {
                    const c = FW_COLOR[fw] || T.accent;
                    const active = policyFwFilter === fw;
                    const count = results.gaps.filter(g => g.framework === fw && (g.severity === "HIGH" || g.severity === "MEDIUM")).length;
                    return (
                      <button key={fw} onClick={() => { setPolicyFwFilter(fw); setGeneratedPolicies(null); }} style={{
                        padding:"5px 12px", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700,
                        fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.04em", transition:"all 0.15s",
                        border:`1px solid ${active ? c : T.border}`,
                        background: active ? `${c}18` : T.surface,
                        color: active ? c : T.textDim,
                      }}>{fw} ({count})</button>
                    );
                  })}
                </div>
              )}

              {generatedPolicies && !policyLoading && generatedPolicies.map((p, i) => {
                if (p.error) return (
                  <Card key={i} style={{ borderLeft:`3px solid ${T.red}` }}>
                    <div style={{ color:T.red, fontSize:13 }}>{p.error}</div>
                  </Card>
                );
                const sevColor = p.severity === "HIGH" ? T.red : T.yellow;
                const isCopied = copiedIdx === i;
                const fwList = Array.isArray(p.frameworks) ? p.frameworks : [p.framework].filter(Boolean);
                const citList = Array.isArray(p.citations) ? p.citations : [p.citation].filter(Boolean);
                return (
                  <Card key={i} style={{ borderLeft:`3px solid ${T.purple}` }}>
                    {/* Header */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:8 }}>
                      <div>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
                          <Pill label={p.severity} color={sevColor} />
                          {fwList.map(fw => <Tag key={fw} fw={fw} small />)}
                        </div>
                        <div style={{ fontSize:16, fontWeight:800, color:T.text, marginBottom:4 }}>{p.title}</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {citList.map(c => (
                            <Mono key={c} style={{ fontSize:10, color:T.purple, fontWeight:700, background:`${T.purple}12`, padding:"2px 6px", borderRadius:4 }}>{c}</Mono>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(p.policyLanguage);
                          setCopiedIdx(i);
                          setTimeout(() => setCopiedIdx(null), 2000);
                        }}
                        style={{
                          padding:"7px 14px", borderRadius:6, border:`1px solid ${isCopied ? T.green : T.border2}`,
                          background: isCopied ? `${T.green}18` : T.surface,
                          color: isCopied ? T.green : T.textMid,
                          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'IBM Plex Mono', monospace",
                          transition:"all 0.15s", flexShrink:0
                        }}>
                        {isCopied ? "✓ Copied" : "⎘ Copy Policy"}
                      </button>
                    </div>

                    {/* Gaps Closed coverage map */}
                    {p.gapsClosed?.length > 0 && (
                      <div style={{ marginBottom:16, padding:"10px 14px", background:`${T.purple}08`, border:`1px solid ${T.purple}20`, borderRadius:8 }}>
                        <Mono style={{ fontSize:9, color:T.purple, fontWeight:700, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>
                          GAPS CLOSED BY THIS POLICY ({p.gapsClosed.length})
                        </Mono>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          {p.gapsClosed.map((gc, j) => (
                            <div key={j} style={{ display:"flex", gap:8, alignItems:"baseline" }}>
                              <Mono style={{ fontSize:9, color:FW_COLOR[gc.framework]||T.accent, fontWeight:700, flexShrink:0 }}>{gc.framework} {gc.citation}</Mono>
                              <div style={{ fontSize:11, color:T.textMid }}>{gc.requirement}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:24, marginBottom:16, flexWrap:"wrap" }}>
                      {[
                        { label:"PURPOSE", value:p.purpose },
                        { label:"SCOPE", value:p.scope },
                      ].map(m => (
                        <div key={m.label} style={{ flex:1, minWidth:200 }}>
                          <Mono style={{ fontSize:9, color:T.textDim, display:"block", marginBottom:4, letterSpacing:"0.1em" }}>{m.label}</Mono>
                          <div style={{ fontSize:12, color:T.textMid, lineHeight:1.6 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display:"flex", gap:24, marginBottom:20, flexWrap:"wrap" }}>
                      {[
                        { label:"POLICY OWNER", value:p.owner },
                        { label:"REVIEW FREQUENCY", value:p.reviewFrequency },
                      ].map(m => (
                        <div key={m.label}>
                          <Mono style={{ fontSize:9, color:T.textDim, display:"block", marginBottom:2, letterSpacing:"0.1em" }}>{m.label}</Mono>
                          <div style={{ fontSize:12, color:T.text, fontWeight:600 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{
                      background:T.surface, border:`1px solid ${T.border}`,
                      borderRadius:8, padding:"20px 24px", marginBottom:14
                    }}>
                      <Mono style={{ fontSize:9, color:T.purple, fontWeight:700, letterSpacing:"0.1em", display:"block", marginBottom:16 }}>
                        POLICY LANGUAGE — READY TO DRAFT
                      </Mono>
                      <div style={{ fontSize:12, color:T.textMid, lineHeight:1.8 }}>
                        {(p.policyLanguage||"").split("\n").map((line, li) => {
                          const SECTIONS = ["PURPOSE","SCOPE","BACKGROUND","POLICY REQUIREMENTS","ROLES AND RESPONSIBILITIES","COMPLIANCE AND ENFORCEMENT","REVIEW AND REVISION"];
                          const trimmed = line.trim();
                          const isHeader = SECTIONS.includes(trimmed);
                          if (isHeader) return (
                            <div key={li} style={{
                              fontSize:10, fontWeight:700, color:T.purple,
                              fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.1em",
                              marginTop: li === 0 ? 0 : 18, marginBottom:6,
                              paddingBottom:4, borderBottom:`1px solid ${T.purple}20`
                            }}>{trimmed}</div>
                          );
                          if (trimmed === "") return <div key={li} style={{ height:6 }} />;
                          return <div key={li} style={{ marginBottom:4 }}>{trimmed}</div>;
                        })}
                      </div>
                    </div>

                    <div style={{
                      background:`${T.purple}08`, border:`1px solid ${T.purple}20`,
                      borderRadius:6, padding:"10px 14px"
                    }}>
                      <Mono style={{ fontSize:9, color:T.purple, fontWeight:700, letterSpacing:"0.1em", display:"block", marginBottom:4 }}>
                        EXAMINER SATISFACTION
                      </Mono>
                      <div style={{ fontSize:12, color:T.textMid, lineHeight:1.6, fontStyle:"italic" }}>
                        "{p.examinerNote}"
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {results?.error && (
        <Card style={{ borderLeft:`3px solid ${T.red}`, padding:"24px" }}>
          <div style={{ color:T.red, fontWeight:700, marginBottom:8 }}>Analysis Error</div>
          <div style={{ color:T.textMid, fontSize:13 }}>{results.error}</div>
          <Btn variant="ghost" style={{ marginTop:16 }} onClick={() => setResults(null)}>Try Again</Btn>
        </Card>
      )}
    </div>
  );
}

// ─── EXAMINER SIMULATION ──────────────────────────────────────────────────────
const EXAM_TYPES = {
  NCUA: {
    label: "NCUA Examination",
    color: "#ec4899",
    subtitle: "National Credit Union Administration",
    examinerTitle: "NCUA Field Examiner",
    systemPrompt: `You are an experienced NCUA (National Credit Union Administration) field examiner conducting a cybersecurity and IT examination of a credit union. Your job is to assess the institution's compliance posture.

Your tone: Professional and procedural on the surface, but skeptical when answers are vague. You follow the FFIEC IT Examination Handbook and NCUA's ACET framework. You are not adversarial, but you WILL write a finding if documentation can't be produced or if policies aren't being followed.

Key areas you focus on: ACET/FFIEC CAT maturity levels, incident response (72-hour notification rule), board oversight and training, vendor management, business continuity testing, MFA implementation, patch management, risk assessment currency.

Real failure patterns you've seen: (1) Policies exist on paper but staff can't demonstrate they're followed, (2) Board can't articulate the security program, (3) No evidence of annual testing of IR plan, (4) Vendor contracts lack security requirements, (5) Risk assessments haven't been updated in 18+ months.

Ask ONE probing follow-up question at a time. Start broad, then drill down on weaknesses. When you find a gap, press harder. Use real examiner language like "Can you produce documentation of that?", "When was this last tested?", "Is this reflected in board minutes?", "What would your staff do if [scenario]?". After 6-8 exchanges, provide a realistic examination finding summary with likely findings and their severity (Matter Requiring Attention vs. Document of Resolution).`
  },
  FFIEC: {
    label: "FFIEC IT Examination",
    color: "#10b981",
    subtitle: "Federal Financial Institutions Examination Council",
    examinerTitle: "FFIEC IT Examiner",
    systemPrompt: `You are an experienced FFIEC IT examiner conducting an information technology examination of a community bank. You represent the Federal Financial Institutions Examination Council and follow the FFIEC IT Examination Handbook.

Your tone: Methodical, thorough, and risk-focused. You're not trying to fail the bank, but you have a job to do. You probe for substance behind the policies.

Key areas: Information security program governance, access controls (especially privileged access), patch and vulnerability management, incident response, third-party service provider oversight, business continuity planning, audit function independence.

Real failure patterns: (1) Can't produce evidence of annual penetration testing, (2) IT steering committee doesn't include board representation, (3) No formal TPRM program with tiered vendor risk, (4) BCP not tested in over 12 months, (5) Change management process not documented or followed.

Ask ONE probing follow-up question per response. Use FFIEC examiner language. After 6-8 exchanges, provide an examination findings summary with findings categorized by severity (Matters Requiring Board Attention vs. Recommendations).`
  },
  NYDFS: {
    label: "NY DFS 500 Exam",
    color: "#3b82f6",
    subtitle: "New York Department of Financial Services",
    examinerTitle: "NYDFS Cybersecurity Examiner",
    systemPrompt: `You are an experienced New York Department of Financial Services (NYDFS) cybersecurity examiner conducting a Part 500 examination. NYDFS is known for being one of the most rigorous state cybersecurity regulators.

Your tone: Precise, technical, and uncompromising. NYDFS Part 500 has specific, non-negotiable requirements. You cite the exact section when something is deficient.

Key areas: CISO designation and annual board reporting (§500.04), MFA for all privileged and remote access (§500.12), encryption at rest and in transit (§500.15), annual penetration testing and bi-annual vulnerability assessments (§500.05), incident response plan (§500.16), third-party security policy (§500.11), cybersecurity training (§500.14), annual certification filing.

Real failure patterns: (1) CISO is IT Director wearing two hats with no formal designation, (2) MFA not enforced on email despite being a covered system, (3) Pen test findings not remediated and tracked, (4) Third-party contracts don't include required security provisions, (5) Annual certification filed but underlying documentation doesn't support it.

Ask ONE precise question per response, citing the specific §500 section. After 6-8 exchanges, provide a findings summary with specific Part 500 citations for each deficiency.`
  },
  PCI_QSA: {
    label: "PCI DSS QSA Audit",
    color: "#e85d04",
    subtitle: "Qualified Security Assessor — v4.0",
    examinerTitle: "PCI QSA",
    systemPrompt: `You are an experienced PCI DSS Qualified Security Assessor (QSA) conducting a PCI DSS v4.0 assessment of an ISO, ISV, or merchant. You have assessed dozens of service providers and merchants across all SAQ types and Report on Compliance engagements.\n\nYour tone: Methodical, evidence-driven, and skeptical of undocumented claims. You do not accept "we do that" without asking "show me." You are not adversarial but you will not sign off on controls that lack evidence. You cite the specific PCI DSS v4.0 Requirement and sub-requirement when probing.\n\nKey areas you drill into: CDE scoping and network segmentation (Req 1 — most ISOs scope incorrectly), SAD storage confirmation (Req 3.3 — non-negotiable, no exceptions), MFA for ALL CDE access including internal network access (Req 8.4 — v4.0 change most miss), payment page script inventory and tamper detection (Req 6.4.3 and 11.6.1 — v4.0 additions ISVs consistently overlook), ASV scan pass status (Req 11.3), annual penetration test scope and methodology (Req 11.4), service provider list with annual PCI DSS compliance confirmation (Req 12.8), incident response plan including card brand forensic notification procedures (Req 12.10).\n\nSAQ awareness: Always confirm SAQ type early — it determines scope of everything else. SAQ A applies only if processing is fully outsourced and no cardholder data touches client systems. ISVs with payment applications are typically SAQ D-SP (service providers). An incorrect SAQ type assumption is itself a material finding.\n\nReal failure patterns: (1) CDE scoped too broadly — entire network in scope because segmentation isn't documented, (2) SAD stored after authorization — CVV or full PANs found in log files or transaction records, (3) MFA not enforced for internal CDE access — missed the v4.0 expansion from remote-only, (4) Payment page scripts not inventoried — e-skimming requirements (6.4.3 / 11.6.1) simply unknown, (5) Service provider list incomplete or lacks annual compliance confirmation letters, (6) IRP has no card brand forensic investigator contact or acquirer notification procedure.\n\nAsk ONE specific probing question per response, citing the PCI DSS v4.0 Requirement number. Always start with CDE scoping and SAQ type determination — everything else depends on scope. After 6-8 exchanges, provide a realistic pre-assessment findings summary with likely Requirement gaps, severity (Observation / Finding / Non-Compliance), and recommended remediation steps before the formal assessment.`
  }
};

// ─── CYBER INSURANCE READINESS ───────────────────────────────────────────────

// 25 questions mapped to the controls underwriters actually verify
const CYBER_INS_QUESTIONS = [
  // CATEGORY: MFA (top denial reason)
  { id:"ci_mfa_email",    category:"Multi-Factor Authentication", weight:5,
    text:"Is MFA enforced on all email accounts (O365, Google Workspace)?",
    why:"#1 underwriting requirement — credential theft via email is the most common ransomware entry point.",
    carriers:"Required by Coalition, Chubb, Hartford, Travelers, Beazley, AIG" },
  { id:"ci_mfa_vpn",      category:"Multi-Factor Authentication", weight:5,
    text:"Is MFA required for all VPN and remote network access?",
    why:"Password-only remote access is a binding refusal criterion at most carriers.",
    carriers:"Universal requirement — all major carriers" },
  { id:"ci_mfa_priv",     category:"Multi-Factor Authentication", weight:4,
    text:"Is MFA enforced on all privileged/admin accounts?",
    why:"Privileged account compromise enables lateral movement and full network takeover.",
    carriers:"Required by Chubb, Beazley, AIG, Coalition, Hartford" },
  { id:"ci_mfa_cloud",    category:"Multi-Factor Authentication", weight:3,
    text:"Is MFA enforced on cloud services and third-party SaaS applications (banking portals, core systems)?",
    why:"SaaS MFA gaps are now explicitly called out in carrier questionnaires.",
    carriers:"Beazley, Coalition, Travelers now ask specifically about cloud MFA" },

  // CATEGORY: Endpoint Protection (EPP + EDR — BBH sells both as distinct)
  { id:"ci_epp",          category:"Endpoint Protection", weight:3,
    text:"Is an enterprise-wide Endpoint Protection Platform (EPP) deployed on all devices — including workstations, servers, and laptops?",
    why:"EPP (next-gen antivirus) is the baseline layer. Carriers require it on every endpoint before EDR is even evaluated.",
    carriers:"Hartford, Travelers — EPP is baseline requirement for all policies" },
  { id:"ci_edr",          category:"Endpoint Protection", weight:5,
    text:"Is Endpoint Detection & Response (EDR) deployed on ALL servers, workstations, and laptops — separate from and in addition to EPP?",
    why:"EDR is required by 65%+ of carriers. Antivirus or EPP alone is explicitly insufficient. Missing EDR is the #2 denial reason after MFA.",
    carriers:"Coalition, Chubb, Hartford, Beazley, AIG — EDR is a hard requirement" },
  { id:"ci_edr_monitored",category:"Endpoint Protection", weight:3,
    text:"Is EDR actively monitored 24/7 (MDR service or in-house SOC) — not just deployed and unmanaged?",
    why:"Unmanaged EDR is flagged by underwriters as insufficient. Active monitoring with alert-to-action timelines is required for larger policies.",
    carriers:"Chubb, AIG, Beazley — active monitoring required for higher-value policies" },

  // CATEGORY: Backups
  { id:"ci_backup_immut", category:"Backup & Recovery", weight:5,
    text:"Are backups immutable or offline/air-gapped — isolated so ransomware cannot encrypt them?",
    why:"94% of ransomware attacks target backups. Carriers require backup isolation as a binding condition.",
    carriers:"Coalition, Travelers, Chubb — offline/immutable backup is a hard requirement" },
  { id:"ci_backup_test",  category:"Backup & Recovery", weight:4,
    text:"Are backup restores tested at least annually — with documented results?",
    why:"Carriers want proof of restore capability, not just that backups exist. Undocumented restores raise flags.",
    carriers:"All major carriers ask specifically about restore testing, not just backup existence" },
  { id:"ci_backup_offsite",category:"Backup & Recovery", weight:3,
    text:"Are backups stored in at least two geographically separate locations (3-2-1 rule)?",
    why:"Single-location backups are a sublimit or exclusion risk on ransomware coverage.",
    carriers:"Hartford, Travelers — ask about backup location diversity" },

  // CATEGORY: Incident Response
  { id:"ci_irp",          category:"Incident Response", weight:5,
    text:"Is there a written Incident Response Plan specifically addressing ransomware and intrusion scenarios?",
    why:"A documented, usable IRP is required by virtually all carriers. Generic BCPs do not satisfy this.",
    carriers:"Universal — Beazley application asks directly about ransomware/malware IRP" },
  { id:"ci_irp_tested",   category:"Incident Response", weight:4,
    text:"Has the IRP been tested (tabletop exercise) within the past 12 months with documented results?",
    why:"Carriers want evidence of testing, not just a policy document. Dated tabletop summaries are the proof.",
    carriers:"Chubb, Beazley, AIG — tested IRP with documented lessons learned" },
  { id:"ci_irp_legal",    category:"Incident Response", weight:3,
    text:"Does your IRP include a legal/counsel notification step and breach notification timeline?",
    why:"Most policies require 24–72 hour breach notification. An IRP without legal workflow creates coverage gaps.",
    carriers:"All carriers — notification SLA is a policy condition" },

  // CATEGORY: Access Controls
  { id:"ci_pam",          category:"Access Controls", weight:4,
    text:"Is Privileged Access Management (PAM) implemented — restricting and logging all admin/privileged account activity?",
    why:"PAM is now required for larger policies ($5M+) and increasingly for all financial institutions.",
    carriers:"AIG, Chubb, Beazley — PAM required for higher-value policies" },
  { id:"ci_least_priv",   category:"Access Controls", weight:3,
    text:"Is least-privilege access enforced — users have only the permissions required for their role?",
    why:"Over-privileged accounts amplify breach impact. Carriers assess this through access review documentation.",
    carriers:"All carriers assess via access control questionnaire" },
  { id:"ci_term",         category:"Access Controls", weight:3,
    text:"Is there a documented same-day access revocation process for terminated employees?",
    why:"Insider threat and terminated employee access is a common claim trigger. Carriers look for written procedures.",
    carriers:"Coalition, Hartford — ask about termination procedures" },

  // CATEGORY: Patching
  { id:"ci_patch_crit",   category:"Patch Management", weight:4,
    text:"Are critical security patches applied within 30 days of release — with documented SLAs?",
    why:"Unpatched systems are the source of a large proportion of ransomware claims. Carriers verify patch cadence.",
    carriers:"All carriers — Chubb and Beazley ask about patch SLAs specifically" },
  { id:"ci_vuln_scan",    category:"Patch Management", weight:3,
    text:"Is vulnerability scanning performed at least quarterly with tracked remediation?",
    why:"Scan results with remediation tracking are now frequently requested as underwriting evidence.",
    carriers:"AIG CyberMatics, Coalition actively scan your environment at renewal" },
  { id:"ci_eol",          category:"Patch Management", weight:3,
    text:"Are there no end-of-life or unsupported operating systems on the network?",
    why:"EOL systems (Windows Server 2008, etc.) are an explicit sublimit or exclusion trigger.",
    carriers:"Chubb, Hartford — EOL systems may void coverage for related incidents" },

  // CATEGORY: Email Security
  { id:"ci_email_sec",    category:"Email Security", weight:4,
    text:"Are SPF, DKIM, and DMARC configured to prevent email spoofing and domain impersonation?",
    why:"BEC (Business Email Compromise) and social engineering attacks are major claim categories for financial institutions.",
    carriers:"Beazley, Coalition — email authentication explicitly in questionnaire" },
  { id:"ci_phish_filter", category:"Email Security", weight:3,
    text:"Is an advanced email security/anti-phishing filter deployed (beyond basic spam filtering)?",
    why:"Financial institutions are priority targets for spear phishing. Carriers want layered email defense.",
    carriers:"Travelers, Beazley — ask about email security beyond spam filters" },

  // CATEGORY: Training
  { id:"ci_training",     category:"Security Awareness", weight:3,
    text:"Do all employees complete annual security awareness training — with completion records?",
    why:"Training records are required application documentation. Undocumented training = no credit given.",
    carriers:"All carriers — Hartford, Travelers ask for training completion evidence" },
  { id:"ci_phish_sim",    category:"Security Awareness", weight:3,
    text:"Are phishing simulation exercises conducted and tracked — with results reported to management?",
    why:"Phishing simulations demonstrate active testing. Carriers give premium credit for regular simulation programs.",
    carriers:"Coalition, Beazley — phishing simulations tied to premium reduction" },

  // CATEGORY: Vendor / Third Party
  { id:"ci_vendor_inv",   category:"Third-Party Risk", weight:3,
    text:"Is there a documented inventory of all third-party vendors with access to systems or customer data?",
    why:"Vendor/supply chain incidents are a growing claim category. Carriers now ask about vendor concentration risk.",
    carriers:"Chubb, AIG, Beazley — vendor inventory and concentration risk assessment" },
  { id:"ci_vendor_assess",category:"Third-Party Risk", weight:3,
    text:"Do vendor contracts include security requirements, breach notification obligations, and audit rights?",
    why:"Contractual security obligations are required by NY DFS §500.11 and are a carrier underwriting factor.",
    carriers:"Chubb, AIG — ask about contractual security requirements for third parties" },

  // CATEGORY: Configuration Management (BBH infographic — common audit weak spot)
  { id:"ci_approved_hw",  category:"Configuration Management", weight:3,
    text:"Is there an approved hardware list — and are only approved devices permitted on the network?",
    why:"Rogue or unmanaged devices are a blind spot for EDR and a common source of breaches. Carriers assess device inventory controls.",
    carriers:"Coalition actively scans your environment — unapproved devices raise underwriting flags" },
  { id:"ci_approved_sw",  category:"Configuration Management", weight:3,
    text:"Is there an approved software list — and are requests for non-approved software reviewed by IT before deployment?",
    why:"Unauthorized software including shadow IT can introduce vulnerabilities outside your patch management program.",
    carriers:"Chubb, Beazley — ask about software control and approved application lists" },
  { id:"ci_local_admin",  category:"Configuration Management", weight:4,
    text:"Have local administrator privileges been removed from standard user workstations — restricting software installs to IT staff only?",
    why:"Local admin rights on end-user machines are one of the most common privilege escalation paths in ransomware attacks.",
    carriers:"Coalition, AIG — local admin removal is explicitly assessed in questionnaires" },
  { id:"ci_baseline",     category:"Configuration Management", weight:3,
    text:"Are standard security configurations (baselines) documented for all systems and applications — aligned to NIST or CIS benchmarks?",
    why:"Documented configuration baselines demonstrate a mature security program and satisfy both insurance and FFIEC/NCUA audit requirements.",
    carriers:"Chubb, Hartford — configuration management documentation supports underwriting confidence" },

  // CATEGORY: Funds Transfer / BEC
  { id:"ci_wire_verify",  category:"Financial Controls", weight:4,
    text:"Is there a documented out-of-band verification process for wire transfer and payment change requests?",
    why:"Social engineering / funds transfer fraud is one of the top claim types for financial institutions. Carriers require written procedures.",
    carriers:"All carriers with financial institution clients — BEC/funds transfer fraud is a major sublimit category" },
];

const CI_CATEGORY_ORDER = [
  "Multi-Factor Authentication",
  "Endpoint Protection",
  "Backup & Recovery",
  "Incident Response",
  "Access Controls",
  "Patch Management",
  "Configuration Management",
  "Email Security",
  "Security Awareness",
  "Third-Party Risk",
  "Financial Controls",
];

function CyberInsuranceView({ client, report, onChangeClient }) {
  const [answers, setAnswers] = useState({});
  const [activeCategory, setActiveCategory] = useState(CI_CATEGORY_ORDER[0]);
  const [reportGenerated, setReportGenerated] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [phase, setPhase] = useState("assess"); // assess | results

  const answered = Object.keys(answers).length;
  const total = CYBER_INS_QUESTIONS.length;

  // Score calculation
  const score = useMemo(() => {
    let earned = 0, possible = 0;
    CYBER_INS_QUESTIONS.forEach(q => {
      possible += q.weight;
      const a = answers[q.id];
      if (a === "yes") earned += q.weight;
      else if (a === "partial") earned += q.weight * 0.5;
    });
    return possible > 0 ? earned / possible : 0;
  }, [answers]);

  const gaps = CYBER_INS_QUESTIONS.filter(q => answers[q.id] === "no" || answers[q.id] === "partial");
  const critical = gaps.filter(q => q.weight >= 4);

  const categoryQuestions = CI_CATEGORY_ORDER.map(cat => ({
    cat,
    qs: CYBER_INS_QUESTIONS.filter(q => q.category === cat),
    done: CYBER_INS_QUESTIONS.filter(q => q.category === cat && answers[q.id]).length,
  }));

  async function generateInsuranceReport() {
    setReportLoading(true);
    const clientName = client?.name || report?.clientName || "this institution";
    const clientType = client?.type || report?.clientType || "financial institution";
    const gapList = gaps.map(q => `- [${q.weight >= 4 ? "CRITICAL" : "MODERATE"}] ${q.category}: ${q.text} — ${answers[q.id] === "partial" ? "Partially implemented" : "Not implemented"}\n  Carrier impact: ${q.carriers}`).join("\n");
    const passList = CYBER_INS_QUESTIONS.filter(q => answers[q.id] === "yes").map(q => `- ${q.category}: ${q.text}`).join("\n");
    const readinessScore = Math.round(score * 100); // use component-level weighted score (0-1 ratio)
    const passingCount = CYBER_INS_QUESTIONS.filter(q => answers[q.id] === "yes").length;
    try {
      const text = await groundedAICall({
        frameworks: ["FFIEC", "NY DFS 500", "NCUA"],
        context: "cyber insurance underwriting requirements for financial institutions, MFA requirements, incident response requirements",
        maxTokens: 1000,
        system: `You are a cyber insurance underwriting advisor for financial institutions. You have deep knowledge of how Coalition, Chubb, Hartford, Travelers, Beazley, and AIG evaluate applications. Fetch current NY DFS 500 MFA and incident response requirements before writing. FORMAT RULES: Use markdown bullet points (- ) for ALL lists. Each carrier section must have its items as separate bullet lines starting with "- ❌" or "- ⚠️". Never write carrier items as inline prose. Each bullet on its own line. Paragraphs are prose only — no lists inside paragraphs.`,
        userPrompt: `Write a Cyber Insurance Underwriting Advisory for ${clientName} (${clientType}).
Readiness Score: ${readinessScore}% | Critical gaps: ${gaps.filter(q => q.weight >= 4).length} | Controls passing: ${passingCount}
GAPS (with carrier impact): ${gapList}
PASSING CONTROLS: ${passList}
Sections:
## 1. Underwriting Summary
[2-3 sentence paragraph summary]

## 2. Binding Risk Items by Carrier
### COALITION
- ❌ [item] — [carrier impact]
- ⚠️ [item] — [carrier impact]

### CHUBB
- ❌ [item] — [carrier impact]

[repeat for Hartford, Travelers, Beazley, AIG]

## 3. Remediation Priority — Top 3 Actions
- [Priority 1 with regulatory citation]
- [Priority 2 with regulatory citation]  
- [Priority 3 with regulatory citation]

## 4. Estimated Premium Impact
[paragraph]

## 5. Application Readiness Checklist
- [item]

CRITICAL FORMAT RULE: Every carrier item MUST be on its own "- ❌" or "- ⚠️" bullet line. Never combine multiple items into one line or paragraph.`
      });
      setReportGenerated(text);
      setPhase("results");
    } catch { setReportGenerated("Report generation failed. Please try again."); }
    setReportLoading(false);
  }

  const catColors = { "Multi-Factor Authentication": T.accent, "Endpoint Protection": "#f59e0b", "Backup & Recovery": "#10b981", "Incident Response": T.red, "Access Controls": "#8b5cf6", "Patch Management": "#06b6d4", "Configuration Management": "#64748b", "Email Security": "#ec4899", "Security Awareness": "#84cc16", "Third-Party Risk": "#f97316", "Financial Controls": "#eab308" };

  if (phase === "results") {
    return (
      <div className="fade-in" style={{ padding: "40px 48px", maxWidth: 1000 }}>
        <button onClick={() => setPhase("assess")} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 13, marginBottom: 20 }}>← Back to Assessment</button>

        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Cyber Insurance Readiness Report</div>
        <div style={{ fontSize: 13, color: T.textDim, marginBottom: 32 }}>{client?.name || report?.clientName || "Institution"} · {new Date().toLocaleDateString()}</div>

        {/* Score Banner */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Readiness Score", value: `${Math.round(score * 100)}%`, color: score >= 0.75 ? T.green : score >= 0.5 ? T.yellow : T.red },
            { label: "Critical Gaps", value: critical.length, color: critical.length === 0 ? T.green : T.red },
            { label: "Total Gaps", value: gaps.length, color: gaps.length === 0 ? T.green : T.yellow },
            { label: "Controls Confirmed", value: CYBER_INS_QUESTIONS.filter(q => answers[q.id] === "yes").length, color: T.green },
          ].map(k => (
            <Card key={k.label} style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 8 }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: k.color }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Gaps by Category */}
        {gaps.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <SectionLabel>Gaps by Control Category</SectionLabel>
            {CI_CATEGORY_ORDER.filter(cat => gaps.some(g => g.category === cat)).map(cat => {
              const catGaps = gaps.filter(g => g.category === cat);
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: catColors[cat] || T.accent, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>{cat.toUpperCase()}</div>
                  {catGaps.map(g => (
                    <div key={g.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${g.weight >= 4 ? T.red : T.yellow}`, borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{g.text}</div>
                        <Pill label={g.weight >= 4 ? "CRITICAL" : "MODERATE"} color={g.weight >= 4 ? T.red : T.yellow} />
                      </div>
                      <div style={{ fontSize: 12, color: T.textDim, marginBottom: 4 }}>{g.why}</div>
                      <div style={{ fontSize: 11, color: T.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{g.carriers}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>
        )}

        {/* AI Report */}
        {reportLoading && <Card><AIBox text="" loading={true} /></Card>}
        {reportGenerated && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionLabel style={{ marginBottom: 0 }}>AI Underwriting Advisory</SectionLabel>
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="ghost" onClick={() => exportPDF(
                  `${client?.name || "Institution"} — Cyber Insurance Readiness Report`,
                  `${client?.type || ""} · ${new Date().toLocaleDateString()} · Prepared by Veritaq`,
                  [{ heading: "Underwriting Advisory", content: markdownToHTML(reportGenerated) }]
                )}>↓ Export PDF</Btn>
                <Btn variant="success" onClick={() => navigator.clipboard.writeText(reportGenerated)}>Copy Report</Btn>
              </div>
            </div>
            <div style={{ maxHeight: 520, overflowY: "auto", paddingRight: 8 }}>
              <MarkdownReport text={reportGenerated} />
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "40px 48px", maxWidth: 1000 }}>
      {/* Client header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28,
        background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px" }}>
        <div style={{ width:36, height:36, borderRadius:8, background:`${T.accent}18`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:15, fontWeight:800, color:T.accent, flexShrink:0 }}>
          {(client?.name || "?")[0]}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{client?.name || "No client selected"}</div>
          <div style={{ fontSize:11, color:T.textDim }}>{client?.type || ""}</div>
        </div>
        {onChangeClient && (
          <button onClick={onChangeClient} style={{ background:"none", border:`1px solid ${T.border}`,
            borderRadius:6, padding:"6px 14px", color:T.textDim, fontSize:12,
            cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif",
            transition:"all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=T.accent; e.currentTarget.style.color=T.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.textDim; }}>
            Change Client
          </button>
        )}
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Cyber Insurance Readiness</div>
        <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.6, maxWidth: 620 }}>
          Assess {client?.name || "your institution"}'s readiness against the controls underwriters actually verify. 29 questions across 11 control categories — mapped to real carrier requirements from Coalition, Chubb, Hartford, Travelers, Beazley, and AIG.
        </div>
      </div>

      {/* Progress bar */}
      <Card style={{ marginBottom: 24, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid }}>{answered} of {total} questions answered</div>
          <div style={{ fontSize: 12, color: T.textDim }}>{Math.round(answered / total * 100)}% complete</div>
        </div>
        <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${answered / total * 100}%`, background: T.accent, borderRadius: 3, transition: "width 0.3s" }} />
        </div>
      </Card>

      <div style={{ display: "flex", gap: 24 }}>
        {/* Category Nav */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 12 }}>CONTROL AREAS</div>
          {categoryQuestions.map(({ cat, qs, done }) => {
            const isActive = activeCategory === cat;
            const allDone = done === qs.length;
            const hasGap = qs.some(q => answers[q.id] === "no");
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                width: "100%", textAlign: "left", background: isActive ? `${T.accent}18` : "none",
                border: `1px solid ${isActive ? T.accent : "transparent"}`,
                borderRadius: 8, padding: "10px 12px", cursor: "pointer", marginBottom: 4,
                transition: "all 0.15s"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: hasGap ? T.red : allDone ? T.green : T.textDim }} />
                  <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? T.text : T.textMid, lineHeight: 1.3 }}>{cat}</div>
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, marginLeft: 16 }}>{done}/{qs.length} answered</div>
              </button>
            );
          })}
          {answered >= total && (
            <div style={{ marginTop: 16 }}>
              <Btn onClick={generateInsuranceReport} disabled={reportLoading} style={{ width: "100%" }}>
                {reportLoading ? "Generating..." : "Generate Report →"}
              </Btn>
            </div>
          )}
          {answered >= 15 && answered < total && (
            <div style={{ marginTop: 16 }}>
              <Btn onClick={generateInsuranceReport} disabled={reportLoading} style={{ width: "100%", opacity: 0.8 }}>
                {reportLoading ? "Generating..." : "Generate Partial Report →"}
              </Btn>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 6, textAlign: "center" }}>{total - answered} questions remaining</div>
            </div>
          )}
        </div>

        {/* Questions */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: catColors[activeCategory] || T.accent, marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em" }}>{activeCategory.toUpperCase()}</div>
          {CYBER_INS_QUESTIONS.filter(q => q.category === activeCategory).map(q => {
            const ans = answers[q.id];
            return (
              <Card key={q.id} style={{ marginBottom: 16, borderLeft: ans === "yes" ? `3px solid ${T.green}` : ans === "no" ? `3px solid ${T.red}` : ans === "partial" ? `3px solid ${T.yellow}` : `3px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  {q.weight >= 4 && <Pill label="CRITICAL" color={T.red} />}
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.5, flex: 1 }}>{q.text}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 8, lineHeight: 1.5 }}>{q.why}</div>
                <div style={{ fontSize: 11, color: T.accent, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 14 }}>{q.carriers}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { val: "yes", label: "✓ Yes", color: T.green },
                    { val: "partial", label: "~ Partial", color: T.yellow },
                    { val: "no", label: "✗ No", color: T.red },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.val }))} style={{
                      padding: "7px 18px", borderRadius: 6, border: `1px solid ${ans === opt.val ? opt.color : T.border}`,
                      background: ans === opt.val ? `${opt.color}20` : "transparent",
                      color: ans === opt.val ? opt.color : T.textDim,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.12s",
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}>{opt.label}</button>
                  ))}
                </div>
              </Card>
            );
          })}

          {/* Next category button */}
          {(() => {
            const idx = CI_CATEGORY_ORDER.indexOf(activeCategory);
            const next = CI_CATEGORY_ORDER[idx + 1];
            return next ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <Btn onClick={() => setActiveCategory(next)}>Next: {next} →</Btn>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}

function ExaminerView({ client, report, onChangeClient }) {
  const [examType, setExamType] = useState(null);
  const [phase, setPhase] = useState("select"); // select | briefing | exam | findings
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState("");
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  function startExam(type) {
    setExamType(type);
    setPhase("briefing");
  }

  async function beginExam() {
    setPhase("exam");
    setLoading(true);
    const cfg = EXAM_TYPES[examType];
    const reportSummary = report
      ? `Assessment data: Score ${Math.round(report.overallScore * 100)}%. Gaps: ${report.gaps.map(g => g.domain).join(", ")}. Strengths: ${report.strengths.map(s => s.domain).join(", ")}.`
      : "No prior assessment data.";
    const clientInfo = client
      ? `Institution: ${client.name}, Type: ${client.type}, Size: ${client.employees} employees.`
      : "Institution details not provided.";
    try {
      const text = await groundedAICall({
        frameworks: examType === "ncua" ? ["NCUA","FFIEC"] : examType === "nydfs" ? ["NY DFS 500"] : ["FFIEC"],
        context: `${cfg.label} examination procedures and IT booklet requirements`,
        maxTokens: 1000,
        system: cfg.systemPrompt + "\n\nIMPORTANT: Before beginning the examination, fetch the current examination handbook from ithandbook.ffiec.gov or the relevant regulatory source. Use actual examination question patterns and current regulatory language from the fetched source. Cite specific booklet sections in your findings.",
        userPrompt: `Begin the examination. ${clientInfo} ${reportSummary} Introduce yourself briefly as the examiner, state the scope, and ask your first examination question grounded in the current regulatory handbook you just fetched.`
      });
      setMessages([{ role:"examiner", text }]);
    } catch { setMessages([{ role:"examiner", text:"Examination could not be initiated. Please try again." }]); }
    setLoading(false);
  }

  async function sendResponse() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const cfg = EXAM_TYPES[examType];
    const newTurn = turnCount + 1;
    setTurnCount(newTurn);

    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role === "examiner" ? "assistant" : "user",
        content: m.text
      }));

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 350,
          system: cfg.systemPrompt,
          messages: apiMessages
        })
      });
      const d = await resp.json();
      const text = d.content?.[0]?.text || "";
      setMessages(prev => [...prev, { role: "examiner", text }]);
    } catch { setMessages(prev => [...prev, { role: "examiner", text: "Could not process response." }]); }
    setLoading(false);
  }

  async function generateFindings() {
    setLoading(true);
    const cfg = EXAM_TYPES[examType];
    const transcript = messages.map(m => `${m.role === "user" ? "INSTITUTION" : "EXAMINER"}: ${m.text}`).join("\n\n");
    try {
      const text = await groundedAICall({
        frameworks: examType === "ncua" ? ["NCUA","FFIEC"] : examType === "nydfs" ? ["NY DFS 500"] : ["FFIEC"],
        context: "examination findings report format, regulatory citation requirements, corrective action requirements",
        maxTokens: 1000,
        system: cfg.systemPrompt + "\n\nYou are now writing the official post-examination findings report. Fetch the current regulatory handbook to ensure every finding cites the exact section number and requirement language from the source document. Format exactly like a real regulatory finding.",
        userPrompt: `Write the official examination findings report based on this transcript. Format: (1) Management Summary (2) Numbered findings each with: severity level, exact regulatory citation fetched from source, finding description, required corrective action and timeline. Be realistic — base findings only on what was discussed.\n\nTRANSCRIPT:\n${transcript}`
      });
      setFindings(text);
      setPhase("findings");
    } catch { setFindings("Findings report could not be generated. Please try again."); }
    setLoading(false);
  }

  const cfg = examType ? EXAM_TYPES[examType] : null;

  // ── SELECT PHASE ──
  if (phase === "select") {
    return (
      <div style={{ padding: "48px 48px" }}>
        {/* Client header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:36,
          background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px" }}>
          <div style={{ width:36, height:36, borderRadius:8, background:`${T.accent}18`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, fontWeight:800, color:T.accent, flexShrink:0 }}>
            {(client?.name || "?")[0]}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{client?.name || "No client selected"}</div>
            <div style={{ fontSize:11, color:T.textDim }}>{client?.type || ""}{report ? ` · Compliance score: ${Math.round(report.overallScore*100)}%` : ""}</div>
          </div>
          {onChangeClient && (
            <button onClick={onChangeClient} style={{ background:"none", border:`1px solid ${T.border}`,
              borderRadius:6, padding:"6px 14px", color:T.textDim, fontSize:12,
              cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=T.accent; e.currentTarget.style.color=T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.textDim; }}>
              Change Client
            </button>
          )}
        </div>

        <div style={{ marginBottom: 8, fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.12em" }}>EXAM SIMULATOR</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 8 }}>Mock Examination</div>
        <div style={{ fontSize: 14, color: T.textMid, marginBottom: 48, maxWidth: 560 }}>
          Simulate a real regulatory examination using AI trained on actual examiner behavior, FFIEC handbooks, and examination findings patterns. Identify weaknesses before your next exam.
        </div>

        <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 20 }}>SELECT EXAMINATION TYPE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 840 }}>
          {Object.entries(EXAM_TYPES).map(([key, val]) => (
            <button key={key} onClick={() => startExam(key)} style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: "28px 24px", textAlign: "left", cursor: "pointer",
              transition: "all 0.2s"
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = val.color; e.currentTarget.style.background = `${val.color}08`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: val.color, marginBottom: 16 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{val.label}</div>
              <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>{val.subtitle}</div>
              <div style={{ marginTop: 20, fontSize: 11, color: val.color, fontFamily: "'IBM Plex Mono', monospace" }}>START →</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: "20px 24px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, maxWidth: 560 }}>
          <div style={{ fontSize: 11, color: T.yellow, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>HOW IT WORKS</div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7 }}>
            The AI plays the role of a real regulator using actual examination frameworks, question patterns, and finding language. Your responses are evaluated in real-time. At the end, you receive a realistic findings report showing what a real exam would likely produce.
          </div>
        </div>
      </div>
    );
  }

  // ── BRIEFING PHASE ──
  if (phase === "briefing") {
    return (
      <div style={{ padding: "48px 48px", maxWidth: 640 }}>
        <div style={{ marginBottom: 8, fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.12em" }}>EXAM BRIEFING</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 32 }}>{cfg.label}</div>

        <div style={{ background: T.surface, border: `1px solid ${cfg.color}30`, borderRadius: 10, padding: "28px 32px", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
            <div style={{ fontSize: 12, color: cfg.color, fontFamily: "'IBM Plex Mono', monospace" }}>{cfg.examinerTitle.toUpperCase()}</div>
          </div>
          <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.8 }}>
            This simulation uses AI trained on actual {cfg.label} examination procedures, FFIEC IT Handbook guidance, and real finding patterns from regulatory exams.
          </div>
          <div style={{ marginTop: 20, fontSize: 14, color: T.textMid, lineHeight: 1.8 }}>
            <strong style={{ color: T.text }}>Answer as your institution would answer in a real exam.</strong> The examiner will probe your responses. After 6–8 exchanges, you'll receive a realistic findings report.
          </div>
          <div style={{ marginTop: 20, padding: "14px 16px", background: `${T.yellow}10`, borderRadius: 6, border: `1px solid ${T.yellow}30` }}>
            <div style={{ fontSize: 12, color: T.yellow, marginBottom: 6 }}>⚠ Examination scope includes:</div>
            <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7 }}>
              {examType === "NCUA" && "Cybersecurity maturity (ACET), incident response (72-hr rule), board oversight, vendor management, BCP testing"}
              {examType === "FFIEC" && "Information security governance, access controls, patch management, TPRM, BCP, audit independence"}
              {examType === "NYDFS" && "Part 500 compliance: CISO (§500.04), MFA (§500.12), encryption (§500.15), pen testing (§500.05), IR plan (§500.16)"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setPhase("select")} style={{ padding: "12px 24px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMid, cursor: "pointer", fontSize: 13 }}>
            Back
          </button>
          <button onClick={beginExam} style={{ padding: "12px 32px", background: cfg.color, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            Begin Examination →
          </button>
        </div>
      </div>
    );
  }

  // ── FINDINGS PHASE ──
  if (phase === "findings") {
    return (
      <div style={{ padding: "48px 48px" }}>
        <div style={{ marginBottom: 8, fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>EXAMINATION RESULTS</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 32 }}>Findings Report</div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "32px", maxWidth: 720 }}>
          {findingsLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16, color: T.textMid }}>
              <div style={{ width: 20, height: 20, border: `2px solid ${cfg.color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 14 }}>Generating examination findings report...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: cfg.color, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 20 }}>{cfg.examinerTitle.toUpperCase()} · {cfg.label.toUpperCase()}</div>
              <div><MarkdownReport text={findings} /></div>
              <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
                <button onClick={() => { setPhase("select"); setMessages([]); setTurnCount(0); setFindings(""); setExamType(null); }}
                  style={{ padding: "12px 24px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMid, cursor: "pointer", fontSize: 13 }}>
                  Run Another Exam
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── EXAM CHAT PHASE ──
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", padding: "0" }}>
      {/* Header */}
      <div style={{ padding: "20px 32px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cfg.label}</div>
            <div style={{ fontSize: 11, color: T.textDim }}>{cfg.examinerTitle} · {client?.name || "Institution"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>EXCHANGE {turnCount}</div>
          {turnCount >= 6 && (
            <button onClick={generateFindings} style={{ padding: "8px 18px", background: cfg.color, border: "none", borderRadius: 5, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              Generate Findings →
            </button>
          )}
        </div>
      </div>

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 16, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
              background: msg.role === "examiner" ? `${cfg.color}20` : T.accentDim,
              color: msg.role === "examiner" ? cfg.color : T.accent }}>
              {msg.role === "examiner" ? "EX" : "ME"}
            </div>
            <div style={{ maxWidth: "72%", background: msg.role === "examiner" ? T.surface : T.accentDim, border: `1px solid ${msg.role === "examiner" ? T.border : T.accent + "40"}`, borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 10, color: msg.role === "examiner" ? cfg.color : T.accent, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8, letterSpacing: "0.08em" }}>
                {msg.role === "examiner" ? cfg.examinerTitle.toUpperCase() : "YOUR RESPONSE"}
              </div>
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.7 }}>{msg.text}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: `${cfg.color}20`, color: cfg.color }}>EX</div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${cfg.color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 13, color: T.textDim }}>Examiner reviewing response...</div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "20px 32px", borderTop: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        {turnCount >= 6 && (
          <div style={{ marginBottom: 12, fontSize: 12, color: T.yellow, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚡</span> You've completed {turnCount} exchanges. You can continue or generate your findings report now.
          </div>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendResponse(); } }}
            placeholder="Type your response to the examiner... (Enter to send)"
            style={{ flex: 1, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 16px", color: T.text, fontSize: 14, resize: "none", height: 80, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none" }}
          />
          <button onClick={sendResponse} disabled={loading || !input.trim()} style={{ padding: "0 24px", background: loading || !input.trim() ? T.surface2 : cfg.color, border: "none", borderRadius: 8, color: loading || !input.trim() ? T.textDim : "#fff", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

export type LegalPageKey = "privacy" | "cookies" | "terms";

const lastUpdated = "26 November 2026";
const contactEmail = "albertmkwanda@gmail.com";
const legalOperator = "Squavero Technologies";

const malawiLegalReferences = [
  {
    label: "Constitution of Malawi (Article 21)",
    href: "https://malawilii.org/akn/mw/act/1994/20/eng@2020-11-03",
  },
  {
    label: "Data Protection Act, 2024 (Act No. 3 of 2024)",
    href: "https://www.dpa.mw/download/data-protection-act-2024/",
  },
  {
    label: "Data Protection Act Commencement Notice, Government Notice No. 40 of 2024",
    href: "https://malawilii.org/akn/mw/act/gn/2024/40/eng@2024-05-31",
  },
  {
    label: "MACRA: Data Privacy Week — Privacy by Design",
    href: "https://macra.mw/data-privacy-week-privacy-by-design/",
  },
];

const documents: Record<LegalPageKey, { title: string; summary: string; sections: { title: string; text: string }[] }> = {
  privacy: {
    title: "Privacy policy",
    summary: "How Squavero Technologies handles information when you use GPD Studio.",
    sections: [
      {
        title: "Who is responsible",
        text: `${legalOperator} operates GPD Studio from Malawi and is responsible for handling information described in this policy. For privacy questions or requests, contact ${contactEmail}.`,
      },
      {
        title: "Malawi privacy framework",
        text: "Malawi's Constitution recognizes the right to privacy in Article 21. The Data Protection Act, 2024 (Act No. 3 of 2024), provides the statutory framework for personal-data processing and came into force on 3 June 2024. MACRA identifies itself as Malawi's designated Data Protection Authority. This policy explains how GPD Studio handles information in that context.",
      },
      {
        title: "Information we process",
        text: "We process your email address and password hash; workspace, campaign, schedule and post content; connected-page details; uploaded media; and service diagnostics such as request and error logs. If you connect a channel or configure an AI provider, the related access credentials and TikTok browser session are encrypted before storage. We do not store your account password in readable form.",
      },
      {
        title: "Why we use information",
        text: "We use information to create and secure your account, operate your workspace, analyze or store media, prepare campaign content, schedule approved posts, publish to connected services, troubleshoot the product and respond to support requests. We use only the information reasonably needed for these purposes. Depending on the activity and applicable law, the basis may include providing a service you request, your consent where required, our legitimate interests in securing and maintaining the service, or compliance with a legal obligation.",
      },
      {
        title: "AI and connected services",
        text: "When you request AI assistance, relevant prompts, campaign details or media are sent to the AI or inference provider configured for that feature. Connected social services receive the content and account information needed to validate or publish your posts. Providers process information under their own terms and privacy notices. Do not submit sensitive personal information about yourself or another person unless you have a lawful reason and the necessary permissions.",
      },
      {
        title: "Service providers and international processing",
        text: "GPD Studio uses Netlify for the web application and same-origin API proxy, Render for the API, Supabase for the database, Cloudinary for media storage, and Hugging Face for configured inference. Depending on the features you use, Google, OpenAI, Anthropic, OpenRouter, Groq, Meta, X or TikTok may also process information. Some providers may process information outside Malawi. The location and safeguards depend on the provider and service you choose; we will handle transfers as required by applicable law.",
      },
      {
        title: "Security, retention and incidents",
        text: "We use HTTPS, password hashing, encrypted storage for connected credentials and browser state, and access controls. No online service can promise absolute security. We retain workspace information while the account is active and for as long as reasonably needed to operate the service, protect it, resolve disputes or meet legal obligations. To request account closure or personal-data deletion, contact us at the address above. We may retain information where the law requires it or where it is needed for security or dispute resolution. We will address and report personal-data incidents when required by applicable law.",
      },
      {
        title: "Your choices and rights",
        text: "You can disconnect channels, remove workspace content where the product provides that control, and withdraw a remembered session by signing out. You may contact us to request access to or correction or deletion of personal information, or to exercise other rights available under applicable law. We may need to verify your identity before responding. If you have an unresolved concern, you may contact MACRA in its role as Malawi's Data Protection Authority.",
      },
      {
        title: "Changes to this policy",
        text: `We may update this policy as the service changes or legal requirements develop. We will publish the revised version here and update its date. Contact ${contactEmail} with questions or requests.`,
      },
    ],
  },
  cookies: {
    title: "Cookie policy",
    summary: "GPD Studio uses only the storage needed to keep the service secure and remember your sign-in choice.",
    sections: [
      {
        title: "Essential sign-in cookie",
        text: "If you select “Remember me on this device,” we set a first-party, Secure, HttpOnly, SameSite=Lax cookie named gpd_studio_session. It contains a random session secret, not your password. The server stores only its hash. The session is refreshed while you use the service and expires after 400 days of inactivity, or sooner when you sign out.",
      },
      {
        title: "Short-lived access token",
        text: "The short-lived access token used for API requests is kept in application memory and expires after 20 minutes. It is not written to a browser cookie or local storage.",
      },
      {
        title: "No analytics or advertising cookies",
        text: "GPD Studio does not currently set analytics, advertising or cross-site tracking cookies. The cookie notice dismissal is held in sessionStorage for the current browser tab only; it is not a cookie and is cleared when that tab session ends.",
      },
      {
        title: "Managing cookies",
        text: "You can disable or remove cookies in your browser settings. Blocking the essential sign-in cookie prevents the Remember me feature from working; you can still sign in for the current session without selecting it. Signing out invalidates and removes the remembered session cookie.",
      },
      {
        title: "Third-party services",
        text: "When you visit connected social platforms or use configured AI, storage or inference providers, those services may use their own cookies and similar technologies under their own policies. GPD Studio does not control those technologies.",
      },
      {
        title: "Contact",
        text: `For questions about this policy, contact ${legalOperator} at ${contactEmail}. Last updated ${lastUpdated}.`,
      },
    ],
  },
  terms: {
    title: "Terms of service",
    summary: `These terms govern your use of GPD Studio, operated by ${legalOperator}.`,
    sections: [
      {
        title: "Using the service",
        text: "By creating an account, you agree to these terms and acknowledge the Privacy Policy. You must provide accurate account information, keep your sign-in details secure, and promptly notify us if you suspect unauthorized access. You are responsible for activity performed through your account.",
      },
      {
        title: "Your content and permissions",
        text: "You retain your rights to content and media you provide. You confirm that you have the permissions needed to upload, analyze, adapt and publish that material, and that your use does not violate another person's rights or applicable law. You authorize GPD Studio to process that material only as needed to provide the features you request.",
      },
      {
        title: "Connected platforms and publishing",
        text: "You are responsible for connecting accounts you are authorized to manage, maintaining valid credentials, reviewing drafts, approving posts and complying with each platform's terms and policies. Platform outages, access changes, moderation decisions or publishing limits may delay or prevent a post. Do not use the service to bypass platform safeguards.",
      },
      {
        title: "AI-generated material",
        text: "AI output can be inaccurate, incomplete, similar to other material or unsuitable for your audience. You must review it and verify factual, legal, licensing and religious claims before use. We do not guarantee reach, engagement, sales, platform approval or any particular result.",
      },
      {
        title: "Acceptable use and service changes",
        text: "Do not use GPD Studio for unlawful activity, to infringe rights, to upload malicious material, or to disrupt the service or other users. We may suspend access when reasonably needed to protect users, comply with law, or address misuse. Features may change as the service develops.",
      },
      {
        title: "Third-party services",
        text: "GPD Studio connects to independent hosting, AI, storage and social-platform services. Their availability and terms are outside our control. Your use of those services is also subject to their own terms and privacy notices.",
      },
      {
        title: "Disclaimer and liability",
        text: "The service is provided on an as-available basis. To the extent allowed by applicable law, Squavero Technologies excludes implied warranties and is not liable for indirect or consequential loss, lost business opportunities, or platform actions resulting from your content or account. Nothing in these terms limits liability or remedies that cannot legally be excluded or restricted.",
      },
      {
        title: "Governing law and contact",
        text: `These terms are governed by the laws of Malawi, subject to rights and remedies that applicable law does not allow us to limit. Questions about these terms can be sent to ${contactEmail}.`,
      },
    ],
  },
};

const pageLinks: { key: LegalPageKey; label: string }[] = [
  { key: "privacy", label: "Privacy" },
  { key: "cookies", label: "Cookies" },
  { key: "terms", label: "Terms" },
];

export function LegalLinks({
  onNavigate,
}: {
  onNavigate: (page: LegalPageKey) => void;
}) {
  return (
    <nav className="legal-links" aria-label="Legal information">
      {pageLinks.map(({ key, label }) => (
        <a
          href={`/?legal=${key}`}
          key={key}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(key);
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

export function LegalPage({
  page,
  onNavigate,
  onBack,
}: {
  page: LegalPageKey;
  onNavigate: (page: LegalPageKey) => void;
  onBack: () => void;
}) {
  const document = documents[page];
  return (
    <div className="legal-shell">
      <a className="skip-link" href="#legal-content">Skip to policy content</a>
      <header className="legal-header">
        <a className="brand legal-brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }}>
          <span className="brand-icon" aria-hidden="true">g</span>
          <span><b>GPD Studio</b><small>Policies and terms</small></span>
        </a>
        <button className="button secondary" type="button" onClick={onBack}>Back to GPD Studio</button>
      </header>
      <main className="legal-document" id="legal-content" tabIndex={-1} aria-labelledby="legal-title">
        <p className="legal-eyebrow">{legalOperator} · Malawi</p>
        <h1 id="legal-title">{document.title}</h1>
        <p className="legal-summary">{document.summary}</p>
        <p className="legal-updated">Last updated: {lastUpdated}</p>
        <LegalLinks onNavigate={onNavigate} />
        {(page === "privacy" || page === "terms") && (
          <section className="legal-references" aria-labelledby="legal-references-title">
            <h2 id="legal-references-title">Malawi legal references</h2>
            <p>These policies are informed by Malawi's privacy and data-protection framework.</p>
            <ul>
              {malawiLegalReferences.map(({ label, href }) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer">{label}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {document.sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </main>
    </div>
  );
}

export function CookieNotice({ onOpenPolicy }: { onOpenPolicy: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.sessionStorage.getItem("gpd-cookie-notice-dismissed") !== "true");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.sessionStorage.setItem("gpd-cookie-notice-dismissed", "true");
    } catch {
      // The notice can still be dismissed for this render if browser storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <aside className="cookie-notice" aria-label="Cookie information">
      <div>
        <strong>Essential storage only</strong>
        <p>Remember me uses a secure sign-in cookie. We do not use analytics or advertising cookies.</p>
        <button className="text-link" type="button" onClick={onOpenPolicy}>Read the cookie policy</button>
      </div>
      <button className="button secondary" type="button" onClick={dismiss}>Dismiss</button>
    </aside>
  );
}

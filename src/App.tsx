import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight, CalendarDays, Check, CircleHelp, Clock3, Facebook, FileImage,
  HeartHandshake, ImagePlus, Instagram, LoaderCircle, LockKeyhole, LogOut,
  MessageCircle, Plus, Send, Settings2, Sparkles, Target, Video, X,
} from "lucide-react";
import {
  api,
  API_URL,
  type AIProviderConfig,
  type Campaign,
  type CampaignGenerationJob,
  type CampaignGeography,
  type CloudinaryUploadIntent,
  type CloudinaryUploadResult,
  type LLMProvider,
  type MarketingAsset,
  type MediaGenerationJob,
  type PageProfile,
  type Platform,
  type PublishingSummary,
  type ScheduledPost,
  type SocialAccount,
} from "./api";
import { GeographyPicker } from "./GeographyPicker";
import { CookieNotice, LegalLinks, LegalPage, type LegalPageKey } from "./LegalPages";

const strategyOptions = [
  ["awareness", "Awareness"],
  ["consideration", "Consideration"],
  ["conversion", "Conversion"],
  ["retention", "Retention"],
  ["advocacy", "Advocacy"],
  ["education", "Education"],
  ["product-launch", "Product launch"],
  ["community", "Community"],
] as const;

const platforms: { id: Platform; label: string; icon: typeof Facebook }[] = [
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "x", label: "X", icon: X },
  { id: "tiktok", label: "TikTok", icon: Video },
];

type AuthResponse = { access_token: string; expires_in: number };
type View = "overview" | "channels" | "campaigns" | "assets";
type ProviderFormRow = { provider: LLMProvider; model: string; api_key: string; priority: number };

async function uploadToCloudinary(source: File | string, intent: CloudinaryUploadIntent): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.set("file", source);
  form.set("api_key", intent.api_key);
  form.set("allowed_formats", intent.allowed_formats);
  form.set("timestamp", String(intent.timestamp));
  form.set("public_id", intent.public_id);
  form.set("type", intent.type);
  form.set("overwrite", intent.overwrite);
  form.set("signature", intent.signature);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(intent.cloud_name)}/${intent.resource_type}/upload`,
    { method: "POST", body: form },
  );
  const result = await response.json().catch(() => undefined) as
    | (CloudinaryUploadResult & { error?: { message?: string } })
    | undefined;
  if (!response.ok || !result?.public_id || !result.version || !result.signature || !result.resource_type) {
    throw new Error(result?.error?.message || `Cloudinary upload failed (${response.status}).`);
  }
  return result;
}

const providerOptions: { id: LLMProvider; label: string; model: string }[] = [
  { id: "gemini", label: "Google Gemini", model: "gemini-3.5-flash-lite" },
  { id: "openai", label: "OpenAI", model: "gpt-4.1-mini" },
  { id: "anthropic", label: "Anthropic", model: "claude-3-7-sonnet-latest" },
  { id: "openrouter", label: "OpenRouter", model: "openrouter/auto" },
  { id: "groq", label: "Groq", model: "llama-3.3-70b-versatile" },
];

export default function App() {
  const [token, setToken] = useState("");
  const [tokenExpiresAt, setTokenExpiresAt] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [legalPage, setLegalPage] = useState<LegalPageKey | null>(() => {
    const requested = new URLSearchParams(window.location.search).get("legal");
    return requested === "privacy" || requested === "cookies" || requested === "terms"
      ? requested
      : null;
  });
  const [apiHealth, setApiHealth] = useState<"checking" | "healthy" | "unavailable">("checking");
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [generationJobs, setGenerationJobs] = useState<CampaignGenerationJob[]>([]);
  const [publishingSummary, setPublishingSummary] = useState<PublishingSummary>({
    scheduled: 0,
    processing: 0,
    published: 0,
    failed: 0,
    needs_attention: 0,
  });
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(false);
  const [planningCampaignId, setPlanningCampaignId] = useState("");
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [autoApprovePosts, setAutoApprovePosts] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [mediaCampaign, setMediaCampaign] = useState<Campaign | null>(null);
  const [profileAccount, setProfileAccount] = useState<SocialAccount | null>(null);
  const [profileDraft, setProfileDraft] = useState<PageProfile | null>(null);
  const [tiktokSetupAccount, setTikTokSetupAccount] = useState<SocialAccount | null>(null);
  const [tiktokSession, setTikTokSession] = useState<{ connected: boolean; expires_at: string | null } | null>(null);
  const [scheduleCampaign, setScheduleCampaign] = useState<Campaign | null>(null);
  const [postsCampaign, setPostsCampaign] = useState<Campaign | null>(null);
  const [campaignPosts, setCampaignPosts] = useState<ScheduledPost[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    account_id: "",
    asset_id: "",
    text: "",
    scheduled_at: "",
  });
  const [aiAccountId, setAiAccountId] = useState<string | null>(null);
  const [aiProviderRows, setAIProviderRows] = useState<ProviderFormRow[]>([]);
  const [savedAIProviders, setSavedAIProviders] = useState<AIProviderConfig[]>([]);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetUrl, setAssetUrl] = useState("");
  const [assetAccountId, setAssetAccountId] = useState("");
  const [assetAssignmentAccounts, setAssetAssignmentAccounts] = useState<Record<string, string>>({});
  const [account, setAccount] = useState({
    platform: "facebook" as Platform,
    display_name: "",
    external_id: "",
    credentials: "",
    expires_at: "",
  });
  const [campaign, setCampaign] = useState({
    name: "",
    objective: "",
    strategies: ["awareness"] as string[],
    tone: "Warm and helpful",
    geography: { countries: [], regions: [], cities: [], districts: [] } as CampaignGeography,
    starts_at: "",
    ends_at: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    account_ids: [] as string[],
    schedule_mode: "auto" as "auto" | "specific_times",
    specific_times: "10:00, 16:00",
    latitude: "",
    longitude: "",
    faith_guidance: true,
  });

  const channelCount = useMemo(() => new Set(accounts.map((item) => item.platform)).size, [accounts]);

  function applyAuth(result: AuthResponse) {
    setToken(result.access_token);
    setTokenExpiresAt(Date.now() + result.expires_in * 1000);
  }

  function openLegalPage(page: LegalPageKey) {
    const url = new URL(window.location.href);
    url.searchParams.set("legal", page);
    window.history.pushState({ legal: page }, "", `${url.pathname}${url.search}${url.hash}`);
    setLegalPage(page);
  }

  function closeLegalPage() {
    const url = new URL(window.location.href);
    url.searchParams.delete("legal");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setLegalPage(null);
  }

  useEffect(() => {
    function syncLegalPage() {
      const requested = new URLSearchParams(window.location.search).get("legal");
      setLegalPage(
        requested === "privacy" || requested === "cookies" || requested === "terms"
          ? requested
          : null,
      );
    }
    window.addEventListener("popstate", syncLegalPage);
    return () => window.removeEventListener("popstate", syncLegalPage);
  }, []);

  useEffect(() => {
    let active = true;
    api<AuthResponse>("/api/auth/refresh", undefined, { method: "POST" })
      .then(async (result) => {
        const user = await api<{ email: string }>("/api/me", result.access_token);
        if (active) {
          applyAuth(result);
          setEmail(user.email);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setAuthRestoring(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !tokenExpiresAt) return undefined;
    const refreshDelay = Math.max(1000, tokenExpiresAt - Date.now() - 60_000);
    const timer = window.setTimeout(() => {
      api<AuthResponse>("/api/auth/refresh", undefined, { method: "POST" })
        .then(applyAuth)
        .catch(() => {
          setToken("");
          setTokenExpiresAt(0);
          setEmail("");
        });
    }, refreshDelay);
    return () => window.clearTimeout(timer);
  }, [token, tokenExpiresAt]);

  async function refreshData(activeToken: string) {
    const [nextAccounts, nextCampaigns, nextAssets, generationResponse, nextPublishingSummary] = await Promise.all([
      api<SocialAccount[]>("/api/accounts", activeToken),
      api<Campaign[]>("/api/campaigns", activeToken),
      api<MarketingAsset[]>("/api/assets", activeToken),
      api<{ jobs: CampaignGenerationJob[] }>("/api/campaign-generations", activeToken),
      api<PublishingSummary>("/api/publishing/summary", activeToken),
    ]);
    setAccounts(nextAccounts);
    setCampaigns(nextCampaigns);
    setAssets(nextAssets);
    setGenerationJobs(generationResponse.jobs);
    setPublishingSummary(nextPublishingSummary);
    setAssetAccountId((current) => nextAccounts.some((item) => item.id === current)
      ? current
      : nextAccounts[0]?.id ?? "");
  }

  useEffect(() => {
    if (!token) return;
    refreshData(token).catch((cause: Error) => setError(cause.message));
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    async function refreshAutomationStatus() {
      try {
        const [generationResponse, nextPublishingSummary] = await Promise.all([
          api<{ jobs: CampaignGenerationJob[] }>("/api/campaign-generations", token),
          api<PublishingSummary>("/api/publishing/summary", token),
        ]);
        if (active) {
          setGenerationJobs(generationResponse.jobs);
          setPublishingSummary(nextPublishingSummary);
        }
      } catch (cause) {
        if (active) setError((cause as Error).message);
      }
    }
    void refreshAutomationStatus();
    const timer = window.setInterval(refreshAutomationStatus, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    let active = true;
    async function checkHealth() {
      try {
        await api<{ status: string }>("/health");
        if (active) setApiHealth("healthy");
      } catch {
        if (active) setApiHealth("unavailable");
      }
    }
    void checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    if (authMode === "register" && password !== confirmPassword) {
      setAuthError("The passwords do not match.");
      return;
    }
    if (authMode === "register" && !termsAccepted) {
      setAuthError("Please accept the Terms of Service to create an account.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const result = await api<AuthResponse>(`/api/auth/${authMode}`, undefined, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          remember_me: rememberMe,
          ...(authMode === "register" ? { terms_accepted: termsAccepted } : {}),
        }),
      });
      applyAuth(result);
      setEmail(email.trim());
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setAuthError((cause as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let credentials: Record<string, string> = {};
      if (account.platform !== "tiktok") {
        try {
          credentials = JSON.parse(account.credentials) as Record<string, string>;
        } catch {
          throw new Error('Enter credentials as JSON, e.g. {"access_token":"…"}');
        }
      }
      const created = await api<SocialAccount>("/api/accounts", token, {
        method: "POST",
        body: JSON.stringify({
          platform: account.platform,
          display_name: account.display_name,
          external_id: account.external_id,
          credentials,
          expires_at: account.expires_at ? new Date(account.expires_at).toISOString() : null,
        }),
      });
      await refreshData(token);
      setShowAccountForm(false);
      setAccount({ platform: "facebook", display_name: "", external_id: "", credentials: "", expires_at: "" });
      setMessage("Channel saved. Configure at least one page-specific AI provider before creating campaigns.");
      await openAISettings(created.id);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openAISettings(accountId: string) {
    setError("");
    setMessage("");
    try {
      const configured = await api<AIProviderConfig[]>(`/api/accounts/${accountId}/ai-providers`, token);
      setSavedAIProviders(configured);
      setAIProviderRows(configured.length
        ? configured.map(({ provider, model, priority }) => ({ provider, model, priority, api_key: "" }))
        : [{ provider: "gemini", model: "gemini-3.5-flash-lite", priority: 1, api_key: "" }]);
      setAiAccountId(accountId);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  function addAIProvider() {
    const available = providerOptions.find((option) => !aiProviderRows.some((row) => row.provider === option.id));
    if (!available) {
      setError("All supported providers are already configured for this page.");
      return;
    }
    setAIProviderRows((rows) => [...rows, {
      provider: available.id,
      model: available.model,
      priority: rows.length + 1,
      api_key: "",
    }]);
    setError("");
  }

  async function saveAISettings(event: React.FormEvent) {
    event.preventDefault();
    if (!aiAccountId || aiProviderRows.length === 0) {
      setError("Keep at least one verified AI provider configured for this page.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const remaining = new Set(aiProviderRows.map((row) => row.provider));
      for (const saved of savedAIProviders) {
        if (!remaining.has(saved.provider)) {
          await api(`/api/accounts/${aiAccountId}/ai-providers/${saved.provider}`, token, { method: "DELETE" });
        }
      }
      for (const row of aiProviderRows) {
        await api<AIProviderConfig>(`/api/accounts/${aiAccountId}/ai-providers/${row.provider}`, token, {
          method: "PUT",
          body: JSON.stringify({
            model: row.model,
            priority: row.priority,
            ...(row.api_key ? { api_key: row.api_key } : {}),
          }),
        });
      }
      setSavedAIProviders(await api<AIProviderConfig[]>(`/api/accounts/${aiAccountId}/ai-providers`, token));
      setAIProviderRows((rows) => rows.map((row) => ({ ...row, api_key: "" })));
      setAiAccountId(null);
      setMessage("Provider keys verified and saved encrypted for this page. They are never sent to Hugging Face.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openProfileSettings(item: SocialAccount) {
    setProfileAccount(item);
    setProfileDraft(item.profile);
  }

  async function openTikTokSetup(item: SocialAccount) {
    setTikTokSetupAccount(item);
    setTikTokSession(null);
    setError("");
    try {
      setTikTokSession(await api<{ connected: boolean; expires_at: string | null }>(
        `/api/accounts/${item.id}/browser-session`,
        token,
      ));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function saveProfileSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!profileAccount || !profileDraft) return;
    setBusy(true);
    setError("");
    try {
      await api<SocialAccount>(`/api/accounts/${profileAccount.id}/profile`, token, {
        method: "PUT",
        body: JSON.stringify(profileDraft),
      });
      await refreshData(token);
      setProfileAccount(null);
      setProfileDraft(null);
      setMessage("Page language, brand kit, and faith-presentation preferences saved.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCampaign(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const specificTimes = campaign.specific_times
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      await api("/api/campaigns", token, {
        method: "POST",
        body: JSON.stringify({
          name: campaign.name,
          objective: campaign.objective,
          strategies: campaign.strategies,
          tone: campaign.tone,
          geography: campaign.geography,
          starts_at: new Date(campaign.starts_at).toISOString(),
          ends_at: new Date(campaign.ends_at).toISOString(),
          timezone: campaign.timezone,
          account_ids: campaign.account_ids,
          planning_preferences: {
            schedule_mode: campaign.schedule_mode,
            specific_times: campaign.schedule_mode === "specific_times" ? specificTimes : [],
            latitude: campaign.latitude.trim() ? Number(campaign.latitude) : null,
            longitude: campaign.longitude.trim() ? Number(campaign.longitude) : null,
            faith_guidance: campaign.faith_guidance,
          },
        }),
      });
      await refreshData(token);
      setShowCampaignForm(false);
      setMessage("Campaign saved. Schedule approved posts for its selected channels.");
    } catch (cause) {
      setError((cause as Error).message || "Campaign could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function openScheduleForm(item: Campaign) {
    const firstAccount = item.account_ids[0] ?? "";
    const date = new Date(item.starts_at);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setScheduleForm({
      account_id: firstAccount,
      asset_id: "",
      text: "",
      scheduled_at: date.toISOString().slice(0, 16),
    });
    setScheduleCampaign(item);
    setError("");
  }

  async function generateCampaignPlan(item: Campaign, rolling = false) {
    setBusy(true);
    setPlanningCampaignId(item.id);
    setError("");
    setMessage("");
    try {
      const result = await api<{
        posts_created: number;
        days_planned: number;
        news_headlines_used: number;
        rolling_generation: boolean;
        next_batch_at: string | null;
        requires_review: boolean;
      }>(
        `/api/campaigns/${item.id}/generate-plan`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            days: 7,
            offset_days: 0,
            posts_per_day: postsPerDay,
            rolling_generation: rolling,
            auto_approve: autoApprovePosts,
          }),
        },
      );
      await refreshData(token);
      const reviewMessage = result.requires_review
        ? "Review every draft before approving it for publishing."
        : "Generated posts are approved and may publish automatically at their scheduled times.";
      const rollingMessage = result.rolling_generation && result.next_batch_at
        ? ` The next seven-day batch is scheduled for ${new Date(result.next_batch_at).toLocaleString()}.`
        : "";
      setMessage(
        `Created ${result.posts_created} posts across ${result.days_planned} days at ${postsPerDay} post${postsPerDay === 1 ? "" : "s"} per page per day; ${result.news_headlines_used} news headlines were available. ${reviewMessage}${rollingMessage}`,
      );
      await openCampaignPosts(item);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setPlanningCampaignId("");
    }
  }

  async function resumeCampaignGeneration(item: Campaign) {
    setBusy(true);
    setPlanningCampaignId(item.id);
    setError("");
    setMessage("");
    try {
      await api<CampaignGenerationJob>(`/api/campaign-generations/${item.id}/resume`, token, {
        method: "POST",
      });
      await refreshData(token);
      setMessage(`Rolling generation for “${item.name}” has been resumed from its next ungenerated batch. The worker will process it on its next run.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setPlanningCampaignId("");
    }
  }

  async function openCampaignPosts(item: Campaign) {
    setError("");
    try {
      const posts = await api<ScheduledPost[]>(`/api/campaigns/${item.id}/posts`, token);
      setCampaignPosts(posts);
      setPostsCampaign(item);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function approvePost(post: ScheduledPost) {
    if (!postsCampaign) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/campaigns/${postsCampaign.id}/posts/${post.id}/approve`, token, { method: "POST" });
      setCampaignPosts(await api<ScheduledPost[]>(`/api/campaigns/${postsCampaign.id}/posts`, token));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removePost(post: ScheduledPost) {
    if (!postsCampaign) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/campaigns/${postsCampaign.id}/posts/${post.id}`, token, { method: "DELETE" });
      setCampaignPosts((items) => items.filter((item) => item.id !== post.id));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateScheduledCopy() {
    if (!scheduleCampaign || !scheduleForm.account_id) {
      setError("Choose a campaign channel before generating copy.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const channel = accounts.find((item) => item.id === scheduleForm.account_id);
      const asset = assets.find((item) => item.id === scheduleForm.asset_id);
      const result = await api<{ text: string; provider: LLMProvider; model: string }>(
        `/api/accounts/${scheduleForm.account_id}/ai/generate`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: [
              `Write a social post for ${channel?.platform ?? "this page"}.`,
              `Campaign: ${scheduleCampaign.name}.`,
              `Objective: ${scheduleCampaign.objective}.`,
              `Marketing strategies: ${scheduleCampaign.strategies.join(", ")}.`,
              `Page voice: ${scheduleCampaign.tone}.`,
              asset ? `Use this asset context: ${asset.description}. Labels: ${asset.labels.join(", ")}.` : "",
              "Use only facts in the brief, avoid unsupported claims, keep it natural, and return only the post copy.",
            ].filter(Boolean).join("\n"),
          }),
        },
      );
      setScheduleForm((form) => ({ ...form, text: result.text }));
      setMessage(`Copy generated with ${result.provider} (${result.model}); review it before scheduling.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveScheduledPost(event: React.FormEvent) {
    event.preventDefault();
    if (!scheduleCampaign) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/campaigns/${scheduleCampaign.id}/posts`, token, {
        method: "POST",
        body: JSON.stringify({
          ...scheduleForm,
          asset_id: scheduleForm.asset_id || null,
          scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
          idempotency_key: crypto.randomUUID(),
        }),
      });
      setScheduleCampaign(null);
      setMessage("Post queued for the selected time. The publishing worker will report its outcome.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnectAccount(id: string) {
    if (!window.confirm("Disconnect this social account? Scheduled posts for this channel will no longer run.")) return;
    setError("");
    try {
      await api(`/api/accounts/${id}`, token, { method: "DELETE" });
      await refreshData(token);
      setMessage("Channel disconnected.");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function validateAccount(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ display_name: string; verified_at: string }>(`/api/accounts/${id}/validate`, token, { method: "POST" });
      await refreshData(token);
      setMessage(`${result.display_name} credentials verified with the platform.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAsset(event: React.FormEvent) {
    event.preventDefault();
    if (!assetFile || !assetAccountId) {
      setError("Choose the page that owns this media before uploading.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const intent = await api<CloudinaryUploadIntent>("/api/assets/upload-signature", token, {
        method: "POST",
        body: JSON.stringify({
          account_id: assetAccountId,
          media_type: assetFile.type,
          original_name: assetFile.name,
          file_size: assetFile.size,
        }),
      });
      const uploaded = await uploadToCloudinary(assetFile, intent);
      await api<MarketingAsset>("/api/assets/complete", token, {
        method: "POST",
        body: JSON.stringify({
          public_id: uploaded.public_id,
          version: uploaded.version,
          signature: uploaded.signature,
          resource_type: uploaded.resource_type,
          original_name: assetFile.name,
          account_id: assetAccountId,
        }),
      });
      await refreshData(token);
      setAssetFile(null);
      setMessage("Media uploaded directly to Cloudinary and analyzed by the Hugging Face inference service.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importAssetFromUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!assetAccountId) {
      setError("Choose the page that owns this media before importing.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const intent = await api<CloudinaryUploadIntent>("/api/assets/from-url", token, {
        method: "POST",
        body: JSON.stringify({ account_id: assetAccountId, url: assetUrl }),
      });
      const uploaded = await uploadToCloudinary(assetUrl, intent);
      const originalName = decodeURIComponent(new URL(assetUrl).pathname.split("/").pop() || "external-media");
      await api<MarketingAsset>("/api/assets/complete", token, {
        method: "POST",
        body: JSON.stringify({
          public_id: uploaded.public_id,
          version: uploaded.version,
          signature: uploaded.signature,
          resource_type: uploaded.resource_type,
          original_name: originalName,
          account_id: assetAccountId,
        }),
      });
      await refreshData(token);
      setAssetUrl("");
      setMessage("Linked media uploaded to Cloudinary and analyzed by the Hugging Face inference service.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function assignAssetToAccount(asset: MarketingAsset) {
    const accountId = assetAssignmentAccounts[asset.id];
    if (!accountId) {
      setError("Choose a page before assigning this existing asset.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api<MarketingAsset>(`/api/assets/${asset.id}/account`, token, {
        method: "PUT",
        body: JSON.stringify({ account_id: accountId }),
      });
      await refreshData(token);
      setMessage(`“${asset.original_name}” is now organized under ${accounts.find((item) => item.id === accountId)?.display_name ?? "the selected page"}.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function renderAssetCard(item: MarketingAsset) {
    return (
      <article className="asset-card" key={item.id}>
        {item.analysis_status === "needs_reupload"
          ? <div className="asset-unavailable">This asset is in the previous storage provider. Re-upload it to Cloudinary to use it.</div>
          : item.media_type.startsWith("video/")
            ? <video controls playsInline preload="metadata" aria-label={item.description || item.original_name}><source src={item.download_url} type={item.media_type} /></video>
            : item.media_type.startsWith("audio/")
              ? <audio controls preload="metadata" aria-label={item.description || item.original_name}><source src={item.download_url} type={item.media_type} /></audio>
            : <img src={item.download_url} alt={item.description || item.original_name} />}
        <div className="asset-card-copy">
          <b>{item.original_name}</b>
          <small className="asset-description">{item.description}</small>
          <small>{item.analysis_status === "complete" ? item.labels.slice(0, 5).join(" · ") : item.analysis_status === "needs_reupload" ? "Re-upload required" : "Analysis pending"}</small>
        </div>
        {item.account_id === null && accounts.length > 0 && (
          <div className="asset-assignment">
            <label htmlFor={`asset-account-${item.id}`}>Assign legacy asset to a page</label>
            <select
              id={`asset-account-${item.id}`}
              value={assetAssignmentAccounts[item.id] ?? ""}
              onChange={(event) => setAssetAssignmentAccounts((current) => ({ ...current, [item.id]: event.target.value }))}
            >
              <option value="">Choose page</option>
              {accounts.map((channel) => <option value={channel.id} key={channel.id}>{channel.display_name} · {channel.platform}</option>)}
            </select>
            <button type="button" className="button secondary" disabled={busy || !assetAssignmentAccounts[item.id]} onClick={() => assignAssetToAccount(item)}>Assign to page</button>
          </div>
        )}
      </article>
    );
  }

  async function signOut() {
    try {
      await api<void>("/api/auth/logout", undefined, { method: "POST" });
    } catch (cause) {
      setAuthError(`Signed out on this device, but the server could not revoke the remembered session: ${(cause as Error).message}`);
    } finally {
      setToken("");
      setTokenExpiresAt(0);
      setAccounts([]);
      setCampaigns([]);
      setAssets([]);
      setGenerationJobs([]);
      setPublishingSummary({ scheduled: 0, processing: 0, published: 0, failed: 0, needs_attention: 0 });
      setEmail("");
      setView("overview");
    }
  }

  if (legalPage) {
    return (
      <>
        <LegalPage page={legalPage} onNavigate={openLegalPage} onBack={closeLegalPage} />
        <CookieNotice onOpenPolicy={() => openLegalPage("cookies")} />
      </>
    );
  }

  if (authRestoring) {
    return (
      <div className="auth-page" aria-busy="true">
        <main className="auth-card" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={22} aria-hidden="true" />
          <p>Checking for a saved sign-in…</p>
        </main>
        <CookieNotice onOpenPolicy={() => openLegalPage("cookies")} />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="auth-page">
        <a className="skip-link" href="#auth-form">Skip to sign-in form</a>
        <div className="auth-brand"><span className="brand-icon" aria-hidden="true">g</span><span><b>GPD Studio</b><small>Marketing, made meaningful.</small></span></div>
        <main className="auth-card" id="auth-form">
          <div className="auth-eyebrow"><Sparkles size={14} aria-hidden="true" /> YOUR SOCIAL WORKSPACE</div>
          <h1>{authMode === "login" ? "Welcome back." : "Create your studio."}</h1>
          <p>Plan thoughtful campaigns and bring every channel into one place.</p>
          <form onSubmit={authenticate} className="stack-form" aria-busy={authBusy}>
            <label htmlFor="auth-email">Email address<input id="auth-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label htmlFor="auth-password">Password</label>
            <div className="password-field">
              <input
                id="auth-password"
                type={showPasswords ? "text" : "password"}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                minLength={authMode === "register" ? 12 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={authMode === "register" ? "password-guidance" : undefined}
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPasswords ? "Hide password" : "Show password"}
                aria-pressed={showPasswords}
                onClick={() => setShowPasswords((visible) => !visible)}
              >
                {showPasswords ? "Hide" : "Show"}
              </button>
            </div>
            {authMode === "register" && (
              <>
                <small id="password-guidance" className="auth-guidance">
                  Use at least 12 characters, including an uppercase letter, a lowercase letter, and a number.
                </small>
                <label htmlFor="auth-confirm-password">Confirm password</label>
                <input
                  id="auth-confirm-password"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={!!confirmPassword && password !== confirmPassword}
                  aria-describedby={confirmPassword && password !== confirmPassword ? "password-mismatch" : undefined}
                />
                {!!confirmPassword && password !== confirmPassword && (
                  <small id="password-mismatch" className="error-text" role="alert">
                    The passwords do not match.
                  </small>
                )}
              </>
            )}
            <label className="auth-check-row">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Remember me on this device</span>
            </label>
            <small className="auth-guidance">
              When selected, your secure session lasts until you sign out or is inactive for 400 days.
            </small>
            {authMode === "register" && (
              <div className="auth-terms">
                <p>Review the <a href="/?legal=terms" onClick={(event) => { event.preventDefault(); openLegalPage("terms"); }}>Terms of Service</a> and <a href="/?legal=privacy" onClick={(event) => { event.preventDefault(); openLegalPage("privacy"); }}>Privacy Policy</a>.</p>
                <label className="auth-check-row">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                  />
                  <span>I agree to the Terms of Service and acknowledge the Privacy Policy.</span>
                </label>
              </div>
            )}
            {authError && <p className="error-text" role="alert" aria-live="assertive">{authError}</p>}
            <button className="button primary wide" type="submit" disabled={authBusy || (authMode === "register" && password !== confirmPassword)}>
              {authBusy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
              {authMode === "login" ? "Sign in" : "Create account"}
              {!authBusy && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </form>
          <button className="auth-switch" type="button" onClick={() => {
            setAuthMode(authMode === "login" ? "register" : "login");
            setAuthError("");
            setConfirmPassword("");
            setTermsAccepted(false);
          }}>
            {authMode === "login" ? "New to GPD Studio? Create an account" : "Already have an account? Sign in"}
          </button>
          <div className="auth-security"><LockKeyhole size={13} aria-hidden="true" /> Channel credentials are encrypted at rest.</div>
          <LegalLinks onNavigate={openLegalPage} />
        </main>
        <div className="auth-orbit orbit-one" aria-hidden="true" /><div className="auth-orbit orbit-two" aria-hidden="true" />
        <CookieNotice onOpenPolicy={() => openLegalPage("cookies")} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setView("overview")}><span className="brand-icon">g</span><span><b>GPD Studio</b><small>Marketing workspace</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button type="button" aria-current={view === "overview" ? "page" : undefined} className={view === "overview" ? "selected" : ""} onClick={() => setView("overview")}><Target size={17} aria-hidden="true" /> Overview</button>
          <button type="button" aria-current={view === "channels" ? "page" : undefined} className={view === "channels" ? "selected" : ""} onClick={() => setView("channels")}><Send size={17} aria-hidden="true" /> Channels <span className="nav-count">{accounts.length}</span></button>
          <button type="button" aria-current={view === "campaigns" ? "page" : undefined} className={view === "campaigns" ? "selected" : ""} onClick={() => setView("campaigns")}><CalendarDays size={17} aria-hidden="true" /> Campaigns <span className="nav-count">{campaigns.length}</span></button>
          <button type="button" aria-current={view === "assets" ? "page" : undefined} className={view === "assets" ? "selected" : ""} onClick={() => setView("assets")}><FileImage size={17} aria-hidden="true" /> Assets <span className="nav-count">{assets.length}</span></button>
        </nav>
        <div className="sidebar-fill" />
        <div className="side-note"><Sparkles size={15} /><b>Better stories, together.</b><p>One calm place to plan your next good idea.</p></div>
        <button className="profile-button" onClick={signOut}><span className="profile-avatar">{email.slice(0, 1).toUpperCase() || "G"}</span><span><b>{email || "Your workspace"}</b><small>Sign out</small></span><LogOut size={15} /></button>
      </aside>

      <main className="main-area" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="top-crumb">Workspace <span>/</span> <b>{view[0].toUpperCase() + view.slice(1)}</b></div>
          <div className="top-actions"><div className={`system-status ${apiHealth}`} role="status" aria-live="polite"><i aria-hidden="true" />{apiHealth === "healthy" ? "API healthy" : apiHealth === "checking" ? "Checking API" : "API unavailable"}</div><a className="icon-button" href="mailto:albertmkwanda@gmail.com?subject=GPD%20Studio%20help" aria-label="Email GPD Studio support"><CircleHelp size={17} aria-hidden="true" /></a><span className="top-avatar" role="img" aria-label={`Signed in as ${email}`}>{email.slice(0, 1).toUpperCase() || "G"}</span></div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span /> THE WORK BEHIND THE GOOD WORK</div><h1>{view === "overview" ? "Make your next move." : view === "channels" ? "Your channels, together." : view === "campaigns" ? "Campaigns with intention." : "A library with insight."}</h1><p>Build a consistent voice, connect the right people, and grow with purpose.</p></div>
            <div className="date-chip"><CalendarDays size={15} /> {new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</div>
          </section>

          {(error || message) && <div className={`notice ${error ? "notice-error" : ""}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}><span>{error || message}</span><button type="button" aria-label="Dismiss notification" onClick={() => { setError(""); setMessage(""); }}><X size={15} aria-hidden="true" /></button></div>}

          <div className="metric-grid">
            <article className="metric-card"><span className="metric-icon green"><Send size={17} /></span><span className="metric-label">SAVED CHANNELS</span><strong>{accounts.length}<small> / 4</small></strong><p>{channelCount} platforms represented</p></article>
            <article className="metric-card"><span className="metric-icon lilac"><CalendarDays size={17} /></span><span className="metric-label">ACTIVE CAMPAIGNS</span><strong>{campaigns.length}</strong><p>Across your connected pages</p></article>
            <article className="metric-card"><span className="metric-icon amber"><Clock3 size={17} /></span><span className="metric-label">SCHEDULED POSTS</span><strong>{publishingSummary.scheduled + publishingSummary.processing}</strong><p>{publishingSummary.published} published · {publishingSummary.needs_attention + publishingSummary.failed} need attention</p></article>
            <article className="metric-card"><span className="metric-icon rose"><HeartHandshake size={17} /></span><span className="metric-label">ASSETS ANALYZED</span><strong>{assets.length}</strong><p>Images described and labeled</p></article>
          </div>

          <section className="content-card">
            <div className="section-head">
              <div><div className="section-kicker">YOUR WORKSPACE</div><h2>{view === "channels" ? "Connected channels" : view === "campaigns" ? "Your campaigns" : view === "assets" ? "Creative assets" : "Start with a strong foundation"}</h2><p>{view === "channels" ? "Connect the pages and profiles you manage." : view === "campaigns" ? "Bring your goals, strategy, and audience into focus." : view === "assets" ? "Upload or link images, videos, and audio to keep each channel's media organized." : "Connect your pages, then shape a campaign around what matters."}</p></div>
              <div className="section-buttons">
                {(view === "channels" || view === "overview") && <button className="button secondary" onClick={() => setShowAccountForm(true)}><Plus size={16} /> Connect a channel</button>}
                {(view === "campaigns" || view === "overview") && <button className="button primary" onClick={() => setShowCampaignForm(true)}><Sparkles size={15} /> New campaign</button>}
                {view === "assets" && <button className="button primary" onClick={() => document.getElementById("asset-file-input")?.click()}><ImagePlus size={15} /> Upload image</button>}
              </div>
            </div>

            {view === "campaigns" ? (
              campaigns.length ? <>
                <div className="campaign-generation-settings">
                  <label>Posts per page, per day
                    <select value={postsPerDay} onChange={(event) => setPostsPerDay(Number(event.target.value))}>
                      <option value={1}>1 post</option>
                      <option value={2}>2 posts</option>
                      <option value={3}>3 posts</option>
                    </select>
                  </label>
                  <label className="auto-approve-option">
                    <input type="checkbox" checked={autoApprovePosts} onChange={(event) => setAutoApprovePosts(event.target.checked)} />
                    <span>Auto-approve generated posts</span>
                  </label>
                  <p>Auto-approved posts can publish automatically when their scheduled time arrives. Turn this off to review every post first.</p>
                </div>
                {planningCampaignId && (
                  <div className="generation-progress" role="status" aria-live="polite" aria-busy="true">
                    <LoaderCircle className="spin" size={18} aria-hidden="true" />
                    <div><b>Building your campaign plan</b><span>Creating post copy and page-specific imagery. This can take a few minutes.</span></div>
                    <span className="generation-progress-bar" aria-hidden="true" />
                  </div>
                )}
                <div className="campaign-list">{campaigns.map((item) => {
                  const generation = generationJobs.find((job) => job.campaign_id === item.id);
                  return <article className="campaign-row" key={item.id}>
                    <span className="campaign-icon"><Target size={17} /></span>
                    <div className="campaign-main">
                      <b>{item.name}</b><p>{item.objective}</p>
                      <div className="tag-row">{item.strategies.map((strategy) => <span className="tag" key={strategy}>{strategy.replace("-", " ")}</span>)}</div>
                      {generation && <small className={`generation-status ${generation.status === "failed" ? "failed" : ""}`}>
                        {generation.status === "active"
                          ? `Rolling generation · batch ${generation.generated_batches} · next run ${new Date(generation.next_run_at).toLocaleString()}`
                          : generation.status === "processing"
                            ? "Generating the next campaign batch…"
                            : generation.status === "failed"
                              ? `Rolling generation paused: ${generation.last_error || "The last batch failed."}`
                              : `Campaign generation ${generation.status}`}
                      </small>}
                    </div>
                    <div className="campaign-date">{new Date(item.starts_at).toLocaleDateString()} – {new Date(item.ends_at).toLocaleDateString()}</div>
                    <div className="campaign-actions">
                      <button className="button secondary" disabled={busy || !item.account_ids.length} onClick={() => generateCampaignPlan(item)}>Generate 7 days</button>
                      <button className="button secondary" disabled={busy || !item.account_ids.length || generation?.status === "active" || generation?.status === "processing" || generation?.status === "completed"} onClick={() => generation?.status === "failed" ? resumeCampaignGeneration(item) : generateCampaignPlan(item, true)}>{generation?.status === "failed" ? "Resume rolling" : generation?.status === "active" ? "Rolling active" : generation?.status === "completed" ? "Rolling complete" : "Generate campaign"}</button>
                      <button className="button secondary" onClick={() => openCampaignPosts(item)}>Review posts</button>
                      <button className="button secondary" onClick={() => setMediaCampaign(item)}><Video size={14} /> Media studio</button>
                      <button className="button secondary" onClick={() => openScheduleForm(item)} disabled={!item.account_ids.length}>Create post</button>
                    </div>
                  </article>;
                })}</div>
              </> : <EmptyState icon={<CalendarDays size={21} />} title="No campaigns just yet" text="Create a campaign to define your goal, audience, tone, and channels." action="Create campaign" onAction={() => setShowCampaignForm(true)} />
            ) : view === "channels" ? (
              accounts.length ? <div className="channel-grid">{accounts.map((item) => <ChannelCard key={item.id} account={item} onRemove={disconnectAccount} onAIConfigure={openAISettings} onValidate={validateAccount} onProfile={openProfileSettings} onTikTokSetup={openTikTokSetup} />)}<button className="add-channel-card" onClick={() => setShowAccountForm(true)}><span><Plus size={19} /></span><b>Connect another channel</b><small>Facebook · Instagram · X · TikTok</small></button></div> : <EmptyState icon={<Send size={21} />} title="Your social channels live here" text="Connect a page or profile to start building cross-channel campaigns." action="Connect a channel" onAction={() => setShowAccountForm(true)} />
            ) : view === "assets" ? (
              <div className="asset-library">
                <label className="asset-page-select" htmlFor="asset-page-select">Save new media under
                  <select id="asset-page-select" required value={assetAccountId} onChange={(event) => setAssetAccountId(event.target.value)} disabled={!accounts.length}>
                    <option value="">Choose a page</option>
                    {accounts.map((channel) => <option value={channel.id} key={channel.id}>{channel.display_name} · {channel.platform}</option>)}
                  </select>
                </label>
                {!accounts.length && <p className="form-hint">Connect a social channel before uploading assets so each file has a clear page owner.</p>}
                <form className="asset-upload" onSubmit={uploadAsset}>
                  <input id="asset-file-input" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/flac" onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)} />
                  <div className="asset-upload-icon"><ImagePlus size={19} /></div>
                  <b>{assetFile ? assetFile.name : "Choose an image, video, or audio file"}</b>
                  <small>JPEG, PNG, WebP, MP4, WebM, MOV, MP3, WAV, M4A, OGG or FLAC · images 12 MB, audio 25 MB, video 100 MB</small>
                  <div className="asset-upload-actions"><button type="button" className="button secondary" disabled={!accounts.length} onClick={() => document.getElementById("asset-file-input")?.click()}><FileImage size={14} /> Choose file</button><button type="submit" className="button primary" disabled={!assetFile || !assetAccountId || busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} Upload &amp; analyze</button></div>
                </form>
                <form className="asset-url-import" onSubmit={importAssetFromUrl}>
                  <label htmlFor="asset-url-input">Or import a direct media link</label>
                  <div><input id="asset-url-input" type="url" required inputMode="url" placeholder="https://example.com/campaign-image.jpg" value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} /><button className="button secondary" type="submit" disabled={!assetUrl || !assetAccountId || busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />} Import URL</button></div>
                  <small>Public HTTPS direct-media links · images 12 MB, audio 25 MB, video 100 MB · no redirects</small>
                </form>
                {assets.length ? <>
                  {accounts.map((channel) => {
                    const pageAssets = assets.filter((item) => item.account_id === channel.id);
                    return <section className="asset-page-group" key={channel.id}>
                      <header><div><b>{channel.display_name}</b><small>{channel.platform}</small></div><span>{pageAssets.length} asset{pageAssets.length === 1 ? "" : "s"}</span></header>
                      {pageAssets.length
                        ? <div className="asset-grid">{pageAssets.map(renderAssetCard)}</div>
                        : <p className="asset-page-empty">No media saved for this page yet.</p>}
                    </section>;
                  })}
                  {assets.some((item) => item.account_id === null) && <section className="asset-page-group">
                    <header><div><b>Unassigned legacy assets</b><small>These assets are not available to campaign generation until assigned.</small></div></header>
                    <div className="asset-grid">{assets.filter((item) => item.account_id === null).map(renderAssetCard)}</div>
                  </section>}
                </> : <EmptyState icon={<FileImage size={21} />} title="Your library starts with campaign media" text="Upload images, videos, or audio to organize assets by page and use them in your campaign media studio." action="Choose a file" onAction={() => document.getElementById("asset-file-input")?.click()} />}
              </div>
            ) : (
              <div className="overview-grid">
                <div className="overview-primary">
                  {accounts.length === 0 && <SetupStep number="01" title="Connect a channel" text="Bring your Facebook, Instagram, X, or TikTok account into your workspace." action="Connect channel" onAction={() => setShowAccountForm(true)} icon={<Send size={16} />} />}
                  {campaigns.length === 0 && <SetupStep number={accounts.length ? "01" : "02"} title="Shape your first campaign" text="Choose a marketing goal, audience, and voice that fits your page." action="Create campaign" onAction={() => setShowCampaignForm(true)} icon={<Target size={16} />} />}
                  <div className="insight-card"><div className="insight-mark"><Sparkles size={17} /></div><div><b>Thoughtful beats noisy.</b><p>Start with one clear audience and one useful message. We'll help you build from there.</p></div><ArrowRight size={16} /></div>
                </div>
                <div className="side-summary"><div className="summary-head"><b>Saved channels</b><button onClick={() => setView("channels")}>View all <ArrowRight size={13} /></button></div>{accounts.length ? accounts.slice(0, 4).map((item) => <ChannelMini key={item.id} account={item} />) : <div className="summary-empty"><FileImage size={20} /><span>No channels saved</span><small>Your saved pages will show here.</small></div>}<div className="summary-divider" /><div className="summary-foot"><span><MessageCircle size={14} /> Planning with purpose</span><span><Settings2 size={14} /> Workspace settings</span></div></div>
              </div>
            )}
          </section>
          <footer className="footer-line">
            <span>GPD MARKETING STUDIO</span>
            <span>Make it useful. Make it human.</span>
            <LegalLinks onNavigate={openLegalPage} />
          </footer>
        </div>
      </main>

      {showAccountForm && <Modal title="Connect a channel" description="Connect a page or profile you have permission to manage." onClose={() => setShowAccountForm(false)}>
        <form className="modal-form" onSubmit={saveAccount}>
          <label>Platform<select required value={account.platform} onChange={(event) => setAccount({ ...account, platform: event.target.value as Platform })}>{platforms.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          <div className="form-pair"><label>Page or profile name<input required maxLength={160} value={account.display_name} onChange={(event) => setAccount({ ...account, display_name: event.target.value })} placeholder="e.g. GPD Blog" /></label><label>Platform page / profile ID<input required maxLength={255} value={account.external_id} onChange={(event) => setAccount({ ...account, external_id: event.target.value })} placeholder="ID from your platform" /></label></div>
          {account.platform === "tiktok" ? (
            <div className="tiktok-hint">After connecting this profile, open Channels → TikTok login to launch the owner-assisted browser sign-in. The account owner completes login and any CAPTCHA locally; the authenticated browser state is then encrypted by the backend.</div>
          ) : (
            <>
              <label>Page / developer credentials JSON<textarea required rows={4} value={account.credentials} onChange={(event) => setAccount({ ...account, credentials: event.target.value })} placeholder={account.platform === "facebook" ? '{"page_access_token":"long-lived page token"}' : account.platform === "instagram" ? '{"access_token":"long-lived Instagram token"}' : '{"access_token":"user access token"}'} /></label>
              <label>Credential expiry <small>Optional; add it when the platform provides a known expiry.</small><input type="datetime-local" value={account.expires_at} onChange={(event) => setAccount({ ...account, expires_at: event.target.value })} /></label>
              <p className="form-hint"><LockKeyhole size={13} /> Encrypted in PostgreSQL and not sent to Hugging Face. Verify access after connecting; only supported official platform publishing endpoints can be scheduled.</p>
            </>
          )}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowAccountForm(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Connect channel</button></div>
        </form>
      </Modal>}

      {aiAccountId && <Modal title="Page AI providers" description="Add one or more provider keys for this page. Each key is verified before encrypted storage." onClose={() => setAiAccountId(null)}>
        <form className="modal-form" onSubmit={saveAISettings}>
          <div className="provider-list">
            {aiProviderRows.map((row, index) => {
              const isSaved = savedAIProviders.some((item) => item.provider === row.provider);
              return <fieldset className="provider-row" key={`${row.provider}-${index}`}>
                <legend>{providerOptions.find((option) => option.id === row.provider)?.label}</legend>
                <div className="form-pair">
                  <label>Provider<select value={row.provider} onChange={(event) => {
                    const provider = event.target.value as LLMProvider;
                    const defaultModel = providerOptions.find((option) => option.id === provider)?.model ?? "";
                    setAIProviderRows((rows) => rows.map((item, rowIndex) => rowIndex === index
                      ? { ...item, provider, model: defaultModel, api_key: "" }
                      : item));
                  }}>{providerOptions.filter((option) => option.id === row.provider || !aiProviderRows.some((item) => item.provider === option.id)).map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
                  <label>Model ID<input required maxLength={160} value={row.model} onChange={(event) => setAIProviderRows((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, model: event.target.value } : item))} placeholder="Provider model identifier" /></label>
                </div>
                <div className="form-pair">
                  <label>API key<input type="password" autoComplete="new-password" minLength={16} maxLength={4096} value={row.api_key} onChange={(event) => setAIProviderRows((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, api_key: event.target.value } : item))} placeholder={isSaved ? "Saved securely — leave blank to keep" : "Paste provider API key"} required={!isSaved} /></label>
                  <label>Priority <small>Lower number is tried first.</small><input type="number" min={1} max={999} required value={row.priority} onChange={(event) => setAIProviderRows((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, priority: Number(event.target.value) } : item))} /></label>
                </div>
                <button type="button" className="text-button provider-remove" onClick={() => setAIProviderRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove provider</button>
              </fieldset>;
            })}
          </div>
          <button type="button" className="button secondary provider-add" onClick={addAIProvider}><Plus size={14} /> Add another provider</button>
          <p className="form-hint"><LockKeyhole size={13} /> Keys are encrypted in your database, never returned by the API, and never sent to Hugging Face.</p>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setAiAccountId(null)}>Cancel</button><button className="button primary" disabled={busy || !aiProviderRows.length}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Verify &amp; save</button></div>
        </form>
      </Modal>}

      {profileAccount && profileDraft && <Modal title={`${profileAccount.display_name} page profile`} description="Set the languages, visual identity, and faith presentation the AI should respect for this page." onClose={() => { setProfileAccount(null); setProfileDraft(null); }}>
        <form className="modal-form" onSubmit={saveProfileSettings}>
          <label>Preferred languages <small>Posts use one language each. The planner can create separate variants when it judges them useful.</small><select multiple size={5} required value={profileDraft.languages} onChange={(event) => setProfileDraft({ ...profileDraft, languages: Array.from(event.target.selectedOptions, (option) => option.value) })}><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="pt">Portuguese</option><option value="sw">Swahili</option><option value="ar">Arabic</option><option value="zh">Chinese</option><option value="de">German</option><option value="hi">Hindi</option></select></label>
          <div className="form-pair"><label>Primary color<input type="color" value={profileDraft.primary_color} onChange={(event) => setProfileDraft({ ...profileDraft, primary_color: event.target.value })} /></label><label>Accent color<input type="color" value={profileDraft.accent_color} onChange={(event) => setProfileDraft({ ...profileDraft, accent_color: event.target.value })} /></label></div>
          <div className="form-pair"><label>Image font<select value={profileDraft.font_family} onChange={(event) => setProfileDraft({ ...profileDraft, font_family: event.target.value as PageProfile["font_family"] })}><option value="sans">Sans-serif</option><option value="serif">Serif</option><option value="display">Display</option></select></label><label>Brand logo<select value={profileDraft.logo_asset_id ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, logo_asset_id: event.target.value || null })}><option value="">No logo</option>{assets.filter((asset) => asset.account_id === profileAccount.id && asset.media_type.startsWith("image/")).map((asset) => <option value={asset.id} key={asset.id}>{asset.original_name}</option>)}</select></label></div>
          <label>Faith presentation<select value={profileDraft.faith_presentation} onChange={(event) => setProfileDraft({ ...profileDraft, faith_presentation: event.target.value as PageProfile["faith_presentation"] })}><option value="subtle">Subtle: principles reflected, no explicit religious terms</option><option value="explicit">Explicit: page may mention faith and Scripture references</option><option value="off">Off: no faith editorial guidance</option></select></label>
          <p className="form-hint"><LockKeyhole size={13} /> The default is subtle, with no verse quotations. Bible references are restricted to reviewed references and included as internal review metadata.</p>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => { setProfileAccount(null); setProfileDraft(null); }}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save page profile</button></div>
        </form>
      </Modal>}

      {tiktokSetupAccount && <Modal title={`${tiktokSetupAccount.display_name} TikTok login`} description="The owner signs in in a local visible browser; GPD never receives the TikTok password." onClose={() => { setTikTokSetupAccount(null); setTikTokSession(null); }}>
        <div className="modal-form">
          <div className="tiktok-session-status"><b>{tiktokSession?.connected ? "Browser session saved" : tiktokSession ? "Sign-in required" : "Checking session…"}</b>{tiktokSession?.expires_at && <small>Recorded expiry: {new Date(tiktokSession.expires_at).toLocaleString()}</small>}</div>
          <p>Run this from the backend folder on a computer where you can complete TikTok sign-in. It prompts for your GPD login, opens TikTok visibly, and waits while you sign in yourself. CAPTCHA is not automated. The resulting browser state is sent over HTTPS and encrypted in the database.</p>
          <code className="setup-command">py -m app.tiktok_auth --api-url "{API_URL || "http://127.0.0.1:8000"}" --account-id {tiktokSetupAccount.id}</code>
          <button type="button" className="button secondary" onClick={() => {
            void navigator.clipboard.writeText(`py -m app.tiktok_auth --api-url "${API_URL || "http://127.0.0.1:8000"}" --account-id ${tiktokSetupAccount.id}`)
              .then(() => setMessage("TikTok setup command copied."))
              .catch(() => setError("Could not access the clipboard; copy the command above."));
          }}>Copy setup command</button>
          <p className="form-hint"><LockKeyhole size={13} /> The publishing worker uses the saved browser session and official TikTok website UI—not a posting API. Expired sessions are paused for owner re-authentication; no CAPTCHA or anti-bot controls are bypassed.</p>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => { setTikTokSetupAccount(null); setTikTokSession(null); }}>Close</button></div>
        </div>
      </Modal>}

      {showCampaignForm && <Modal title="Create a campaign" description="Set the objective, voice, dates, and channels before scheduling posts." onClose={() => setShowCampaignForm(false)}>
        <form className="modal-form" onSubmit={saveCampaign}>
          <label>Campaign name<input required maxLength={180} value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} placeholder="A name your team will recognize" /></label>
          <label>What are you marketing?<textarea required minLength={10} maxLength={5000} rows={3} value={campaign.objective} onChange={(event) => setCampaign({ ...campaign, objective: event.target.value })} placeholder="Describe the product, service, offer, or community goal." /></label>
          <fieldset><legend>Choose marketing strategies</legend><div className="strategy-grid">{strategyOptions.map(([id, label]) => <label className="check-option" key={id}><input type="checkbox" checked={campaign.strategies.includes(id)} onChange={(event) => setCampaign({ ...campaign, strategies: event.target.checked ? [...campaign.strategies, id] : campaign.strategies.filter((item) => item !== id) })} /><span><Check size={12} /></span>{label}</label>)}</div></fieldset>
          <label>Voice / post style<input required maxLength={80} value={campaign.tone} onChange={(event) => setCampaign({ ...campaign, tone: event.target.value })} placeholder="Warm, witty, educational…" /></label>
          <GeographyPicker
            value={campaign.geography}
            onChange={(geography) => setCampaign({ ...campaign, geography })}
          />
          <div className="form-pair"><label>Start date &amp; time<input type="datetime-local" required value={campaign.starts_at} onChange={(event) => setCampaign({ ...campaign, starts_at: event.target.value })} /></label><label>End date &amp; time<input type="datetime-local" required value={campaign.ends_at} onChange={(event) => setCampaign({ ...campaign, ends_at: event.target.value })} /></label></div>
          <label>Timezone<input required value={campaign.timezone} onChange={(event) => setCampaign({ ...campaign, timezone: event.target.value })} /></label>
          <fieldset><legend>AI scheduling</legend>
            <label>Timing mode<select value={campaign.schedule_mode} onChange={(event) => setCampaign({ ...campaign, schedule_mode: event.target.value as "auto" | "specific_times" })}><option value="auto">AI selects real planetary-hour windows</option><option value="specific_times">Use my selected local times</option></select></label>
            {campaign.schedule_mode === "specific_times" && <label>Preferred local times <small>Comma-separated, 24-hour time; AI chooses how many to use each day.</small><input required value={campaign.specific_times} onChange={(event) => setCampaign({ ...campaign, specific_times: event.target.value })} placeholder="09:00, 13:30, 18:00" /></label>}
            <div className="form-pair"><label>Location latitude<input type="number" step="any" min="-90" max="90" required={campaign.schedule_mode === "auto"} value={campaign.latitude} onChange={(event) => setCampaign({ ...campaign, latitude: event.target.value })} placeholder="e.g. 0.3476" /></label><label>Location longitude<input type="number" step="any" min="-180" max="180" required={campaign.schedule_mode === "auto"} value={campaign.longitude} onChange={(event) => setCampaign({ ...campaign, longitude: event.target.value })} placeholder="e.g. 32.5825" /></label></div>
            <label className="check-option"><input type="checkbox" checked={campaign.faith_guidance} onChange={(event) => setCampaign({ ...campaign, faith_guidance: event.target.checked })} /><span><Check size={12} /></span>Include subtle Christian editorial guidance</label>
            <p className="form-hint"><CircleHelp size={13} /> Auto mode calculates sunrise and sunset for your coordinates. Planetary-hour associations are symbolic timing guidance, not Biblical doctrine or a promise of results. Scripture references are validated and kept out of copy unless the page is set to explicit faith presentation.</p>
          </fieldset>
          <fieldset><legend>Publish to</legend><div className="strategy-grid">{accounts.map((item) => <label className="check-option" key={item.id}><input type="checkbox" checked={campaign.account_ids.includes(item.id)} onChange={(event) => setCampaign({ ...campaign, account_ids: event.target.checked ? [...campaign.account_ids, item.id] : campaign.account_ids.filter((id) => id !== item.id) })} /><span><Check size={12} /></span>{item.display_name} <small>({item.platform})</small></label>)}</div>{!accounts.length && <p className="form-hint">Connect at least one social channel first.</p>}</fieldset>
          <div className="form-hint"><Sparkles size={13} /> AI chooses a conservative daily cadence based on campaign objectives, channel, and audience; it avoids exceeding three posts per channel per day.</div>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowCampaignForm(false)}>Cancel</button><button className="button primary" disabled={busy || !accounts.length}>{busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Save campaign</button></div>
        </form>
      </Modal>}

      {mediaCampaign && <CampaignMediaStudio
        campaign={mediaCampaign}
        accounts={accounts}
        assets={assets}
        token={token}
        onClose={() => setMediaCampaign(null)}
        onAssetsUpdated={() => refreshData(token)}
      />}

      {scheduleCampaign && <Modal title="Schedule a post" description="Generate copy with this page's AI provider, review it, then choose a publication time." onClose={() => setScheduleCampaign(null)}>
        <form className="modal-form" onSubmit={saveScheduledPost}>
          <label>Channel<select required value={scheduleForm.account_id} onChange={(event) => setScheduleForm({ ...scheduleForm, account_id: event.target.value, asset_id: "" })}>{accounts.filter((item) => scheduleCampaign.account_ids.includes(item.id)).map((item) => <option value={item.id} key={item.id}>{item.display_name} · {item.platform}</option>)}</select></label>
          <label>Media asset<select value={scheduleForm.asset_id} onChange={(event) => setScheduleForm({ ...scheduleForm, asset_id: event.target.value })}><option value="">Text only</option>{assets.filter((item) => item.account_id === scheduleForm.account_id && (item.media_type.startsWith("image/") || item.media_type.startsWith("video/"))).map((item) => <option value={item.id} key={item.id}>{item.original_name} · {item.media_type}</option>)}</select></label>
          <label>Post copy<textarea required minLength={1} maxLength={5000} rows={5} value={scheduleForm.text} onChange={(event) => setScheduleForm({ ...scheduleForm, text: event.target.value })} placeholder="Write or generate copy, then review it before scheduling." /></label>
          <div className="form-pair"><button type="button" className="button secondary" onClick={generateScheduledCopy} disabled={busy || !scheduleForm.account_id}>{busy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} Generate copy</button><label>Publish time<input type="datetime-local" required value={scheduleForm.scheduled_at} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduled_at: event.target.value })} /></label></div>
          <p className="form-hint"><Check size={13} /> Scheduled posts publish automatically after channel validation. You can cancel them while still queued.</p>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setScheduleCampaign(null)}>Cancel</button><button className="button primary" disabled={busy || !scheduleForm.account_id || !scheduleForm.text.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <CalendarDays size={15} />} Schedule post</button></div>
        </form>
      </Modal>}

      {postsCampaign && <Modal title={`${postsCampaign.name} posts`} description="Review generated content and its page-specific media. Auto-approved posts can publish through the configured worker." onClose={() => setPostsCampaign(null)}>
        <div className="scheduled-post-list">
          {campaignPosts.length ? campaignPosts.map((post) => {
            const channel = accounts.find((item) => item.id === post.account_id);
            const postAsset = assets.find((item) => item.id === post.asset_id);
            const metadata = post.planning_metadata ?? {};
            const internalNote = [
              typeof metadata.language === "string" ? `Language: ${metadata.language}` : "",
              typeof metadata.translation_group === "string" ? `Language set: ${metadata.translation_group}` : "",
              typeof metadata.planet === "string" ? `${metadata.planet} hour ${metadata.planetary_hour ?? ""}` : "",
              typeof metadata.angel === "string" && metadata.angel ? `Angel guide: ${metadata.angel}` : "",
              typeof metadata.scripture_reference === "string" && metadata.scripture_reference ? `KJV reference: ${metadata.scripture_reference}` : "",
            ].filter(Boolean).join(" · ");
            return <article className="scheduled-post-card" key={post.id}>
              <div className="scheduled-post-head"><b>{channel?.display_name ?? "Channel"}</b><span className={`state-pill ${post.approved ? "approved" : "review"}`}>{post.status === "published" ? "Published" : post.approved ? "Queued" : "Review needed"}</span></div>
              <small>{new Date(post.scheduled_at).toLocaleString()}</small>
              {internalNote && <small className="planning-note">{internalNote}</small>}
              {postAsset?.media_type.startsWith("video/") ? <video className="post-media-preview" controls playsInline preload="metadata"><source src={postAsset.download_url} type={postAsset.media_type} /></video> : postAsset && <img className="post-media-preview" src={postAsset.download_url} alt={postAsset.description || postAsset.original_name} />}
              <p>{post.text}</p>
              {post.last_error && <small className="error-text">{post.last_error}</small>}
              <div className="scheduled-post-actions">
                {!post.approved && post.status === "scheduled" && <button className="button primary" disabled={busy} onClick={() => approvePost(post)}><Check size={13} /> Approve</button>}
                {post.status === "scheduled" && <button className="button secondary" disabled={busy} onClick={() => removePost(post)}>Cancel</button>}
              </div>
            </article>;
          }) : <div className="empty-state compact"><b>No posts planned yet</b><p>Generate a plan or create an individual scheduled post.</p></div>}
        </div>
      </Modal>}
      <CookieNotice onOpenPolicy={() => openLegalPage("cookies")} />
    </div>
  );
}

function CampaignMediaStudio({
  campaign,
  accounts,
  assets,
  token,
  onClose,
  onAssetsUpdated,
}: {
  campaign: Campaign;
  accounts: SocialAccount[];
  assets: MarketingAsset[];
  token: string;
  onClose: () => void;
  onAssetsUpdated: () => Promise<void>;
}) {
  const [accountId, setAccountId] = useState(campaign.account_ids[0] ?? "");
  const [prompt, setPrompt] = useState(
    `${campaign.objective}\nCampaign: ${campaign.name}\nAudience/location: ${[...campaign.geography.cities, ...campaign.geography.regions, ...campaign.geography.countries].join(", ") || "Use an inclusive, locally relevant setting."}`.slice(0, 2390),
  );
  const [motionSeconds, setMotionSeconds] = useState(2);
  const [finalSeconds, setFinalSeconds] = useState(10);
  const [narrationText, setNarrationText] = useState("");
  const [voiceReferenceText, setVoiceReferenceText] = useState("");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("Warm and reassuring");
  const [voiceReferenceAssetId, setVoiceReferenceAssetId] = useState("");
  const [soundtrackAssetId, setSoundtrackAssetId] = useState("");
  const [sourceImageAssetId, setSourceImageAssetId] = useState("");
  const [posterAssetId, setPosterAssetId] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [jobs, setJobs] = useState<MediaGenerationJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const refreshedJobs = useRef(new Set<string>());
  const onAssetsUpdatedRef = useRef(onAssetsUpdated);
  onAssetsUpdatedRef.current = onAssetsUpdated;

  const accountAssets = assets.filter((asset) => asset.account_id === accountId);
  const imageAssets = accountAssets.filter((asset) => asset.media_type.startsWith("image/"));
  const audioAssets = accountAssets.filter((asset) => asset.media_type.startsWith("audio/"));
  const accountLanguages = accounts.find((item) => item.id === accountId)?.profile.languages ?? [];
  const supportedLanguageCodes = new Set([
    "de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh",
  ]);
  const voiceLanguages = accountLanguages.some((code) => supportedLanguageCodes.has(code))
    ? accountLanguages.filter((code) => supportedLanguageCodes.has(code))
    : ["en"];

  useEffect(() => {
    let active = true;
    async function refreshJobs() {
      try {
        const response = await api<{ jobs: MediaGenerationJob[] }>(
          `/api/campaigns/${campaign.id}/media-jobs`,
          token,
        );
        if (!active) return;
        setJobs(response.jobs);
        const completed = response.jobs.filter((job) => job.status === "completed" && !refreshedJobs.current.has(job.id));
        if (completed.length) {
          completed.forEach((job) => refreshedJobs.current.add(job.id));
          await onAssetsUpdatedRef.current();
        }
      } catch (cause) {
        if (active) setError((cause as Error).message || "Media job status could not be loaded.");
      }
    }
    void refreshJobs();
    const timer = window.setInterval(() => void refreshJobs(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [campaign.id, token]);

  async function suggestNarration() {
    const channel = accounts.find((item) => item.id === accountId);
    if (!channel) return;
    setSuggesting(true);
    setError("");
    try {
      const result = await api<{ text: string }>(`/api/accounts/${channel.id}/ai/generate`, token, {
        method: "POST",
        body: JSON.stringify({
          max_tokens: 300,
          prompt: [
            "Write a natural, concise spoken narration for a social-media campaign video.",
            `Campaign: ${campaign.name}.`,
            `Objective: ${campaign.objective}.`,
            `Campaign voice: ${campaign.tone}.`,
            `Language: ${language}.`,
            "Use 1-3 short sentences, avoid unsupported claims and stage directions, and return only narration text.",
          ].join("\n"),
        }),
      });
      setNarrationText(result.text.trim());
    } catch (cause) {
      setError((cause as Error).message || "Narration could not be suggested.");
    } finally {
      setSuggesting(false);
    }
  }

  async function createJob(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const job = await api<MediaGenerationJob>(`/api/campaigns/${campaign.id}/media-jobs`, token, {
        method: "POST",
        body: JSON.stringify({
          account_id: accountId,
          prompt,
          motion_seconds: motionSeconds,
          final_seconds: finalSeconds,
          narration_text: narrationText,
          voice_reference_text: voiceReferenceText,
          language,
          tone,
          voice_reference_asset_id: voiceReferenceAssetId || null,
          soundtrack_asset_id: soundtrackAssetId || null,
          source_image_asset_id: sourceImageAssetId || null,
          poster_asset_id: posterAssetId || null,
          consent_confirmed: consentConfirmed,
        }),
      });
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setMessageForJob(job);
    } catch (cause) {
      setError((cause as Error).message || "Campaign video could not be queued.");
    } finally {
      setBusy(false);
    }
  }

  function setMessageForJob(job: MediaGenerationJob) {
    setError("");
    setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
  }

  return (
    <Modal title="Campaign media studio" description={`Create voice-led, mixed-media video for ${campaign.name}.`} onClose={onClose}>
      <form className="modal-form media-studio-form" onSubmit={createJob}>
        <div className="media-studio-intro">
          <span className="media-studio-icon"><Video size={20} /></span>
          <div><b>Shape the story, then queue the render</b><p>AI motion runs for 2, 4, or 10 seconds. Extend the finished edit to 30 seconds with a gently animated photo scene and optional end card.</p></div>
        </div>
        <label>Campaign channel<select required value={accountId} onChange={(event) => {
          const nextAccount = accounts.find((item) => item.id === event.target.value);
          const nextLanguage = nextAccount?.profile.languages.find((code) => supportedLanguageCodes.has(code));
          setAccountId(event.target.value);
          setLanguage(languageName(nextLanguage ?? "en"));
          setVoiceReferenceAssetId("");
          setSoundtrackAssetId("");
          setSourceImageAssetId("");
          setPosterAssetId("");
          setVoiceReferenceText("");
        }}>{accounts.filter((item) => campaign.account_ids.includes(item.id)).map((item) => <option value={item.id} key={item.id}>{item.display_name} · {item.platform}</option>)}</select></label>
        <label>Visual direction<textarea required minLength={10} maxLength={2400} rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
        <div className="form-pair">
          <label>AI motion<select value={motionSeconds} onChange={(event) => setMotionSeconds(Number(event.target.value))}><option value={2}>2 seconds</option><option value={4}>4 seconds</option><option value={10}>10 seconds</option></select></label>
          <label>Final edit<select value={finalSeconds} onChange={(event) => setFinalSeconds(Number(event.target.value))}>{[2, 4, 10, 15, 20, 30].map((seconds) => <option value={seconds} key={seconds}>{seconds} seconds</option>)}</select></label>
        </div>
        <fieldset>
          <legend>Narration and sound</legend>
          <div className="media-studio-inline"><label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}>{voiceLanguages.map((code) => <option value={languageName(code)} key={code}>{languageName(code)}</option>)}</select></label><label>Delivery<select value={tone} onChange={(event) => setTone(event.target.value)}>{["Warm and reassuring", "Bright and energetic", "Calm and reflective", "Confident and persuasive", "Clear and educational"].map((item) => <option value={item} key={item}>{item}</option>)}</select></label></div>
          {!accountLanguages.some((code) => supportedLanguageCodes.has(code)) && <p className="form-hint"><CircleHelp size={13} /> The voice model does not support this page's configured language. Narration defaults to English; edit or translate the script before generating it.</p>}
          <label>Narration script<textarea maxLength={2400} rows={3} value={narrationText} onChange={(event) => setNarrationText(event.target.value)} placeholder="Write the voice-over, or ask AI to suggest an editable draft." /></label>
          <button type="button" className="button secondary media-studio-suggest" disabled={suggesting || !accountId} onClick={() => void suggestNarration()}>{suggesting ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} Suggest narration</button>
          <div className="form-pair">
            <label>Voice sample<select value={voiceReferenceAssetId} onChange={(event) => {
              setVoiceReferenceAssetId(event.target.value);
              setVoiceReferenceText("");
            }}><option value="">Use the default voice</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label>
            <label>Background audio<select value={soundtrackAssetId} onChange={(event) => setSoundtrackAssetId(event.target.value)}><option value="">No extra soundtrack</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label>
          </div>
          {voiceReferenceAssetId && <label>Voice sample transcript<textarea required maxLength={2400} rows={2} value={voiceReferenceText} onChange={(event) => setVoiceReferenceText(event.target.value)} placeholder="Write the words spoken in the voice sample; this helps the model clone the voice accurately." /></label>}
          <p className="form-hint"><CircleHelp size={13} /> Narration language support: English, Spanish, Chinese, Japanese, Korean, German, French, Russian, Portuguese, and Italian.</p>
        </fieldset>
        <fieldset>
          <legend>Campaign visuals</legend>
          <div className="form-pair">
            <label>Photo scene<select value={sourceImageAssetId} onChange={(event) => setSourceImageAssetId(event.target.value)}><option value="">Use a frame from generated motion</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label>
            <label>Promotional end card<select value={posterAssetId} onChange={(event) => setPosterAssetId(event.target.value)}><option value="">No end card</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label>
          </div>
          <p className="form-hint"><CircleHelp size={13} /> Free-tier source photos receive a gentle pan/zoom treatment; person extraction and lip-sync are not included in this version. A two-second end card is included within the selected final duration.</p>
        </fieldset>
        <label className="check-option media-consent"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /><span><Check size={12} /></span>I have permission to use every submitted voice recording and person shown in the selected photos.</label>
        <div className="media-studio-submit"><button className="button primary" disabled={busy || !accountId || !consentConfirmed || (voiceReferenceAssetId && !voiceReferenceText.trim()) || motionSeconds > finalSeconds - (posterAssetId ? 2 : 0)}>{busy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} Queue video generation</button><small>Processing runs through the server worker and persists in your campaign.</small></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <section className="media-job-list" aria-live="polite">
          <h3>Recent campaign renders</h3>
          {jobs.length ? jobs.map((job) => <article className="media-job-card" key={job.id}>
            <div className="media-job-heading"><b>{job.final_seconds}s campaign edit</b><span className={`media-job-state ${job.status}`}>{job.status === "completed" ? "Ready" : job.status === "failed" ? "Failed" : job.status === "processing" ? "Processing" : "Queued"}</span></div>
            {job.status === "processing" && <div className="media-progress"><span /></div>}
            <p>{job.status === "queued"
              ? `Waiting for shared ZeroGPU capacity. ${job.last_error ? `${job.last_error} ` : ""}Next attempt: ${new Date(job.next_run_at).toLocaleString()}.`
              : job.status === "processing"
                ? `Generating scenes and composing audio · ${job.stage.replaceAll("_", " ")}.`
                : job.status === "failed"
                  ? job.last_error
                  : `${job.motion_seconds}s of generated motion · ${job.language} narration`}</p>
            {job.output_url && <video className="media-job-preview" controls playsInline preload="metadata"><source src={job.output_url} type="video/mp4" /></video>}
          </article>) : <p className="media-job-empty">Your campaign video renders and their progress will appear here.</p>}
        </section>
      </form>
    </Modal>
  );
}

function languageName(code: string): string {
  const names: Record<string, string> = {
    de: "German", en: "English", es: "Spanish", fr: "French", it: "Italian",
    ja: "Japanese", ko: "Korean", pt: "Portuguese", ru: "Russian", zh: "Chinese",
  };
  return names[code] ?? "English";
}

function ChannelCard({ account, onRemove, onAIConfigure, onValidate, onProfile, onTikTokSetup }: { account: SocialAccount; onRemove: (id: string) => void; onAIConfigure: (id: string) => void; onValidate: (id: string) => void; onProfile: (account: SocialAccount) => void; onTikTokSetup: (account: SocialAccount) => void }) {
  const channel = platforms.find((item) => item.id === account.platform) ?? platforms[0];
  const Icon = channel.icon;
  return <article className="channel-card"><div className={`platform-icon ${account.platform}`}><Icon size={18} /></div><div className="channel-card-title"><b>{account.display_name}</b><small>{channel.label} · ID {account.external_id}</small></div><span className="connected"><i /> {account.platform === "tiktok" ? "Browser login" : account.credentials_verified_at ? "Verified" : "Unverified"}</span><div className="channel-actions"><button className="text-button" onClick={() => onProfile(account)}>Page profile</button>{account.platform === "tiktok" ? <button className="text-button" onClick={() => onTikTokSetup(account)}>TikTok login</button> : <button className="text-button" onClick={() => onValidate(account.id)}>Verify platform</button>}<button className="text-button" onClick={() => onAIConfigure(account.id)}>AI provider keys</button><button className="text-button" onClick={() => onRemove(account.id)}>Disconnect</button></div></article>;
}

function ChannelMini({ account }: { account: SocialAccount }) {
  const channel = platforms.find((item) => item.id === account.platform) ?? platforms[0];
  const Icon = channel.icon;
  return <div className="channel-mini"><span className={`platform-icon small ${account.platform}`}><Icon size={14} /></span><span><b>{account.display_name}</b><small>{channel.label}</small></span><i /></div>;
}

function EmptyState({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><b>{title}</b><p>{text}</p><button className="button primary" onClick={onAction}><Plus size={15} /> {action}</button></div>;
}

function SetupStep({ number, title, text, action, onAction, icon }: { number: string; title: string; text: string; action: string; onAction: () => void; icon: React.ReactNode }) {
  return <article className="setup-step"><span className="step-num">{number}</span><span className="step-icon">{icon}</span><div className="step-copy"><b>{title}</b><p>{text}</p></div><button className="button secondary" onClick={onAction}>{action}<ArrowRight size={14} /></button></article>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header>
          <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
          <button ref={closeButtonRef} type="button" className="icon-button" onClick={() => onCloseRef.current()} aria-label="Close dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

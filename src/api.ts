export type Platform = "facebook" | "instagram" | "x" | "tiktok";
export type LLMProvider = "gemini" | "openai" | "anthropic" | "openrouter" | "groq";
export type PageProfile = {
  languages: string[];
  primary_color: string;
  accent_color: string;
  font_family: "sans" | "serif" | "display";
  logo_asset_id: string | null;
  faith_presentation: "subtle" | "explicit" | "off";
};

export interface SocialAccount {
  id: string;
  platform: Platform;
  display_name: string;
  external_id: string;
  expires_at: string | null;
  credentials_verified_at: string | null;
  profile: PageProfile;
  created_at: string;
}

export interface AIProviderConfig {
  id: string;
  provider: LLMProvider;
  model: string;
  priority: number;
  enabled: boolean;
  last_verified_at: string;
  last_used_at: string | null;
  configured: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  strategies: string[];
  tone: string;
  geography: CampaignGeography;
  planning_preferences: {
    schedule_mode: "auto" | "specific_times";
    specific_times: string[];
    latitude: number | null;
    longitude: number | null;
    faith_guidance: boolean;
  };
  starts_at: string;
  ends_at: string;
  timezone: string;
  account_ids: string[];
  created_at: string;
}

export interface CampaignGeography {
  countries: string[];
  regions: string[];
  cities: string[];
  districts: string[];
}

export interface ScheduledPost {
  id: string;
  campaign_id: string;
  account_id: string;
  asset_id: string | null;
  text: string;
  scheduled_at: string;
  status: "scheduled" | "processing" | "published" | "failed" | "needs_attention";
  approved: boolean;
  attempts: number;
  last_error: string | null;
  published_at: string | null;
  result_reference: string | null;
  planning_metadata: Record<string, unknown>;
  created_at: string;
}

export interface MarketingAsset {
  id: string;
  account_id: string | null;
  original_name: string;
  media_type: string;
  description: string;
  labels: string[];
  metadata: Record<string, string | number>;
  analysis_status: string;
  download_url: string;
  created_at: string;
}

export interface CampaignGenerationJob {
  campaign_id: string;
  status: string;
  posts_per_day: number;
  auto_approve: boolean;
  generated_batches: number;
  next_run_at: string;
  last_error: string | null;
}

export interface PublishingSummary {
  scheduled: number;
  processing: number;
  published: number;
  failed: number;
  needs_attention: number;
}

export interface CloudinaryUploadIntent {
  api_key: string;
  allowed_formats: string;
  cloud_name: string;
  public_id: string;
  resource_type: "image" | "video" | "auto";
  timestamp: number;
  type: "authenticated";
  overwrite: "false";
  signature: string;
}

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  signature: string;
  resource_type: "image" | "video";
}

export const API_URL = import.meta.env.VITE_API_URL ?? "";
const API_REQUEST_BASE = import.meta.env.DEV ? API_URL : "";

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_REQUEST_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail = payload && typeof payload.detail === "string" ? payload.detail : `Request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload as T;
}

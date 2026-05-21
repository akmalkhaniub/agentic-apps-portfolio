variable "project_id" {
  description = "The GCP Project ID"
  type        = string
  default     = "agentic-portfolio-496720"
}

variable "region" {
  description = "The GCP Region"
  type        = string
  default     = "us-central1"
}

variable "anthropic_api_key" {
  description = "The Anthropic API Key"
  type        = string
  sensitive   = true
}

variable "google_generative_ai_api_key" {
  description = "The Google Generative AI API Key"
  type        = string
  sensitive   = true
}

variable "gcp_access_token" {
  description = "GCP Access Token"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "The OpenAI API Key"
  type        = string
  sensitive   = true
  default     = ""
}

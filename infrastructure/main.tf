terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project      = var.project_id
  region       = var.region
  access_token = var.gcp_access_token
}

# ------------------------------------------------------------------------------
# Secrets
# ------------------------------------------------------------------------------

# Anthropic API Key
resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "anthropic-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "anthropic_api_key_version" {
  secret      = google_secret_manager_secret.anthropic_api_key.id
  secret_data = var.anthropic_api_key
}

# Google Generative AI API Key
resource "google_secret_manager_secret" "google_generative_ai_key" {
  secret_id = "google-generative-ai-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "google_generative_ai_key_version" {
  secret      = google_secret_manager_secret.google_generative_ai_key.id
  secret_data = var.google_generative_ai_api_key
}

data "google_project" "project" {}

resource "google_project_iam_member" "secret_accessor" {
  project = data.google_project.project.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# ------------------------------------------------------------------------------
# Cloud Run Services
# ------------------------------------------------------------------------------

# 1. Agentic Customer Support
resource "google_cloud_run_v2_service" "customer_support" {
  name     = "agentic-customer-support"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/agentic-customer-support:latest"
      
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_GENERATIVE_AI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_generative_ai_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_customer_support" {
  location = google_cloud_run_v2_service.customer_support.location
  project  = google_cloud_run_v2_service.customer_support.project
  service  = google_cloud_run_v2_service.customer_support.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 2. Model Router Sentinel
resource "google_cloud_run_v2_service" "model_router" {
  name     = "model-router-sentinel"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/model-router-sentinel:latest"
      
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_model_router" {
  location = google_cloud_run_v2_service.model_router.location
  project  = google_cloud_run_v2_service.model_router.project
  service  = google_cloud_run_v2_service.model_router.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 3. Multimodal QA Agent
resource "google_cloud_run_v2_service" "multimodal_qa" {
  name     = "multimodal-qa-agent"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/multimodal-qa-agent:latest"
      
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_multimodal_qa" {
  location = google_cloud_run_v2_service.multimodal_qa.location
  project  = google_cloud_run_v2_service.multimodal_qa.project
  service  = google_cloud_run_v2_service.multimodal_qa.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 4. Real Estate Coordinator
resource "google_cloud_run_v2_service" "real_estate" {
  name     = "real-estate-coordinator"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/real-estate-coordinator:latest"
      
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_real_estate" {
  location = google_cloud_run_v2_service.real_estate.location
  project  = google_cloud_run_v2_service.real_estate.project
  service  = google_cloud_run_v2_service.real_estate.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# OpenAI API Key Secret
resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "openai-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "openai_api_key_version" {
  secret      = google_secret_manager_secret.openai_api_key.id
  secret_data = var.openai_api_key
}

# 5. Procurement Intelligence Agent
resource "google_cloud_run_v2_service" "procurement_agent" {
  name     = "procurement-intelligence-agent"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/procurement-intelligence-agent:latest"

      ports {
        container_port = 8000
      }

      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openai_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_GENERATIVE_AI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_generative_ai_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_procurement_agent" {
  location = google_cloud_run_v2_service.procurement_agent.location
  project  = google_cloud_run_v2_service.procurement_agent.project
  service  = google_cloud_run_v2_service.procurement_agent.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 6. Agentic Red Teamer
resource "google_cloud_run_v2_service" "red_teamer" {
  name     = "agentic-red-teamer"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/agentic-red-teamer:latest"

      ports {
        container_port = 8000
      }

      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_red_teamer" {
  location = google_cloud_run_v2_service.red_teamer.location
  project  = google_cloud_run_v2_service.red_teamer.project
  service  = google_cloud_run_v2_service.red_teamer.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 7. Autonomous DevRel Agent
resource "google_cloud_run_v2_service" "devrel_agent" {
  name     = "autonomous-devrel-agent"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/autonomous-devrel-agent:latest"

      ports {
        container_port = 8000
      }

      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openai_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_devrel_agent" {
  location = google_cloud_run_v2_service.devrel_agent.location
  project  = google_cloud_run_v2_service.devrel_agent.project
  service  = google_cloud_run_v2_service.devrel_agent.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 8. Cloud Security Sentinel
resource "google_cloud_run_v2_service" "cloud_security" {
  name     = "cloud-security-sentinel"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/agentic-apps/cloud-security-sentinel:latest"
    }
  }
}

resource "google_cloud_run_service_iam_member" "public_cloud_security" {
  location = google_cloud_run_v2_service.cloud_security.location
  project  = google_cloud_run_v2_service.cloud_security.project
  service  = google_cloud_run_v2_service.cloud_security.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

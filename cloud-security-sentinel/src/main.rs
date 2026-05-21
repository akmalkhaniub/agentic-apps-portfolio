use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};
use uuid::Uuid;
use tower_http::cors::{Any, CorsLayer};

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum FindingStatus {
    Open,
    Simulated,
    PatchGenerated,
    AwaitingApproval,
    Remediated,
    Suppressed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Resource {
    resource_type: String, // s3_bucket, security_group, iam_role, rds_instance
    resource_id: String,
    region: String,
    tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Finding {
    id: String,
    resource: Resource,
    rule_id: String,
    title: String,
    description: String,
    severity: Severity,
    status: FindingStatus,
    exploitable: Option<bool>,
    remediation: Option<String>,
    terraform_patch: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScanResult {
    scan_id: String,
    started_at: DateTime<Utc>,
    completed_at: DateTime<Utc>,
    resources_scanned: usize,
    findings_count: usize,
    finding_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ScanRequest {
    regions: Option<Vec<String>>,
    resource_types: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ApprovalRequest {
    approved: bool,
    approver: String,
}

// ---------------------------------------------------------------------------
// Security rules
// ---------------------------------------------------------------------------

struct SecurityRule {
    id: &'static str,
    title: &'static str,
    check: fn(&Resource) -> Option<(Severity, String, String, String)>,
}

fn check_public_s3(r: &Resource) -> Option<(Severity, String, String, String)> {
    if r.resource_type != "s3_bucket" {
        return None;
    }
    if r.resource_id.contains("public") || r.resource_id.contains("open") {
        return Some((
            Severity::Critical,
            format!("S3 bucket '{}' has public access enabled", r.resource_id),
            "Disable public access via S3 Block Public Access settings".into(),
            format!(
                r#"resource "aws_s3_bucket_public_access_block" "{}_block" {{
  bucket = aws_s3_bucket.{}.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}}"#,
                r.resource_id, r.resource_id
            ),
        ));
    }
    None
}

fn check_open_security_group(r: &Resource) -> Option<(Severity, String, String, String)> {
    if r.resource_type != "security_group" {
        return None;
    }
    if r.resource_id.contains("open") || r.resource_id.contains("0.0.0.0") {
        return Some((
            Severity::High,
            format!("Security group '{}' allows unrestricted inbound access (0.0.0.0/0)", r.resource_id),
            "Restrict inbound rules to specific CIDR ranges".into(),
            format!(
                r#"resource "aws_security_group_rule" "{}_restrict" {{
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/8"]
  security_group_id = aws_security_group.{}.id
}}"#,
                r.resource_id, r.resource_id
            ),
        ));
    }
    None
}

fn check_overprivileged_iam(r: &Resource) -> Option<(Severity, String, String, String)> {
    if r.resource_type != "iam_role" {
        return None;
    }
    if r.resource_id.contains("admin") || r.resource_id.contains("full-access") {
        return Some((
            Severity::High,
            format!("IAM role '{}' has overly permissive policies (AdministratorAccess or *)", r.resource_id),
            "Apply least-privilege: scope down to specific services and actions".into(),
            format!(
                r#"resource "aws_iam_role_policy" "{}_scoped" {{
  name = "scoped-policy"
  role = aws_iam_role.{}.id
  policy = jsonencode({{
    Version = "2012-10-17"
    Statement = [{{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "arn:aws:s3:::my-bucket/*"
    }}]
  }})
}}"#,
                r.resource_id, r.resource_id
            ),
        ));
    }
    None
}

fn check_unencrypted_rds(r: &Resource) -> Option<(Severity, String, String, String)> {
    if r.resource_type != "rds_instance" {
        return None;
    }
    if r.resource_id.contains("unencrypted") || !r.tags.contains_key("encrypted") {
        return Some((
            Severity::Medium,
            format!("RDS instance '{}' does not have encryption at rest enabled", r.resource_id),
            "Enable encryption at rest using AWS KMS".into(),
            format!(
                r#"resource "aws_db_instance" "{}" {{
  # ... existing config ...
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn
}}"#,
                r.resource_id
            ),
        ));
    }
    None
}

fn get_rules() -> Vec<SecurityRule> {
    vec![
        SecurityRule { id: "S3_PUBLIC_ACCESS", title: "S3 Public Access", check: check_public_s3 },
        SecurityRule { id: "SG_OPEN_INBOUND", title: "Open Security Group", check: check_open_security_group },
        SecurityRule { id: "IAM_OVERPRIVILEGED", title: "Overprivileged IAM Role", check: check_overprivileged_iam },
        SecurityRule { id: "RDS_UNENCRYPTED", title: "Unencrypted RDS", check: check_unencrypted_rds },
    ]
}

// ---------------------------------------------------------------------------
// Simulated AWS infrastructure (in production: AWS SDK calls)
// ---------------------------------------------------------------------------

fn simulated_resources() -> Vec<Resource> {
    vec![
        Resource {
            resource_type: "s3_bucket".into(),
            resource_id: "company-public-assets".into(),
            region: "us-east-1".into(),
            tags: HashMap::from([("env".into(), "production".into())]),
        },
        Resource {
            resource_type: "s3_bucket".into(),
            resource_id: "internal-logs".into(),
            region: "us-east-1".into(),
            tags: HashMap::from([("env".into(), "production".into())]),
        },
        Resource {
            resource_type: "security_group".into(),
            resource_id: "sg-open-web".into(),
            region: "us-east-1".into(),
            tags: HashMap::new(),
        },
        Resource {
            resource_type: "security_group".into(),
            resource_id: "sg-internal-only".into(),
            region: "us-west-2".into(),
            tags: HashMap::new(),
        },
        Resource {
            resource_type: "iam_role".into(),
            resource_id: "deploy-admin-role".into(),
            region: "global".into(),
            tags: HashMap::new(),
        },
        Resource {
            resource_type: "iam_role".into(),
            resource_id: "lambda-reader-role".into(),
            region: "global".into(),
            tags: HashMap::new(),
        },
        Resource {
            resource_type: "rds_instance".into(),
            resource_id: "prod-db-primary".into(),
            region: "us-east-1".into(),
            tags: HashMap::new(), // no "encrypted" tag
        },
        Resource {
            resource_type: "rds_instance".into(),
            resource_id: "analytics-db".into(),
            region: "us-west-2".into(),
            tags: HashMap::from([("encrypted".into(), "true".into())]),
        },
    ]
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct AppState {
    findings: Arc<RwLock<HashMap<String, Finding>>>,
    scans: Arc<RwLock<Vec<ScanResult>>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            findings: Arc::new(RwLock::new(HashMap::new())),
            scans: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "cloud-security-sentinel",
        "rules_loaded": get_rules().len()
    }))
}

async fn run_scan(
    State(state): State<AppState>,
    Json(req): Json<ScanRequest>,
) -> (StatusCode, Json<ScanResult>) {
    let started_at = Utc::now();
    let resources = simulated_resources();
    let rules = get_rules();

    let filtered: Vec<&Resource> = resources
        .iter()
        .filter(|r| {
            req.regions.as_ref().map_or(true, |regions| regions.contains(&r.region))
                && req.resource_types
                    .as_ref()
                    .map_or(true, |types| types.contains(&r.resource_type))
        })
        .collect();

    let mut finding_ids = Vec::new();
    let mut findings = state.findings.write().unwrap();

    for resource in &filtered {
        for rule in &rules {
            if let Some((severity, description, remediation, tf_patch)) = (rule.check)(resource) {
                let id = format!("FND-{}", &Uuid::new_v4().to_string()[..8]);
                let finding = Finding {
                    id: id.clone(),
                    resource: (*resource).clone(),
                    rule_id: rule.id.to_string(),
                    title: rule.title.to_string(),
                    description,
                    severity,
                    status: FindingStatus::Open,
                    exploitable: None,
                    remediation: Some(remediation),
                    terraform_patch: Some(tf_patch),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };
                findings.insert(id.clone(), finding);
                finding_ids.push(id);
            }
        }
    }

    let scan_result = ScanResult {
        scan_id: format!("SCN-{}", &Uuid::new_v4().to_string()[..8]),
        started_at,
        completed_at: Utc::now(),
        resources_scanned: filtered.len(),
        findings_count: finding_ids.len(),
        finding_ids,
    };

    state.scans.write().unwrap().push(scan_result.clone());

    (StatusCode::OK, Json(scan_result))
}

async fn list_findings(State(state): State<AppState>) -> Json<Vec<Finding>> {
    let findings = state.findings.read().unwrap();
    let mut all: Vec<Finding> = findings.values().cloned().collect();
    all.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Json(all)
}

async fn get_finding(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Finding>, StatusCode> {
    state
        .findings
        .read()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn simulate_exploit(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Finding>, StatusCode> {
    let mut findings = state.findings.write().unwrap();
    let finding = findings.get_mut(&id).ok_or(StatusCode::NOT_FOUND)?;

    let exploitable = matches!(finding.severity, Severity::Critical | Severity::High);
    finding.exploitable = Some(exploitable);
    finding.status = FindingStatus::Simulated;
    finding.updated_at = Utc::now();

    Ok(Json(finding.clone()))
}

async fn generate_patch(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Finding>, StatusCode> {
    let mut findings = state.findings.write().unwrap();
    let finding = findings.get_mut(&id).ok_or(StatusCode::NOT_FOUND)?;

    finding.status = FindingStatus::PatchGenerated;
    finding.updated_at = Utc::now();

    Ok(Json(finding.clone()))
}

async fn approve_remediation(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<ApprovalRequest>,
) -> Result<Json<Finding>, StatusCode> {
    let mut findings = state.findings.write().unwrap();
    let finding = findings.get_mut(&id).ok_or(StatusCode::NOT_FOUND)?;

    if req.approved {
        finding.status = FindingStatus::Remediated;
    } else {
        finding.status = FindingStatus::Suppressed;
    }
    finding.updated_at = Utc::now();

    Ok(Json(finding.clone()))
}

async fn list_scans(State(state): State<AppState>) -> Json<Vec<ScanResult>> {
    Json(state.scans.read().unwrap().clone())
}

async fn dashboard(State(state): State<AppState>) -> Json<serde_json::Value> {
    let findings = state.findings.read().unwrap();
    let total = findings.len();
    let critical = findings.values().filter(|f| f.severity == Severity::Critical).count();
    let high = findings.values().filter(|f| f.severity == Severity::High).count();
    let medium = findings.values().filter(|f| f.severity == Severity::Medium).count();
    let open = findings.values().filter(|f| f.status == FindingStatus::Open).count();
    let remediated = findings.values().filter(|f| f.status == FindingStatus::Remediated).count();

    Json(serde_json::json!({
        "total_findings": total,
        "by_severity": { "critical": critical, "high": high, "medium": medium },
        "by_status": { "open": open, "remediated": remediated },
        "scans_run": state.scans.read().unwrap().len()
    }))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = AppState::new();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/dashboard", get(dashboard))
        .route("/scans", get(list_scans))
        .route("/scans/run", post(run_scan))
        .route("/findings", get(list_findings))
        .route("/findings/{id}", get(get_finding))
        .route("/findings/{id}/simulate", post(simulate_exploit))
        .route("/findings/{id}/patch", post(generate_patch))
        .route("/findings/{id}/approve", post(approve_remediation))
        .layer(cors)
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("Cloud Security Sentinel listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

$ErrorActionPreference = 'Stop'

$baseDir = "g:\ReplitProjects\AgenticApps"

Write-Host "Starting all 8 Agentic Apps Backends..." -ForegroundColor Cyan

# 1. Compliance PII Sanitizer (Python, Port 8001)
Write-Host "Starting Compliance PII Sanitizer (8001)..."
Start-Process "uvicorn" -ArgumentList "main:app --host 0.0.0.0 --port 8001" -WorkingDirectory "$baseDir\compliance-pii-sanitizer"

# 2. Fintech Fraud Mitigator (Go, Port 8081)
Write-Host "Starting Fintech Fraud Mitigator (8081)..."
Start-Process "go" -ArgumentList "run main.go" -WorkingDirectory "$baseDir\fintech-fraud-mitigator"

# 3. Medical Intake Nurse (Python, Port 8002)
Write-Host "Starting Medical Intake Nurse (8002)..."
Start-Process "uvicorn" -ArgumentList "main:app --host 0.0.0.0 --port 8002" -WorkingDirectory "$baseDir\medical-intake-nurse"

# 4. Revenue Recovery Auditor (Go, Port 8082)
Write-Host "Starting Revenue Recovery Auditor (8082)..."
Start-Process "go" -ArgumentList "run main.go" -WorkingDirectory "$baseDir\revenue-recovery-auditor"

# 5. Scientific Research Sandbox (Streamlit, Port 8501)
Write-Host "Starting Scientific Research Sandbox (8501)..."
Start-Process "python" -ArgumentList "-m streamlit run main.py --server.port 8501 --server.headless true" -WorkingDirectory "$baseDir\scientific-research-sandbox"

# 6. Travel Concierge Agent (Python, Port 8003)
Write-Host "Starting Travel Concierge Agent (8003)..."
Start-Process "uvicorn" -ArgumentList "main:app --host 0.0.0.0 --port 8003" -WorkingDirectory "$baseDir\travel-concierge-agent"

# 7. Feature Shippable Agent (NestJS, Port 3000)
Write-Host "Starting Feature Shippable Agent (3000)..."
Start-Process "npm" -ArgumentList "run start" -WorkingDirectory "$baseDir\feature-shippable-agent"

# 8. Service Dispatch Coordinator (NestJS, Port 3001)
Write-Host "Starting Enterprise Knowledge Swarm (8004)..."
Start-Job -Name "Knowledge Swarm" -ScriptBlock {
    cd .\enterprise-knowledge-swarm
    python main.py
}

Write-Host "Starting Multi-Agent Debate (8005)..."
Start-Job -Name "Multi Agent Debate" -ScriptBlock {
    cd .\multi-agent-debate
    python main.py
}

Write-Host ""
Write-Host "All backends have been launched in the background!" -ForegroundColor Green

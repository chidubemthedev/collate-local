#!/bin/bash
files=(
  "app/agents/page.tsx"
  "app/api/auth/otp/verify/route.test.ts"
  "app/api/auth/otp/verify/route.ts"
  "app/api/auth/session/route.ts"
  "app/api/coverage/assignments/route.ts"
  "app/api/coverage/summary/route.ts"
  "app/api/geography/lgas/[lgaId]/wards/route.ts"
  "app/api/geography/states/[stateId]/lgas/route.ts"
  "app/api/geography/states/[stateId]/route.ts"
  "app/api/geography/states/route.ts"
  "app/broadcasts/new/page.tsx"
  "app/candidates/page.tsx"
  "app/coverage/page.tsx"
  "app/layout.tsx"
  "app/login/page.tsx"
  "app/recipients/page.tsx"
  "components/agents/agents-filters.tsx"
  "components/agents/agents-kpi-summary.tsx"
  "components/agents/agents-table.tsx"
  "components/broadcasts/live-broadcast-report.tsx"
  "components/broadcasts/live-broadcasts-page.tsx"
  "components/candidates/candidate-detail-modal.tsx"
  "components/candidates/candidates-filters.tsx"
  "components/candidates/candidates-table.tsx"
  "components/coverage/at-stake-candidates.tsx"
)

for file in "${files[@]}"; do
  git checkout --ours "$file"
  git add "$file"
done

git commit -m "Resolve merge conflicts - keep HEAD"

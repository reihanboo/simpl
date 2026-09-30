# Deploying SIMPL to Oracle Kubernetes Engine (OKE)

`.github/workflows/deploy-oke.yml` builds the backend and frontend images, pushes
them to Oracle Cloud Infrastructure Registry (OCIR), and rolls them out to an OKE
cluster. It runs on every push to `main` and can also be started manually from the
Actions tab.

## What the workflow does

1. **build-and-push** (`ubuntu-latest`)
   - Logs in to OCIR with `OCIR_USERNAME` / `OCIR_AUTH_TOKEN`.
   - Builds `./backend` and `./frontend` and pushes each with two tags:
     `<short-sha>` and `latest`.
2. **deploy** (needs `build-and-push`)
   - Configures `kubectl` for the cluster with
     `oracle-actions/configure-kubectl-oke`.
   - Applies `deploy/k8s/` (rendered with the exact image tags).
   - Creates/refreshes the `simpl-secrets` and `ocir-pull` secrets.
   - Waits for both deployments to roll out.

The manifests live in `deploy/k8s/` and use `${BACKEND_IMAGE}`, `${FRONTEND_IMAGE}`
and `${FRONTEND_URL}` placeholders that the workflow substitutes with `envsubst`.

## Resources created

| File | Resources |
| --- | --- |
| `namespace.yaml` | Namespace `simpl` |
| `postgres.yaml` | Service `db` (headless) + StatefulSet `simpl-db` (Postgres 15, 5Gi PVC) |
| `backend.yaml` | ConfigMap `simpl-config`, Deployment `simpl-backend`, Service `backend` (ClusterIP :8080) |
| `frontend.yaml` | Deployment `simpl-frontend`, Service `simpl-frontend` (LoadBalancer :80) |

The frontend Nginx proxies `/api/` to `http://backend:8080`, which matches the
`backend` Service name, so no extra configuration is needed.

## Prerequisites

1. An OKE cluster with a **public Kubernetes API endpoint** (GitHub-hosted runners
   cannot reach a private endpoint; that would require a self-hosted runner).
2. OCIR repositories **`simpl-backend`** and **`simpl-frontend`** in the target
   compartment (Developer Services > Container Registry). Pushing can create them
   automatically if your IAM policy allows `manage repos`.
3. An OCI API key for a user that can manage the OKE cluster, and an OCIR auth
   token for the same user.

## Required GitHub secrets

Add these under **Settings > Secrets and variables > Actions**.

### OCIR (image registry)

| Secret | Example / source |
| --- | --- |
| `OCIR_REGISTRY` | `sin.ocir.io` (your region's OCIR host) |
| `OCIR_NAMESPACE` | Tenancy **Object Storage namespace** (Tenancy details), *not* the tenancy name |
| `OCIR_USERNAME` | `<namespace>/<user-email>` or `<namespace>/<identity-domain>/<user-email>` |
| `OCIR_AUTH_TOKEN` | Identity > Users > your user > Auth tokens |

### OCI CLI (cluster access)

| Secret | Example / source |
| --- | --- |
| `OCI_CLI_USER` | User OCID (`ocid1.user.oc1...`) |
| `OCI_CLI_TENANCY` | Tenancy OCID |
| `OCI_CLI_FINGERPRINT` | API key fingerprint |
| `OCI_CLI_KEY_CONTENT` | Full PEM private key contents of the API key |
| `OCI_CLI_REGION` | `ap-singapore-1` |
| `OKE_CLUSTER_OCID` | OKE cluster OCID (`ocid1.cluster.oc1...`) |

### Application

| Secret | Purpose |
| --- | --- |
| `DB_PASSWORD` | Postgres password (also becomes the DB password for the backend) |
| `JWT_SECRET` | Backend JWT signing secret |
| `DEEPSEEK_API` | DeepSeek API key for the ABAI assistant |
| `RESEND_API_KEY` | Resend key for transactional email |
| `MIDTRANS_SERVER_KEY` | Midtrans server key |
| `AI_DB_USER` | Optional read-only AI DB role; leave empty to reuse the primary connection |
| `AI_DB_PASSWORD` | Optional password for `AI_DB_USER` |

### Repository variable (optional)

- `FRONTEND_URL` (Settings > Secrets and variables > Actions > **Variables**):
  the public URL used in email links and password resets, e.g.
  `https://app.example.com`. If unset it is empty.

## First deploy and access

1. Push to `main` (or run the workflow manually).
2. Get the public endpoint once the LoadBalancer is provisioned:
   ```bash
   kubectl -n simpl get svc simpl-frontend
   ```
   Wait for `EXTERNAL-IP` to change from `<pending>` to an IP.
3. Set the `FRONTEND_URL` variable to `http://<EXTERNAL-IP>` (or your domain) and
   re-run the workflow so email links are correct.

## Notes and caveats

- **In-cluster Postgres** stores data in a PersistentVolumeClaim (default storage
  class, typically `oci-bv`). It is a single replica with no backups; for
  production consider a managed database and point `DB_HOST` (ConfigMap) at it.
- The backend waits for `db:5432` with an init container and creates the database
  and tables on first start.
- Database and email credentials are stored in the `simpl-secrets` Kubernetes
  Secret — rotating them means updating the GitHub secret and re-running the
  workflow.
- To roll back, set the Deployment image back to a previous tag:
  ```bash
  kubectl -n simpl set image deployment/simpl-backend backend=<registry>/<ns>/simpl-backend:<old-sha>
  ```

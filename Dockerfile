# ==============================================================================
# IAST AWS Node - Combined Server + Web Dockerfile
# Multi-stage build: builds the React frontend and Fastify server into one image.
# ==============================================================================

# -- Stage 1: Build ------------------------------------------------------------
FROM packages.ic1.statefarm/eci-base-images/nodejs/al2023-dev/24:1 AS builder

WORKDIR /build

# Copy workspace root files needed for npm install
COPY package.json package-lock.json tsconfig.base.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

# Install all dependencies (including devDependencies for building)
RUN --mount=type=secret,id=jfrog_user,env=JFROG_USER \
    --mount=type=secret,id=jfrog_temp_id_token,env=JFROG_TEMP_IDENTITY_TOKEN \
    npm ci

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/
COPY packages/server/ packages/server/

# Build-time arguments (VITE_* vars are embedded in client JS bundle by Vite)
ARG ENTRA_CLIENT_ID
ARG ENTRA_TENANT_ID
ARG ENTRA_API_SCOPE

ENV VITE_ENTRA_CLIENT_ID=$ENTRA_CLIENT_ID
ENV VITE_ENTRA_TENANT_ID=$ENTRA_TENANT_ID
ENV VITE_ENTRA_API_SCOPE=$ENTRA_API_SCOPE
ENV VITE_API_BASE_URL=/api
ENV NODE_ENV=production

# Build web app (produces packages/web/dist/)
RUN npm run build:web

# Build server (produces packages/server/dist/)
RUN npm run build:server

# Prune devDependencies for a leaner production image
RUN npm prune --omit=dev

# -- Stage 2: Runtime ----------------------------------------------------------
FROM packages.ic1.statefarm/eci-base-images/nodejs/al2023/24:1

WORKDIR /application

# Copy production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./

# Copy workspace package manifests (needed for module resolution)
COPY --from=builder /build/packages/server/package.json packages/server/
COPY --from=builder /build/packages/shared/package.json packages/shared/

# Copy compiled server (includes shared code)
COPY --from=builder /build/packages/server/dist packages/server/dist/

# Copy built web app static files (served by Fastify or placed behind nginx)
COPY --from=builder /build/packages/web/dist packages/web/dist/

ENV WEB_DIST_PATH=/application/packages/web/dist
ENV NODE_ENV=production
ENV PORT=3000

# Prepare the container to run on OpenShift
RUN sf_init.sh .

EXPOSE 3000

# Start the server (dumb-init as PID 1 for proper signal handling)
CMD ["dumb-init", "node", "packages/server/dist/index.js"]

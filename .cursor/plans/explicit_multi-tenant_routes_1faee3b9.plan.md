---
name: Explicit Multi-Tenant Routes
overview: Refactor all API routes from flat structure (e.g., `/folders`) to explicit RESTy multi-tenant structure (`/api/v1/teams/:teamId/folders`) with proper teamId validation and context enforcement.
todos:
  - id: create-team-context-middleware
    content: Create team context middleware plugin that validates teamId from URL matches JWT token and injects validated teamId into context
    status: completed
  - id: create-v1-router
    content: Create /api/v1 router structure with /teams/:teamId grouping and apply team context middleware
    status: completed
    dependencies:
      - create-team-context-middleware
  - id: refactor-folders-module
    content: Refactor folders module to use /api/v1/teams/:teamId/folders structure and update handlers to use params.teamId
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-test-cases-module
    content: Refactor test-cases module to use /api/v1/teams/:teamId/test-cases structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-environments-module
    content: Refactor environments module to use /api/v1/teams/:teamId/environments structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-test-labels-module
    content: Refactor test-labels module to use /api/v1/teams/:teamId/test-labels structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-test-reviews-module
    content: Refactor test-reviews module (including nested comments/reviewers) to use /api/v1/teams/:teamId/test-reviews structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-test-runs-module
    content: Refactor test-runs module to use /api/v1/teams/:teamId/test-runs structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-test-run-items-module
    content: Refactor test-run-items module to use /api/v1/teams/:teamId/test-run-items structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-test-results-module
    content: Refactor test-results module to use /api/v1/teams/:teamId/test-results structure
    status: completed
    dependencies:
      - create-v1-router
  - id: refactor-analytics-module
    content: Refactor analytics module to use /api/v1/teams/:teamId/analytics structure
    status: completed
    dependencies:
      - create-v1-router
  - id: update-main-server
    content: Update main server index.ts to mount /api/v1 routes and maintain health check at root
    status: completed
    dependencies:
      - refactor-folders-module
      - refactor-test-cases-module
      - refactor-environments-module
      - refactor-test-labels-module
      - refactor-test-reviews-module
      - refactor-test-runs-module
      - refactor-test-run-items-module
      - refactor-test-results-module
      - refactor-analytics-module
  - id: update-service-context-types
    content: Update all service context types to require teamId (remove optional) and ensure services validate teamId matches resource ownership
    status: completed
    dependencies:
      - refactor-folders-module
---

# Explicit Multi-Tenant Routes Implementation Plan

## Current State Analysis

**Current Issues:**

- Routes are flat: `/folders`, `/test-cases`, `/environments`, etc.
- Multi-tenancy is "loose": `teamId` comes from JWT token but isn't enforced in URL path
- No validation that URL `teamId` matches token `teamId`
- No explicit tenant context in route structure

**Current Route Pattern:**

```
GET /folders
GET /test-cases
POST /environments
```

**Target Route Pattern:**

```
GET /api/v1/teams/:teamId/folders
GET /api/v1/teams/:teamId/test-cases
POST /api/v1/teams/:teamId/environments
```

## Implementation Strategy

### 1. Create Team Context Middleware

Create a new middleware plugin that:

- Extracts `teamId` from URL path parameter
- Validates `teamId` matches the JWT token's `teamId` (or user has access)
- Validates user is a member of the team (optional but recommended)
- Injects validated `teamId` into context for downstream handlers

**File:** `apps/app-server/src/lib/middleware/team-context.ts`

**Key Features:**

- Use Elysia's `derive` or `onBeforeHandle` to validate teamId
- Return 403 if teamId mismatch or user lacks access
- Decorate context with validated `currentTeamId`

### 2. Create API Version Router

Create a base router with `/api/v1` prefix that:

- Groups all team-scoped routes under `/teams/:teamId`
- Applies team context middleware
- Do no maintain backward compatibility during migration

**File:** `apps/app-server/src/lib/routes/v1.ts`

### 3. Refactor Module Routes

For each module, refactor routes to:

- Remove flat prefix (e.g., `/folders`)
- Use nested structure under `/api/v1/teams/:teamId/{resource}`
- Update route handlers to use `params.teamId` instead of `teamId` from auth context
- Ensure service layer validates `teamId` from context matches URL `teamId`

**Modules to Update:**

- `folders` → `/api/v1/teams/:teamId/folders`
- `test-cases` → `/api/v1/teams/:teamId/test-cases`
- `environments` → `/api/v1/teams/:teamId/environments`
- `test-labels` → `/api/v1/teams/:teamId/test-labels`
- `test-reviews` → `/api/v1/teams/:teamId/test-reviews`
- `test-runs` → `/api/v1/teams/:teamId/test-runs`
- `test-run-items` → `/api/v1/teams/:teamId/test-run-items`
- `test-results` → `/api/v1/teams/:teamId/test-results`
- `analytics` → `/api/v1/teams/:teamId/analytics`

### 4. Update Service Layer Context

Ensure all service methods:

- Require `teamId` in context (not optional)
- Validate `teamId` matches the resource being accessed
- Use `teamId` from context (not from request params directly)

**Pattern:**

```typescript
// Before
const context: FolderContext = {
  orgId: organizationId ?? undefined,
  teamId: teamId ?? undefined,  // Optional
  userId: user?.id,
};

// After
const context: FolderContext = {
  orgId: organizationId!,
  teamId: params.teamId,  // Required from URL
  userId: user!.id,
};
```

### 5. Update Main Server Entry

Refactor `apps/app-server/src/index.ts` to:

- Mount `/api/v1` router
- Apply team context middleware to all team-scoped routes
- Maintain health check and other non-tenant routes at root level

## File Changes

### New Files

1. `apps/app-server/src/lib/middleware/team-context.ts` - Team validation middleware
2. `apps/app-server/src/lib/routes/v1.ts` - API v1 router with team grouping

### Modified Files

1. `apps/app-server/src/index.ts` - Update to use new route structure
2. `apps/app-server/src/modules/folders/index.ts` - Refactor routes
3. `apps/app-server/src/modules/test-cases/index.ts` - Refactor routes
4. `apps/app-server/src/modules/environments/index.ts` - Refactor routes
5. `apps/app-server/src/modules/test-labels/index.ts` - Refactor routes
6. `apps/app-server/src/modules/test-reviews/core/index.ts` - Refactor routes
7. `apps/app-server/src/modules/test-runs/index.ts` - Refactor routes
8. `apps/app-server/src/modules/test-run-items/index.ts` - Refactor routes
9. `apps/app-server/src/modules/test-results/index.ts` - Refactor routes
10. `apps/app-server/src/modules/analytics/index.ts` - Refactor routes

### Service Layer Updates

- Update all service methods to require `teamId` (remove optional)
- Add validation that `teamId` in context matches resource's `teamId`

## Implementation Details

### Team Context Middleware Pattern

```typescript
export const teamContextPlugin = new Elysia({ name: "team-context" })
  .derive(async ({ params, teamId: tokenTeamId, user }) => {
    const urlTeamId = params.teamId;
    
    // Validate teamId exists in URL
    if (!urlTeamId) {
      throw new Error("teamId is required in URL");
    }
    
    // Validate teamId matches token (or user has access)
    if (tokenTeamId !== urlTeamId) {
      // Optionally: Check if user is member of urlTeamId
      // For now, enforce strict match
      throw new Error("Team ID mismatch");
    }
    
    return {
      currentTeamId: urlTeamId,
      validatedTeamId: urlTeamId,
    };
  });
```

### Route Grouping Pattern

```typescript
// apps/app-server/src/lib/routes/v1.ts
export const v1Routes = new Elysia({ prefix: "/api/v1" })
  .group("/teams/:teamId", (app) =>
    app
      .use(teamContextPlugin)
      .use(folders)
      .use(testCases)
      .use(environments)
      // ... other modules
  );
```

### Module Route Pattern

```typescript
// Before: apps/app-server/src/modules/folders/index.ts
export const folders = new Elysia({ prefix: "/folders" })
  .get("/", async ({ organizationId, teamId, query, user }) => {
    // ...
  });

// After
export const folders = new Elysia({ prefix: "/folders" })
  .get("/", async ({ params, organizationId, query, user }) => {
    const context = {
      orgId: organizationId!,
      teamId: params.teamId,  // From URL, validated by middleware
      userId: user!.id,
    };
    // ...
  });
```

## Validation & Security

1. **URL teamId Validation**: Middleware ensures `params.teamId` exists and is valid UUID
2. **Token teamId Matching**: Enforce that JWT `teamId` matches URL `teamId` (or user has access)
3. **Service Layer Validation**: Services validate `teamId` matches resource ownership
4. **Database Query Filtering**: All queries must filter by `teamId` from validated context

## Migration Strategy

1. **Phase 1**: Create middleware and v1 router structure
2. **Phase 2**: Refactor one module (e.g., `folders`) as proof of concept
3. **Phase 3**: Refactor remaining modules one by one
4. **Phase 4**: Update main server to use new routes
5. **Phase 5**: Remove old flat routes

## Testing Considerations

- Test that invalid `teamId` in URL returns 403
- Test that `teamId` mismatch between URL and token returns 403
- Test that valid `teamId` allows access
- Test that all CRUD operations respect `teamId` isolation
- Test nested routes (e.g., `/teams/:teamId/test-reviews/:id/comments`)

## Benefits

1. **Explicit Multi-Tenancy**: Route structure clearly shows tenant scope
2. **Better Security**: URL teamId validation prevents accidental cross-tenant access
3. **RESTful Design**: Follows REST conventions for resource nesting
4. **Type Safety**: Elysia's type system ensures `teamId` is available in handlers
5. **Maintainability**: Clear separation of tenant-scoped vs global routes
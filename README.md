# Pothos Fragment Deduplication Bug Reproduction

This project reproduces a bug in Pothos GraphQL where fragments sharing the same alias but requesting different fields generate suboptimal SQL queries with OR patterns instead of optimal LATERAL JOINs.

## Bug Summary

**When two fragments share the same alias with identical filter arguments but request DIFFERENT fields**, Pothos's dataloader:

1. Loads data for fragment 1 via optimal LATERAL JOIN
2. Sees fragment 2 needs additional fields (e.g., `greenPowerOffsite`)
3. Loads missing fields by **unique key** `(propertyId, endDate)` instead of re-running the filter
4. Generates OR pattern: `WHERE ((property_id=$1 AND end_date=$2) OR ...)`

### Buggy SQL (same alias)
```sql
SELECT "green_power_offsite" FROM "property_metrics_view" 
WHERE (("property_id" = $1 AND "end_date" = $2) 
    OR ("property_id" = $3 AND "end_date" = $4) 
    OR ...)
```

### Optimal SQL (different aliases)
```sql
LEFT JOIN LATERAL (
  SELECT ... FROM "property_metrics_view" 
  WHERE ("end_date" >= $1 AND "end_date" <= $2 AND "month" = $3)
  ...
) ...
```

## Root Cause

The `select: { propertyId: true, endDate: true }` configuration on `PropertyMetrics` tells Pothos to use the composite key for dataloader batching. When fragments share the same alias with different field selections, Pothos batches the load of missing fields by unique key rather than re-executing with the filter.

## Versions

- Prisma: 6.19.0
- @pothos/core: 4.10.0
- @pothos/plugin-prisma: 4.13.0
- @pothos/plugin-prisma-utils: (latest)
- @pothos/plugin-relay: 4.6.2

## Prerequisites

- Docker (for PostgreSQL)
- Node.js 18+

## Setup

```bash
# Start PostgreSQL
docker-compose up -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations and seed
npx prisma migrate dev
npm run seed
```

## Reproduce the Bug

```bash
npm run test:bug
```

This runs two queries:
1. **BUGGY**: Fragments share same `yearlyMetrics` alias → produces OR pattern
2. **WORKAROUND**: Fragments use different aliases → produces optimal LATERAL JOINs

## Workaround

Use different aliases for each fragment, even if filter arguments are identical:

```graphql
# Instead of both fragments using "yearlyMetrics":
fragment ElectricityChart_property on Property {
  electricityMetrics: metrics(filter: {...}) { ... }  # Unique alias
}

fragment GreenPowerChart_property on Property {
  greenPowerMetrics: metrics(filter: {...}) { ... }   # Different alias
}
```

## Key Configuration

The bug requires these conditions:
1. `select: { propertyId: true, endDate: true }` on the Prisma object (composite key)
2. `prismaWhere` filter from `@pothos/plugin-prisma-utils`
3. `relatedConnection` with composite cursor
4. Two fragments with same alias, same args, but different field selections

## Filing an Issue

This reproduction can be used to file an issue with the Pothos GraphQL project:
- https://github.com/hayes/pothos/issues

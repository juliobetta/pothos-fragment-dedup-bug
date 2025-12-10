# Pothos Fragment Deduplication Bug

Minimal reproduction of a Pothos GraphQL bug where fragments sharing the same alias but requesting different fields generate suboptimal SQL with OR patterns.

## Bug Summary

When two fragments share the same alias with identical filter args but request **different fields**, Pothos's dataloader loads missing fields by unique key instead of re-running the filter.

### Buggy SQL (same alias)
```sql
SELECT "field_a" FROM "Metric" 
WHERE (("property_id" = $1 AND "end_date" = $2) OR ...)  -- OR pattern!
```

### Optimal SQL (different aliases)
```sql
LEFT JOIN LATERAL (... WHERE "end_date" >= $1 AND "end_date" <= $2 ...)
```

## Setup

```bash
docker-compose up -d
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
```

## Reproduce

```bash
npm run test:bug
```

Watch for:
- **TEST 1**: OR pattern in SQL (buggy)
- **TEST 2**: All LATERAL JOINs (optimal)

## Key Configuration

```typescript
// Metric type with composite key (triggers bug)
builder.prismaObject("Metric", {
  select: { propertyId: true, endDate: true },  // CRITICAL
  ...
});

// relatedConnection with composite cursor
metrics: t.relatedConnection("metrics", {
  cursor: "propertyId_endDate",
  ...
});
```

## Workaround

Use different aliases for each fragment:

```graphql
# Instead of both using "yearlyMetrics":
fragment A on Property { metricsA: metrics(...) { fieldA } }
fragment B on Property { metricsB: metrics(...) { fieldC } }
```

## Versions

- Prisma: 6.19.0
- @pothos/core: 4.10.0
- @pothos/plugin-prisma: 4.13.0

import { execute, parse } from "graphql";
import { schema } from "./schema";
import { prisma } from "./db";

// ========================================================================
// BUG REPRODUCTION: Pothos Fragment Deduplication with Different Fields
// ========================================================================

// BUGGY QUERY: Two fragments share same "yearlyMetrics" alias -> OR pattern
const BUGGY_QUERY = `
query AccountTrendsQuery($accountId: ID!, $endDate: DateTime!, $month: Int!) {
  account(id: $accountId) {
    id
    name
    propertyRelationships(first: 50) {
      edges {
        node {
          property {
            id
            name
            metrics(first: 10, filter: { endDate: { lte: $endDate } }) {
              edges {
                node {
                  endDate
                  electricity
                }
              }
            }
            # Two fragments share "yearlyMetrics" alias - CAUSES BUG
            ...ElectricityChart_property
            ...GreenPowerChart_property
          }
        }
      }
    }
  }
}

# Fragment 1: requests electricity, greenPowerOnsite
fragment ElectricityChart_property on Property {
  yearlyMetrics: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        month
        electricity
        greenPowerOnsite
      }
    }
  }
}

# Fragment 2: SAME alias, but requests greenPowerOffsite (different field!)
fragment GreenPowerChart_property on Property {
  yearlyMetrics: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        month
        greenPowerOnsite
        greenPowerOffsite
      }
    }
  }
}
`;

// WORKAROUND QUERY: Different aliases -> optimal LATERAL JOINs
const WORKAROUND_QUERY = `
query AccountTrendsQueryFixed($accountId: ID!, $endDate: DateTime!, $month: Int!) {
  account(id: $accountId) {
    id
    name
    propertyRelationships(first: 50) {
      edges {
        node {
          property {
            id
            name
            metrics(first: 10, filter: { endDate: { lte: $endDate } }) {
              edges {
                node {
                  endDate
                  electricity
                }
              }
            }
            # Different aliases - AVOIDS BUG
            ...ElectricityChartFixed_property
            ...GreenPowerChartFixed_property
          }
        }
      }
    }
  }
}

# Fragment 1: unique alias "electricityMetrics"
fragment ElectricityChartFixed_property on Property {
  electricityMetrics: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        month
        electricity
        greenPowerOnsite
      }
    }
  }
}

# Fragment 2: unique alias "greenPowerMetrics" - AVOIDS BUG
fragment GreenPowerChartFixed_property on Property {
  greenPowerMetrics: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        month
        greenPowerOnsite
        greenPowerOffsite
      }
    }
  }
}
`;

async function runTests() {
  const account = await prisma.account.findFirst();
  if (!account) {
    console.log("No account found. Run seed first.");
    return;
  }

  const variables = {
    accountId: account.id,
    endDate: new Date("2024-11-30"),
    month: 11,
  };

  // ============= TEST 1: BUGGY QUERY =============
  console.log("=".repeat(80));
  console.log("TEST 1: BUGGY QUERY (same 'yearlyMetrics' alias)");
  console.log("=".repeat(80));
  console.log("\nWATCH FOR: OR pattern in final SQL query");
  console.log("  WHERE ((property_id = $1 AND end_date = $2) OR ...)");
  console.log("\n>>> Executing buggy query...\n");

  const buggyResult = await execute({
    schema,
    document: parse(BUGGY_QUERY),
    variableValues: variables,
    contextValue: {},
  });

  if (buggyResult.errors) {
    console.log("\nErrors:", JSON.stringify(buggyResult.errors, null, 2));
  }

  const buggyEdges = (buggyResult.data as any)?.account?.propertyRelationships?.edges || [];
  console.log("\n" + "-".repeat(80));
  console.log("BUGGY QUERY RESULTS:");
  console.log(`  Properties: ${buggyEdges.length}`);
  if (buggyEdges[0]) {
    const prop = buggyEdges[0].node.property;
    console.log(`  First property yearlyMetrics: ${prop.yearlyMetrics?.edges?.length || 0} records`);
  }

  // ============= TEST 2: WORKAROUND QUERY =============
  console.log("\n\n" + "=".repeat(80));
  console.log("TEST 2: WORKAROUND QUERY (different aliases)");
  console.log("=".repeat(80));
  console.log("\nEXPECTED: All LATERAL JOINs, no OR pattern");
  console.log("\n>>> Executing workaround query...\n");

  const fixedResult = await execute({
    schema,
    document: parse(WORKAROUND_QUERY),
    variableValues: variables,
    contextValue: {},
  });

  if (fixedResult.errors) {
    console.log("\nErrors:", JSON.stringify(fixedResult.errors, null, 2));
  }

  const fixedEdges = (fixedResult.data as any)?.account?.propertyRelationships?.edges || [];
  console.log("\n" + "-".repeat(80));
  console.log("WORKAROUND QUERY RESULTS:");
  console.log(`  Properties: ${fixedEdges.length}`);
  if (fixedEdges[0]) {
    const prop = fixedEdges[0].node.property;
    console.log(`  First property electricityMetrics: ${prop.electricityMetrics?.edges?.length || 0} records`);
    console.log(`  First property greenPowerMetrics: ${prop.greenPowerMetrics?.edges?.length || 0} records`);
  }

  // ============= SUMMARY =============
  console.log("\n\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`
BUG DESCRIPTION:
  When two fragments share the same alias with identical filter arguments,
  but request DIFFERENT fields, Pothos's dataloader:
  1. Loads data for fragment 1 via optimal LATERAL JOIN
  2. Sees fragment 2 needs additional fields (e.g., greenPowerOffsite)
  3. Loads missing fields by UNIQUE KEY (propertyId, endDate)
  4. Generates OR pattern: WHERE ((id=$1 AND date=$2) OR (id=$3 AND date=$4) OR ...)

ROOT CAUSE:
  The 'select: { propertyId: true, endDate: true }' on PropertyMetrics
  tells Pothos to use the composite key for dataloader batching.

WORKAROUND:
  Use different aliases for each fragment, even if filter args are the same.
  This forces Pothos to execute separate queries with proper filter pushdown.
`);
  console.log("=".repeat(80));

  await prisma.$disconnect();
}

runTests().catch(console.error);

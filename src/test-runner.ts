import { execute, parse } from "graphql";
import { schema } from "./schema";
import { prisma } from "./db";

// BUGGY: Same alias "yearlyMetrics", different fields → OR pattern
const BUGGY_QUERY = `
query PropertiesQuery($endDate: DateTime!, $month: Int!) {
  properties(first: 10) {
    edges {
      node {
        id
        name
        ...FragmentA
        ...FragmentB
      }
    }
  }
}

# Fragment A: requests fieldA, fieldB
fragment FragmentA on Property {
  yearlyMetrics: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        fieldA
        fieldB
      }
    }
  }
}

# Fragment B: SAME alias, requests fieldB, fieldC (different!)
fragment FragmentB on Property {
  yearlyMetrics: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        fieldB
        fieldC
      }
    }
  }
}
`;

// WORKAROUND: Different aliases → optimal LATERAL JOINs
const FIXED_QUERY = `
query PropertiesQueryFixed($endDate: DateTime!, $month: Int!) {
  properties(first: 10) {
    edges {
      node {
        id
        name
        ...FragmentAFixed
        ...FragmentBFixed
      }
    }
  }
}

# Fragment A: unique alias
fragment FragmentAFixed on Property {
  metricsA: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        fieldA
        fieldB
      }
    }
  }
}

# Fragment B: different alias
fragment FragmentBFixed on Property {
  metricsB: metrics(filter: { endDate: { lte: $endDate, gte: "2021-01-01" }, month: { equals: $month } }) {
    edges {
      node {
        endDate
        fieldB
        fieldC
      }
    }
  }
}
`;

async function run() {
  const variables = { endDate: new Date("2024-11-30"), month: 11 };

  console.log("=".repeat(70));
  console.log("TEST 1: BUGGY (same alias) - watch for OR pattern");
  console.log("=".repeat(70));
  
  await execute({ schema, document: parse(BUGGY_QUERY), variableValues: variables, contextValue: {} });

  console.log("\n" + "=".repeat(70));
  console.log("TEST 2: FIXED (different aliases) - all LATERAL JOINs");
  console.log("=".repeat(70));
  
  await execute({ schema, document: parse(FIXED_QUERY), variableValues: variables, contextValue: {} });

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY: Look for 'WHERE ((property_id = $1 AND end_date = $2) OR ...)' in TEST 1");
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

run().catch(console.error);

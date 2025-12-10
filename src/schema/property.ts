import { builder } from "../builder";
import { prisma } from "../db";

// Prisma filters
const DateFilter = builder.prismaFilter("DateTime", {
  ops: ["gte", "lte", "equals"],
});

const IntFilter = builder.prismaFilter("Int", {
  ops: ["equals"],
});

// Metric type - composite key triggers the bug
export const Metric = builder.prismaObject("Metric", {
  // This select is CRITICAL - tells Pothos to use composite key for dataloader
  select: { propertyId: true, endDate: true },
  fields: (t) => ({
    propertyId: t.exposeString("propertyId"),
    endDate: t.expose("endDate", { type: "DateTime" }),
    month: t.exposeInt("month"),
    fieldA: t.exposeInt("fieldA"),
    fieldB: t.exposeInt("fieldB"),
    fieldC: t.exposeInt("fieldC"),
  }),
});

// Filter for metrics
const MetricFilter = builder.prismaWhere("Metric", {
  fields: () => ({
    endDate: DateFilter,
    month: IntFilter,
  }),
});

// Property type
export const Property = builder.prismaNode("Property", {
  id: { field: "id" },
  fields: (t) => ({
    name: t.exposeString("name"),

    // relatedConnection with composite cursor - where bug manifests
    metrics: t.relatedConnection("metrics", {
      cursor: "propertyId_endDate",
      totalCount: true,
      nullable: false,
      args: {
        filter: t.arg({ type: MetricFilter, required: false }),
      },
      query: (args) => ({
        where: args.filter ?? {},
        orderBy: { endDate: "asc" as const },
      }),
    }),
  }),
});

// Simple query to fetch properties
builder.queryField("properties", (t) =>
  t.prismaConnection({
    type: "Property",
    cursor: "id",
    resolve: (query) =>
      prisma.property.findMany({
        ...query,
        orderBy: { name: "asc" },
      }),
  })
);

import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import PrismaUtilsPlugin from "@pothos/plugin-prisma-utils";
import RelayPlugin from "@pothos/plugin-relay";
import type PrismaTypes from "@pothos/plugin-prisma/generated";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
}>({
  plugins: [PrismaPlugin, PrismaUtilsPlugin, RelayPlugin],
  prisma: {
    client: prisma,
    dmmf: Prisma.dmmf,
    exposeDescriptions: true,
    filterConnectionTotalCount: true,
    maxConnectionSize: 10000,
    defaultConnectionSize: 10000,
  },
  relay: {
    clientMutationId: "omit",
    cursorType: "String",
  },
});

// DateTime scalar
builder.scalarType("DateTime", {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => new Date(value as string),
});

builder.queryType({});

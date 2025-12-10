import { prisma } from "./db";

async function seed() {
  // Clear existing data
  await prisma.metric.deleteMany();
  await prisma.property.deleteMany();

  // Create 5 properties with metrics
  const properties = await Promise.all(
    ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((name) =>
      prisma.property.create({ data: { name } })
    )
  );

  // Create metrics for each property (4 years of data)
  for (const property of properties) {
    for (const year of [2021, 2022, 2023, 2024]) {
      await prisma.metric.create({
        data: {
          propertyId: property.id,
          endDate: new Date(`${year}-11-30`),
          month: 11,
          fieldA: year * 100 + 1,
          fieldB: year * 100 + 2,
          fieldC: year * 100 + 3,
        },
      });
    }
  }

  console.log(`Seeded ${properties.length} properties with metrics`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

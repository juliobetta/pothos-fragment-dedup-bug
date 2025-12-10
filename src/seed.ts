import { prisma } from "./db";

async function seed() {
  // Clear existing data (use source table, not view)
  await prisma.accountPropertyRelationship.deleteMany();
  await prisma.propertyMetricsSource.deleteMany();
  await prisma.property.deleteMany();
  await prisma.account.deleteMany();
  await prisma.event.deleteMany();

  // Create an account (simulates the real Account model)
  const account = await prisma.account.create({
    data: { name: "Test Portfolio" },
  });

  // Create 10 properties to simulate real-world batching
  const propertyNames = [
    "Property A", "Property B", "Property C", "Property D", "Property E",
    "Property F", "Property G", "Property H", "Property I", "Property J",
  ];

  // Create yearly metrics for each property (2021-2024)
  // This simulates the real-world scenario where:
  // - Multiple properties (10+)
  // - Multiple years of data (4 years)
  // - Same month filter (e.g., month=11 for fiscal year end)
  //
  // With 10 properties × 4 years = 40 OR conditions in buggy query!
  const years = [2021, 2022, 2023, 2024];

  for (const name of propertyNames) {
    const property = await prisma.property.create({ data: { name } });

    // Create account-property relationship
    await prisma.accountPropertyRelationship.create({
      data: {
        accountId: account.id,
        propertyId: property.id,
      },
    });

    // Create yearly metrics (month=11) for each year - this is "yearlyMetrics"
    // Insert into source table (view will reflect the data)
    for (const year of years) {
      await prisma.propertyMetricsSource.create({
        data: {
          propertyId: property.id,
          endDate: new Date(`${year}-11-30`),
          month: 11,
          electricity: Math.floor(Math.random() * 10000) + 5000,
          greenPowerOnsite: Math.floor(Math.random() * 2000),
          greenPowerOffsite: Math.floor(Math.random() * 1000),
        },
      });
    }

    // Note: 2024-11-30 already created in yearly loop above
  }

  const totalMetrics = await prisma.propertyMetricsSource.count();

  // Create events (keep original)
  const events = [
    {
      title: "Past Event 1",
      startDate: new Date("2024-11-01"),
      endDate: new Date("2024-11-02"),
    },
    {
      title: "Future Event 1",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-05"),
    },
  ];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }

  console.log(`Seeded ${propertyNames.length} properties with ${totalMetrics} metrics`);
  console.log(`(${propertyNames.length} properties × ${years.length} years = ${propertyNames.length * years.length} OR conditions in buggy query)`);
  console.log("Seeded", events.length, "events");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

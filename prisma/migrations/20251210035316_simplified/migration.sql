-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "property_id" TEXT NOT NULL,
    "end_date" DATE NOT NULL,
    "month" INTEGER NOT NULL,
    "field_a" INTEGER NOT NULL,
    "field_b" INTEGER NOT NULL,
    "field_c" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Metric_property_id_end_date_key" ON "Metric"("property_id", "end_date");

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

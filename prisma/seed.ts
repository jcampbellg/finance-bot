import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.conversion.create({
    data: {
      dollarToHNL: parseFloat(process.env.DOLLAR_TO_HNL || '24.6'),
      hnlToDollar: parseFloat(process.env.HNL_TO_DOLLAR || '0.04'),
    }
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
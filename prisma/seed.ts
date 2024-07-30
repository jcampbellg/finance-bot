import xprisma from '../src/utils/xprisma'

const tereId = 2090053045
const jcId = 1116747732

async function main() {
  const tere = await xprisma.user.auth(tereId)
  await xprisma.user.update(tereId, { timezone: 'America/Tegucigalpa' })

  console.log(tere.id)
}

main()
  .then(async () => {
    await xprisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await xprisma.$disconnect()
    process.exit(1)
  })
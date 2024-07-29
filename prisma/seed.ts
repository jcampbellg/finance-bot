import xprisma from '../src/utils/xprisma'

const tereId = 2090053045
const jcId = 1116747732

async function main() {
  const tere = await xprisma.user.auth(tereId)
  await xprisma.user.update(tereId, { timezone: 'America/Tegucigalpa' })
  await xprisma.conversation.update(tere.conversation.id, {
    subject: 'start',
    subsubect: 'end'
  })

  const newBook = await xprisma.book.create(tere, { title: 'SPENDER JC libro' })

  // give editor permission to JC
  const role = await xprisma.role.create(tere, {
    role: 'SPENDER',
    bookId: newBook.id,
    toUserId: 'clz3m9yx20002qw55yg7odb3w'
  })

  console.log(tere.id, role)
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
import xprisma from '@utils/xprisma'
import EmojiConvertor from 'emoji-js'

const emoji = new EmojiConvertor()

emoji.img_set = 'google'

emoji.img_sets.google.path = 'src/assets/64/'

async function main() {
  const user = await xprisma.user.auth(1116747732)

  const category = await xprisma.category.findUniqueById(user, 'clzu96z60000o9agbwbnisn8v')
  if (!category) return

  const input = category.description

  var output1 = emoji.replace_unified(input)

  console.log(input)
  console.log(output1)
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
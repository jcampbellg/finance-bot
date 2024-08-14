import notFoundError from '@botMessage/errors/notFoundError'
import endBtn from '@buttons/endBtn'
import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { conversation, user, ctx, bot, chatId } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const categoryId = conversation.edit.accountId || ''

  const category = await xprisma.category.findUniqueById(user, categoryId)

  if (!category) {
    await notFoundError(params)
    return
  }

  await amountReply(params, async (amount) => {
    await xprisma.conversation.update(conversation.id, {
      subject: 'category_limit',
      subSubject: 'currency',
      edit: {
        ...conversation.edit,
        amount
      }
    })

    await bot.sendMessage(chatId, `¿Cual es la moneda de este monto?\n\n<i>Escribe la moneda en 3 letras.</i>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
  })
}
import endBtn from '@buttons/endBtn'
import currencyReply from '@conversation/utils/currencyReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step4(params: ConversationPropsWithBookSelected) {
  const { conversation, bot, chatId } = params

  await currencyReply(params, async (currency) => {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'amount',
      edit: {
        ...conversation.edit,
        currency
      }
    })

    bot.sendMessage(chatId, `Perfecto. Finalmente, ¿cuál es el monto de la transacción?`, {
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
  })

  return
}
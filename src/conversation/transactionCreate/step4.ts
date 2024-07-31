import endBtn from '@buttons/endBtn'
import currencyReply from '@conversation/utils/currencyReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step4(params: ConversationPropsWithBookSelected) {
  const { conversation, bot, chatId, query } = params

  await currencyReply(params, async (currency) => {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'amount',
      edit: {
        ...conversation.edit,
        currency
      }
    })

    const botText = `Perfecto. Finalmente, ¿cuál es el monto de la transacción?`

    if (query) {
      await bot.editMessageText(botText, {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [endBtn]
        }
      })
      return
    }

    bot.sendMessage(chatId, botText, {
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
  })

  return
}
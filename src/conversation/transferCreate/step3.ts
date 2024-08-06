import endBtn from '@buttons/endBtn'
import currencyReply from '@conversation/utils/currencyReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step3(params: ConversationPropsWithBookSelected) {
  const { conversation, bot, chatId, query } = params

  const key = conversation.subSubject === 'currency-a' ? 'currencyA' : 'currencyB'
  const sub = conversation.subSubject === 'currency-a' ? 'amount-a' : 'amount-b'

  await currencyReply(params, async (currency) => {
    await xprisma.conversation.update(conversation.id, {
      subSubject: sub,
      edit: {
        ...conversation.edit,
        [key]: currency
      }
    })

    const botText = `¿Cuál es el monto de la transferencia?`

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

    await bot.sendMessage(chatId, botText, {
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
  })

  return
}
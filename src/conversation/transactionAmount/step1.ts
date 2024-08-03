import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation, query, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_amount_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_amount',
    subSubject: 'amount',
    edit: {
      transactionId: transactionId
    }
  })

  await bot.editMessageText(`🧾 ¿Cuál es el monto de la transacción?`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
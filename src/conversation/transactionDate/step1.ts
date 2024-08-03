import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { bot, conversation, chatId, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_date_', '').replace('transaction_paid_date_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: query.data.startsWith('transaction_date_') ? 'transaction_date' : 'transaction_paid_date',
    subSubject: 'date',
    edit: {
      transactionId: transactionId
    }
  })

  await bot.editMessageText(`🧾 Ingresa la nueva fecha:\n\n<i>Usa este formato en numeros: e.g. 2024-08-05T13:05</i>.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
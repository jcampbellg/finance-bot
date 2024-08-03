import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { bot, conversation, chatId, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_rename_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_rename',
    subSubject: 'description',
    edit: {
      transactionId: transactionId
    }
  })

  await bot.editMessageText(`🧾 Proporciona una breve descripción de la transacción.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
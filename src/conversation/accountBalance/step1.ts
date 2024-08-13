import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation, query, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const accountId = query.data.replace('account_balance_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'account_balance',
    subSubject: 'balance',
    edit: {
      accountId
    }
  })

  await bot.editMessageText(`¿Cuál es el monto actual de la cuenta?`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
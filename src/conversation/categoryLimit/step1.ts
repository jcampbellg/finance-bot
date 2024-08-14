import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation, query, bot, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const categoryId = query.data.replace('category_limit_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'category_limit',
    subSubject: 'balance',
    edit: {
      categoryId
    }
  })

  await bot.editMessageText(`¿Cuál es el monto?`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
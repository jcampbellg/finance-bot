import endBtn from '@buttons/endBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationProps) {
  const { bot, conversation, chatId, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  const bookId = query.data.replace('book_rename_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'book_rename',
    subSubject: 'description',
    edit: {
      bookId: bookId
    }
  })

  await bot.editMessageText(`📚 Vamos a renombrar tu libro contable.\nPor favor, dime el nuevo nombre que te gustaría darle.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
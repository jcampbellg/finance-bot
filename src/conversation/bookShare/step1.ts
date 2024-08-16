import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationProps) {
  const { query, chatId, bot, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const bookId = query.data.replace('book_share_', '').replace('book_owner_', '')

  const isShare = query.data.startsWith('book_share_')

  await xprisma.conversation.update(conversation.id, {
    subject: isShare ? 'book_share' : 'book_owner',
    subSubject: 'userId',
    edit: {
      bookId
    }
  })

  const task = isShare ? 'compartir' : 'cambiar dueño'

  await bot.editMessageText(`Por favor, envíame el ID del usuario o grupo con el que deseas ${task} el libro.`, {
    chat_id: chatId,
    message_id: query.message.message_id
  })
}
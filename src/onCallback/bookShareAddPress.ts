import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export async function bookShareAddPress(params: ConversationProps, isOwner: boolean) {
  const { query, bot, conversation, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = isOwner ? query.data.replace('book_share_owner_', '') : query.data.replace('book_share_add_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: isOwner ? 'bookShareOwner' : 'bookShareAdd',
    subSubject: '',
    edit: {
      bookId
    }
  })

  await bot.editMessageText(`Por favor, pega el ID del usuario aquí.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}
import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import upsSend from '@onSend/upsSend'
import xprisma from '@utils/xprisma'

export async function bookRenamePress(params: ConversationProps) {
  const { query, bot, conversation, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_rename_', '')

  if (!bookId) {
    await upsSend(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'bookRename',
    subSubject: 'title',
    edit: {
      bookId: bookId
    }
  })

  await bot.editMessageText(`📚 Vamos a renombrar tu libro contable.\n\nPor favor, dime el nuevo nombre que te gustaría darle.'`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}
import upsError from '@botMessage/errors/upsError'
import menuMessage from '@botMessage/menuMessage'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationProps) {
  const { bot, conversation, user, query, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const bookId = conversation.edit.bookId || ''

  const success = await xprisma.book.delete(user, bookId)

  if (!success) {
    await upsError(params)
    return
  }

  await bot.answerCallbackQuery(query.id, {
    text: 'Libro eliminado',
    show_alert: true
  })

  await bot.deleteMessage(chatId, query.message.message_id)

  await menuMessage(params, true)
}
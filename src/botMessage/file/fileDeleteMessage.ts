import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function fileDeleteMessage(params: ConversationPropsWithBookSelected) {
  const { bot, query, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const fileId = query.data.replace('file_delete_', '')

  await xprisma.file.delete(fileId)

  await bot.answerCallbackQuery(query.id, {
    text: 'Archivo eliminado',
    show_alert: true
  })

  await bot.deleteMessage(chatId, query.message.message_id)
}
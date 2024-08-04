import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function fileDeleteMessage(params: ConversationPropsWithBookSelected) {
  const { bot, query, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const fileId = query.data.replace('file_delete_', '')

  await xprisma.file.delete(fileId)

  await bot.sendMessage(chatId, `Archivo eliminado`)
}
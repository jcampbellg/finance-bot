import notFoundError from '@botMessage/errors/notFoundError'
import upsError from '@botMessage/errors/upsError'
import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationProps) {
  const { bot, conversation, user, query, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const isCategory = conversation.subject === 'category_delete'
  const itemId = conversation.edit.transactionId || ''

  const itemToDelete = isCategory ? await xprisma.category.findUniqueById(user, itemId) : await xprisma.account.findUnique(user, itemId)

  if (!itemToDelete) {
    await notFoundError(params)
    return
  }

  const success = await xprisma[isCategory ? 'category' : 'account'].delete(user, itemId)

  if (!success) {
    await upsError(params)
    return
  }

  await bot.editMessageText('Ha sido eliminado.', {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}
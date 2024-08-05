import noTransactionError from '@botMessage/errors/noTransactionError'
import upsError from '@botMessage/errors/upsError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import endBtn from '@buttons/endBtn'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step3(params: ConversationPropsWithBookSelected) {
  const { query, ctx, chatId, bot, conversation, user } = params

  const transactionId = conversation.edit?.transactionId
  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  if (!!ctx) {
    // Category description
    await stringReply(params, async (description) => {
      const newCategory = await xprisma.category.create(user, description)

      if (!newCategory) {
        upsError(params)
        return
      }

      const success = await xprisma.transaction.update(user, transactionId, {
        categoryId: newCategory.id
      })

      if (!success) {
        upsError(params)
        return
      }

      await transactionViewMenuMessage(params, transactionId)
    })
    return
  }

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data === 'category_create') {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'category_create'
    })
    await bot.editMessageText(`🗂️ Vamos a crear una nueva categoría.\n¿Cómo te gustaría llamarla?`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [endBtn]
      }
    })
    return
  }

  if (query.data.startsWith('category_select_')) {
    const categoryId = query.data.replace('category_select_', '')

    const success = await xprisma.transaction.update(user, transactionId, {
      categoryId
    })

    if (!success) {
      upsError(params)
      return
    }

    await transactionViewMenuMessage(params, transactionId)
    return
  }
}
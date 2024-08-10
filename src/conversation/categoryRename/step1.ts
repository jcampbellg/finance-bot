import notFoundError from '@botMessage/errors/notFoundError'
import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { bot, conversation, chatId, query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const id = query.data.replace('category_rename_', '')

  const category = await xprisma.category.findUniqueById(user, id)

  if (!category) {
    await notFoundError(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'category_rename',
    subSubject: 'description',
    edit: {
      categoryId: id
    }
  })

  const type = category.type === 'INCOME' ? '🤑 Vamos a renombrar tu ingreso.' : category.type === 'PAYMENT' ? '💵 Vamos a renombrar tu pago fijo.' : '🗂️ Vamos a renombrar tu categoria.'

  await bot.editMessageText(`${type}\nPor favor, dime el nuevo nombre que te gustaría darle.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
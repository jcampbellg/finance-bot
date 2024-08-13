import notFoundError from '@botMessage/errors/notFoundError'
import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { bot, conversation, chatId, query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const isCategory = query.data.startsWith('category_rename_') || false
  const itemId = query.data.replace('category_rename_', '').replace('account_rename_', '')

  const item = isCategory ? await xprisma.category.findUniqueById(user, itemId) : await xprisma.account.findUnique(user, itemId)

  if (!item) {
    await notFoundError(params)
    return
  }

  const subject = query.data.startsWith('category_rename_') ? 'category_rename' : 'account_rename'

  await xprisma.conversation.update(conversation.id, {
    subject: subject,
    subSubject: 'description',
    edit: {
      [isCategory ? 'categoryId' : 'accountId']: itemId
    }
  })

  const type = !isCategory ? '🏦 Vamos a renombrar tu cuenta.' : (item.type === 'INCOME' ? '🤑 Vamos a renombrar tu ingreso.' : item.type === 'PAYMENT' ? '💵 Vamos a renombrar tu pago fijo.' : '🗂️ Vamos a renombrar tu categoria.')

  await bot.editMessageText(`${type}\nPor favor, dime el nuevo nombre que te gustaría darle.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}
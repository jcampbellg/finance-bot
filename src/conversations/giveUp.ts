import { ConversationProps } from '@customTypes/messageTypes'
import { onConversationEnd, yesAndNoButtons } from './mainMenu'
import xprisma from '@utils/xprisma'
import { onBooksBegin } from './books'

export async function onGiveUpBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('giveup_', '')
  const book = await xprisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.sendMessage(userId, 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕')
    await onConversationEnd(params)
    return
  }

  const [botText, botOptions] = yesAndNoButtons(`el acceso de ${book.title}`, `giveup_yes_${book.id}`, `book_${book.id}`)
  if (conversation.messageId === query.message.message_id) {
    try {
      await bot.editMessageText(botText, {
        chat_id: userId,
        message_id: conversation.messageId,
        ...botOptions
      })
      return
    } catch (error) {
      console.error(error)
    }
  }

  await bot.sendMessage(userId, botText, botOptions)
  return
}

export async function onGiveUpYes(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('giveup_yes_', '')
  const book = await xprisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.sendMessage(userId, 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕')
    await onConversationEnd(params)
    return
  }

  await bot.answerCallbackQuery(query.id, { text: 'Quitando libro... 📚' })
  const isOk = await xprisma.role.delete(user, book.id)

  if (!isOk) {
    await bot.sendMessage(userId, 'Parece que el libro que buscas no existe o eres el dueño. 😕')
    await onConversationEnd(params)
    return
  }

  await bot.answerCallbackQuery(query.id, { text: 'Ya no tienes acceso al libro. 📚' })
  await xprisma.conversation.update(conversation.id, {
    subject: 'books',
    subSubject: '',
    messageId: null
  })
  await onBooksBegin(params)
  return
}
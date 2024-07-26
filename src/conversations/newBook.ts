import { ConversationProps } from '@customTypes/messageTypes'
import prisma from '@utils/prisma'
import { endButton } from '@conversations/newConversation'
import { titleEval } from '@utils/isValid'
import { bookFormat } from '@conversations/book'

export async function onNewBookBegin(params: ConversationProps) {
  const { userId, bot, firstName, conversation } = params

  await prisma.conversation.updateSubject(params.conversation.id, 'new_book', 'title')

  if (conversation.messageId) {
    try {
      await bot.editMessageText(`Vamos a crear un nuevo libro contable. ¿Cómo te gustaría llamarlo? 📚`, {
        chat_id: userId,
        message_id: conversation.messageId,
        reply_markup: {
          inline_keyboard: endButton()
        }
      })
      return
    } catch (error) {
      console.error(error)
    }
  }

  await bot.sendMessage(userId, `¡Hola ${firstName}!\n\nVamos a crear un nuevo libro contable. ¿Cómo te gustaría llamarlo? 📚`, {
    reply_markup: {
      inline_keyboard: endButton()
    }
  })
  return
}

export async function onNewBookText(params: ConversationProps) {
  const { bot, userId, ctx, conversation, text, user } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subSubject === 'title') {
    const title = titleEval(text)

    if (title.isError) {
      await bot.sendMessage(userId, title.error, {
        reply_markup: {
          inline_keyboard: endButton()
        }
      })
      return
    }

    const newBook = await prisma.book.create(user, {
      title: title.value || ''
    })

    await prisma.conversation.updateSubject(conversation.id, 'book')

    const msg = await bookFormat(bot, user, newBook)
    const botMsg = await bot.sendMessage(userId, `¡Perfecto! Tu libro contable "${newBook.title}" ha sido creado.\n\n${msg[0]}`, msg[1])
    await prisma.conversation.update(conversation.id, { messageId: botMsg.message_id })
  }
}
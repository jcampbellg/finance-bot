import { MessageFromPrivate, QueryFromPrivate } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import { showContinents } from './waitingForCommand'

type TextProps = {
  bot: TelegramBot
  msg: MessageFromPrivate
}

export async function booksOnStart({ bot, msg }: TextProps) {
  const userId = msg.chat.id

  const books = await prisma.book.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          share: {
            some: {
              userId: userId
            }
          }
        }
      ]
    },
    include: {
      bookSelected: true
    }
  })

  await prisma.conversation.update({
    data: {
      state: 'books',
      data: {}
    },
    where: {
      chatId: userId
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o crea un libro contable.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Crear Nuevo Libro', callback_data: 'create' }],
        ...books.map(book => ([{
          text: `${book.bookSelected.length > 0 ? '⦿ ' : ''}${book.description}`,
          callback_data: `${book.id}`
        }]))
      ]
    }
  })
  return
}

export async function bookOnText({ bot, msg }: TextProps) {
  const userId = msg.chat.id
  const text = msg.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const data: any = conversation?.data || {}

  if (data.action === 'create') {
    if (!data.description) {
      await prisma.conversation.update({
        data: {
          data: {
            ...data,
            description: text
          }
        },
        where: {
          chatId: userId
        }
      })

      const user = await prisma.user.findUnique({
        where: {
          id: userId
        }
      })

      if (!user) {
        await prisma.conversation.delete({
          where: {
            chatId: userId
          }
        })
        await bot.sendMessage(userId, 'Ocurrió un error al intentar crear el libro contable.')
        return
      }

      await bot.sendMessage(userId, `Selecciona una zona horaria para <b>${text}</b>:`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `Elegir ${user.timezone}`, callback_data: user.timezone }],
            [{ text: 'Elegir otra zona horaria', callback_data: 'timezone' }]
          ]
        }
      })
      return
    }
  }
}

type CallbackProps = {
  bot: TelegramBot
  query: QueryFromPrivate
}

export async function booksOnCallbackQuery({ bot, query }: CallbackProps) {
  const userId = query.from.id
  const btnPress = query.data

  if (btnPress === 'create') {
    await prisma.conversation.update({
      data: {
        state: 'books',
        data: {
          action: 'create'
        }
      },
      where: {
        chatId: userId
      }
    })

    await bot.sendMessage(userId, 'Ingresa la descripción para el nuevo libro contable:')
    return
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const data: any = conversation?.data || {}

  if (data.action === 'create') {
    if (data.description && !data.timezone) {
      if (btnPress === 'timezone') {
        await showContinents({ bot, query }, `Selecciona una zona horaria para <b>${data.description}</b>:`)
        return
      }
    }
  }
}
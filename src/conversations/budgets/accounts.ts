import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import z from 'zod'

export async function accountsOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const bookSelected = await prisma.bookSelected.findFirst({
    where: {
      book: {
        ownerId: userId
      },
      chatId: userId
    },
    include: {
      book: true
    }
  })

  if (!bookSelected) {
    await bot.sendMessage(userId, '¡Primero necesitas seleccionar un libro contable!')
    return
  }

  const book = bookSelected.book

  const accounts = await prisma.account.findMany({
    where: {
      bookId: book.id
    }
  })

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'accounts',
      data: {}
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o agrega una cuenta a <b>${book.title}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Agregar cuenta', callback_data: 'add' }],
        ...accounts.map(a => ([{
          text: `${a.description}`,
          callback_data: `${a.id}`
        }]))
      ]
    }
  })
  return
}

export async function accountsOnText({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number
  const text = msg?.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  if (!conversation) return

  const bookSelected = await prisma.bookSelected.findFirst({
    where: {
      book: {
        ownerId: userId
      },
      chatId: userId
    },
    include: {
      book: true
    }
  })

  if (!bookSelected) {
    await bot.sendMessage(userId, '¡Primero necesitas seleccionar un libro contable!')
    return
  }

  const book = bookSelected.book

  const conversationData: any = conversation.data || {}

  if (conversationData.action === 'add') {
    const isValid = z.string().min(3).max(50).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
      return
    }

    const newAccount = await prisma.account.create({
      data: {
        description: text,
        bookId: book.id
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'accounts',
        data: {
          action: 'edit',
          accountId: newAccount.id
        }
      }
    })

    await bot.sendMessage(userId, `Cuenta <b>${text}</b> agregada.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: accountButtons()
      }
    })
  }
}

export async function accountsOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.message.chat.id

  const btnPress = query.data

  if (btnPress === 'back') {
    await accountsOnStart({ bot, query })
    return
  }

  if (btnPress === 'add') {
    await prisma.conversation.upsert({
      where: {
        chatId: userId
      },
      update: {
        state: 'accounts',
        data: {
          action: 'add'
        }
      },
      create: {
        chatId: userId,
        state: 'accounts',
        data: {
          action: 'add'
        }
      }
    })

    await bot.sendMessage(userId, 'Escribe la descripción de la cuenta a agregar.')
    return
  }
}

export function accountButtons(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Regresar', callback_data: 'back' }]
  ]
}
import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import z from 'zod'
import { accountsButtons } from './budget/accounts'

export async function expenseOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      books: {
        where: {
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      }
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return
  }

  const book = user.books.find(book => book.id === user.bookSelectedId)

  if (!book) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas seleccionar un libro contable. Usa /libro.</i>', { parse_mode: 'HTML' })
    return
  }

  const accountsCount = await prisma.account.count({
    where: {
      bookId: book.id
    }
  })

  if (accountsCount === 0) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas agregar una cuenta. Usa /presupuesto.</i>', { parse_mode: 'HTML' })
    return
  }

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'newExpense',
      data: {
        bookId: book.id
      }
    }
  })

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'newExpense',
      data: {}
    }
  })

  await bot.sendMessage(userId, '¡Vamos a registrar un gasto! 📝\nDescripción del gasto:')
  return
}

export async function expenseOnText({ bot, msg }: MsgProps) {
  const userId = msg.chat.id
  const text = msg?.text?.trim() || ''

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      books: {
        where: {
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      }
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return
  }

  const book = user.books.find(book => book.id === user.bookSelectedId)

  if (!book) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas seleccionar un libro contable. Usa /libro.</i>', { parse_mode: 'HTML' })
    return
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (!conversationData.description) {
    const isValid = z.string().min(3).max(50).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          ...conversationData,
          description: msg.text
        }
      }
    })

    const accounts = await prisma.account.findMany({
      where: {
        bookId: book.id
      },
      orderBy: {
        description: 'asc'
      }
    })

    await bot.sendMessage(userId, '¿De que cuenta salió el gasto?', {
      reply_markup: {
        inline_keyboard: accountsButtons(accounts)
      }
    })
    return
  }
}

export async function expenseOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.message.chat.id
  const btnPress = query.data

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  if (conversationData.description && !conversationData.accountId) {
    const accountId = parseInt(btnPress)
    if (Number.isNaN(accountId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'newExpense',
        data: {
          ...conversationData,
          accountId
        }
      }
    })

    await bot.sendMessage(userId, '¿Es una categoría o un pago fijo?', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Categoría', callback_data: 'category' },
            { text: 'Pago fijo', callback_data: 'payment' }
          ]
        ]
      }
    })
    return
  }

  if (btnPress === 'category' || btnPress === 'payment') {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'newExpense',
        data: {
          ...conversationData,
          type: btnPress
        }
      }
    })

    await bot.sendMessage(userId, 'Monto del gasto:')
    return
  }
}
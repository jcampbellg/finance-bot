import { MsgAndQueryProps, MsgProps, QueryFromPrivate, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import z from 'zod'
import { accountsButtons } from './budget/accounts'
import TelegramBot from 'node-telegram-bot-api'
import numeral from 'numeral'
import { waitingForCommandOnStart } from './waitingForCommand'

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

  if (conversationData.action === 'edit') {
    const expenseToEdit = await prisma.expense.findUnique({
      where: {
        id: conversationData.expenseId || 0
      },
      include: {
        account: true,
        amount: true,
        category: true,
        payment: true,
        createdBy: true
      }
    })

    if (!expenseToEdit) {
      await bot.sendMessage(userId, 'No se encontró el gasto.')
      await waitingForCommandOnStart({
        bot,
        query: query as QueryFromPrivate
      })
      return
    }

    const category = expenseToEdit.category ? `\nCategoria: ${expenseToEdit.category.description}` : '\nSin categoría'
    const payment = expenseToEdit.payment ? `\nPago: ${expenseToEdit.payment.description}` : ''

    await bot.sendMessage(userId, `<b>${expenseToEdit.description}</b>\nCuenta: ${expenseToEdit.account.description}\nMonto: ${numeral(expenseToEdit.amount.amount).format('0,0.00')} ${expenseToEdit.amount.currency}${category}${payment}\n\n¿Qué deseas hacer con este gasto?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expenseButtons()
      }
    })
    return
  }
}

export function expenseButtons(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Adjuntar', callback_data: 'file' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Categorizar', callback_data: 'category' }, { text: 'Asignar a Pago', callback_data: 'payment' }],
    [{ text: 'Regresar', callback_data: 'back' }]
  ]
}
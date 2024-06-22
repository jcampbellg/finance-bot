import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import z from 'zod'
import { accountsButtons } from './budget/accounts'
import numeral from 'numeral'
import { expenseButtons } from './expense'
import auth from '@utils/auth'

export async function newExpenseOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

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

  await bot.sendMessage(userId, '¡Vamos a registrar un gasto! 📝\n\nDescripción del gasto:')
  return
}

export async function newExpenseOnText({ bot, msg }: MsgProps) {
  const { user, book, userId } = await auth({ bot, msg })
  if (!user) return
  if (!book) return

  const text = msg?.text?.trim() || ''

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

  if (conversationData.description && conversationData.accountId) {
    if (!conversationData.amount) {
      const amount = parseFloat(text)
      if (Number.isNaN(amount) || amount <= 0) {
        await bot.sendMessage(userId, 'La respuesta debe ser un número mayor a 0.')
        return
      }

      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          data: {
            ...conversationData,
            amount
          }
        }
      })

      await bot.sendMessage(userId, `Su moneda, en 3 letras:`, {
        parse_mode: 'HTML',
      })
      return
    }

    const isValid = z.string().regex(/[a-zA-Z]+/).length(3).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser de 3 letras.')
      return
    }

    const currency = text.toUpperCase()

    const amountCurrency = await prisma.amountCurrency.create({
      data: {
        amount: conversationData.amount,
        currency,
      }
    })

    const newExpense = await prisma.expense.create({
      data: {
        description: conversationData.description,
        accountId: conversationData.accountId,
        amountId: amountCurrency.id,
        createdById: userId,
        bookId: book.id
      },
      include: {
        amount: true,
        account: true,
        createdBy: true
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'expense',
        data: {
          action: 'edit',
          expenseId: newExpense.id
        }
      }
    })

    await bot.sendMessage(userId, `Gasto registrado:\n\nDescripción: <b>${newExpense.description}</b>\nCuenta: ${newExpense.account.description}\nMonto: ${numeral(newExpense.amount.amount).format('0,0.00')} ${newExpense.amount.currency}\n\n¿Qué deseas hacer con este gasto?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expenseButtons()
      }
    })
  }
}

export async function newExpenseOnCallbackQuery({ bot, query }: QueryProps) {
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

    await bot.sendMessage(userId, 'Monto del gasto:')
    return
  }
}
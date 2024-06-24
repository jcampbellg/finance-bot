import { MsgAndQueryProps, MsgProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import { waitingForCommandOnStart } from './waitingForCommand'
import numeral from 'numeral'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { ExpenseWithAmountAccountAndCategory } from '@customTypes/prismaTypes'
import { expenseButtons, expenseText } from './expense'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export async function searchExpenseOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'searchExpense',
      data: {}
    }
  })

  await bot.sendMessage(userId, `¡Vamos a buscar una transacción en <b>${book.title}</b>! 📚\nEscribe tu parametro de busqueda:`, {
    parse_mode: 'HTML'
  })
}

export async function searchExpenseOnText({ bot, msg }: MsgProps) {
  const { user, book, userId } = await auth({ msg, bot })
  if (!user) return
  if (!book) return

  const text = msg.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (!conversationData.search) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          search: text
        }
      }
    })

    const expenses = await prisma.expense.findMany({
      where: {
        bookId: book.id,
        OR: [
          {
            category: {
              description: {
                contains: text,
                mode: 'insensitive'
              },
            }
          },
          {
            description: {
              contains: text,
              mode: 'insensitive'
            },
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        category: true,
        account: true,
        amount: true
      },
      take: 30
    })

    if (expenses.length === 0) {
      await bot.sendMessage(userId, `No se encontraron transacciones con el parametro de busqueda: <b>${text}</b>`, {
        parse_mode: 'HTML'
      })
      waitingForCommandOnStart({ bot, msg })
      return
    }

    // Group expenses by rows of 5
    const expensesBtn = expenses.reduce((acc, exp, i) => {
      const index = Math.floor(i / 2)
      acc[index] = [...(acc[index] || []), exp]
      return acc
    }, [] as ExpenseWithAmountAccountAndCategory[][])

    const listText = expenses.map((exp, i) => {
      return `<i>${dayjs(exp.createdAt).tz(user.timezone).format('LL hh:mma')}</i>\n${i + 1}. <b>${exp.description}</b>\n${exp.category?.description || 'Sin Categoria'}\n${numeral(exp.amount.amount).format('0,0.00')} ${exp.amount.currency}\n<i>${exp.account.description}</i>`
    }).join('\n\n')

    await bot.sendMessage(userId, `${listText}\n\nVer y editar:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expensesBtn.map((group) => {
          return group.map((e, i) => {
            return { text: `${i + 1}`, callback_data: `${e.id}` }
          })
        })
      }
    })
  }
}

export async function searchExpenseOnCallbackQuery({ bot, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ query, bot } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  if (!query?.data) return
  const expenseId = parseInt(query.data)

  const expense = await prisma.expense.findUnique({
    where: {
      id: expenseId
    },
    include: {
      amount: true,
      category: true,
      account: true,
      book: true,
      files: true,
      createdBy: true
    }
  })

  if (!expense) {
    await bot.sendMessage(userId, 'No se encontro la transacción.')
    await waitingForCommandOnStart({ bot, query })
    return
  }

  await bot.sendMessage(userId, expenseText(expense, user), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: expenseButtons()
    }
  })
}
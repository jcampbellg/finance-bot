import { budgetOnStart } from '@conversations/budget'
import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import { Income } from '@prisma/client'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import z from 'zod'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { IncomeWithSalary } from '@customTypes/prismaTypes'
import numeral from 'numeral'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

const maxIncomes = 10

export async function incomesOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)

  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'incomes',
      data: {}
    }
  })

  const incomes = await prisma.income.findMany({
    where: {
      bookId: book.id
    },
    orderBy: {
      description: 'asc'
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o agrega un ingreso a <b>${book.title}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        incomes.length < maxIncomes ? [{ text: 'Agregar', callback_data: 'add' }] : [],
        ...incomesButtons(incomes),
        [{ text: 'Regresar', callback_data: 'back' }]
      ]
    }
  })
  return
}

export async function incomesOnText({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)

  if (!user) return
  if (!book) return

  const text = msg?.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (conversationData.action === 'add') {
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
        state: 'incomes',
        data: {
          action: 'add',
          description: text
        }
      }
    })

    const newIncome = await prisma.income.create({
      data: {
        description: text,
        bookId: book.id
      },
      include: {
        salary: {
          include: {
            amount: true
          }
        }
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'incomes',
        data: {
          action: 'edit',
          incomeId: newIncome.id
        }
      }
    })

    await sendIncome(bot, userId, newIncome)
    return
  }

  if (conversationData.action === 'edit') {
    const incomeToEdit = await prisma.income.findUnique({
      where: {
        id: conversationData.incomeId || 0
      }
    })

    if (!incomeToEdit) {
      await bot.sendMessage(userId, 'El ingreso seleccionado ya no existe.')
      await incomesOnStart({ bot, query, msg } as MsgAndQueryProps)
      return
    }

    if (conversationData.property === 'description') {
      const isValid = z.string().min(3).max(50).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
        return
      }

      await prisma.income.update({
        where: {
          id: incomeToEdit.id
        },
        data: {
          description: text
        }
      })

      await bot.sendMessage(userId, `Ingreso actualizado:\n<b>${text}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: incomeButtons()
        }
      })
    }

    if (conversationData.property === 'salary') {
      if (conversationData.salary === undefined) {
        const salary = parseFloat(text)
        if (Number.isNaN(salary) || salary < 0) {
          await bot.sendMessage(userId, 'La respuesta debe ser un número mayor o igual a 0.')
          return
        }

        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'incomes',
            data: {
              action: 'edit',
              incomeId: incomeToEdit.id,
              property: 'salary',
              salary: salary
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

      const salaryAmount = await prisma.amountCurrency.create({
        data: {
          amount: conversationData.salary,
          currency: currency
        }
      })

      const newSalary = await prisma.salary.create({
        data: {
          incomeId: incomeToEdit.id,
          amountId: salaryAmount.id,
          validFrom: dayjs().tz(user.timezone).startOf('month').format()
        },
        include: {
          amount: true
        }
      })

      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'incomes',
          data: {
            action: 'edit',
            incomeId: incomeToEdit.id
          }
        }
      })

      await sendIncome(bot, userId, { ...incomeToEdit, salary: [newSalary] })
      return
    }
  }
}

export async function incomesOnCallbackQuery({ bot, query }: QueryProps) {
  const { userId, user, book } = await auth({ query, bot } as QueryProps)
  if (!user) return
  if (!book) return

  const btnPress = query.data

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  if (btnPress === 'back') {
    if (conversationData.action === 'edit') {
      await incomesOnStart({ bot, query })
      return
    }

    await budgetOnStart({ bot, query })
    return
  }

  if (btnPress === 'add') {
    const incomesCount = await prisma.income.count({
      where: {
        bookId: book.id
      }
    })

    if (incomesCount >= maxIncomes) {
      await bot.sendMessage(userId, `No puedes agregar más de ${maxIncomes} ingresos.`)
      await incomesOnStart({ bot, query })
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'incomes',
        data: {
          action: 'add'
        }
      }
    })

    await bot.sendMessage(userId, 'Escribe la descripción de la cuenta a agregar.')
    return
  }

  if (!conversationData.action) {
    // btn press is a income id
    const incomeId = parseInt(btnPress)
    if (Number.isNaN(incomeId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'incomes',
        data: {
          action: 'edit',
          incomeId: incomeId
        }
      }
    })

    const income = await prisma.income.findUnique({
      where: {
        id: incomeId,
      },
      include: {
        salary: {
          include: {
            amount: true
          }
        }
      }
    })

    if (!income) {
      await bot.sendMessage(userId, 'El ingreso seleccionado ya no existe.')
      await incomesOnStart({ bot, query })
      return
    }

    await sendIncome(bot, userId, income)
    return
  }

  if (conversationData.action === 'edit') {
    const incomeToEdit = await prisma.income.findUnique({
      where: {
        id: conversationData.incomeId || 0
      }
    })

    if (!incomeToEdit) {
      await bot.sendMessage(userId, 'El ingreso seleccionado ya no existe.')
      await incomesOnStart({ bot, query })
      return
    }

    if (btnPress === 'delete') {
      await prisma.income.delete({
        where: {
          id: incomeToEdit.id
        }
      })

      await bot.sendMessage(userId, `Ingreso eliminado:\n<b>${incomeToEdit.description}</b>`, {
        parse_mode: 'HTML'
      })
      await incomesOnStart({ bot, query })
      return
    }

    if (btnPress === 'description') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'incomes',
          data: {
            action: 'edit',
            incomeId: incomeToEdit.id,
            property: 'description'
          }
        }
      })

      await bot.sendMessage(userId, 'Escribe la nueva descripción de la cuenta:')
      return
    }

    if (btnPress === 'salary') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'incomes',
          data: {
            action: 'edit',
            incomeId: incomeToEdit.id,
            property: 'salary'
          }
        }
      })

      await bot.sendMessage(userId, `Escribe el nuevo salario para\n<b>${incomeToEdit.description}</b>:`, {
        parse_mode: 'HTML'
      })
      return
    }
  }
}

export function incomeButtons(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }, { text: 'Monto', callback_data: 'salary' }],
    [{ text: 'Regresar', callback_data: 'back' }]
  ]
}

export function incomesButtons(incomes: Income[]): TelegramBot.InlineKeyboardButton[][] {
  const incomesGroups = incomes.reduce((acc, curr, i) => {
    if (i % 3 === 0) acc.push([curr])
    else acc[acc.length - 1].push(curr)
    return acc
  }, [] as Income[][])

  return incomesGroups.map(group => {
    return group.map(acc => ({
      text: `${acc.description}`,
      callback_data: `${acc.id}`
    }))
  })
}

export async function sendIncome(bot: TelegramBot, chatId: number, income: IncomeWithSalary) {
  await bot.sendMessage(chatId, `<b>${income.description}</b>${income.salary.length > 0 ? `\n\nSalario: ${numeral(income.salary[0].amount.amount).format('0,0.00')} ${income.salary[0].amount.currency}` : ''}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: incomeButtons()
    }
  })
}
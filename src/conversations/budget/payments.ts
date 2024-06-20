import { budgetOnStart } from '@conversations/budget'
import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import z from 'zod'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import { LimitsWithAmount } from '@customTypes/prismaTypes'
import { Payment } from '@prisma/client'

dayjs.extend(utc)
dayjs.extend(timezone)

const maxPayments = 50

export async function paymentsOnStart({ bot, msg, query }: MsgAndQueryProps) {
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

  const payments = await prisma.payment.findMany({
    where: {
      bookId: book.id,
      book: {
        OR: [
          {
            ownerId: userId
          },
          {
            shares: {
              some: {
                shareWithUserId: userId
              }
            }
          }
        ]
      }
    },
    orderBy: {
      description: 'asc'
    }
  })

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'payments',
      data: {}
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o agrega pagos a <b>${book.title}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        payments.length < maxPayments ? [{ text: 'Agregar', callback_data: 'add' }] : [],
        ...paymentsButtons(payments),
        [{ text: 'Regresar', callback_data: 'back' }]
      ]
    }
  })
  return
}

export async function paymentsOnText({ bot, msg }: MsgProps) {
  const userId = msg?.chat.id
  const text = msg?.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

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

  if (conversationData.action === 'add') {
    if (conversationData.description === undefined) {
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
          state: 'payments',
          data: {
            action: 'add',
            description: text
          }
        }
      })

      await bot.sendMessage(userId, `Escribe el monto o limite de pago para <b>${text}</b>:`, {
        parse_mode: 'HTML'
      })
      return
    }

    if (conversationData.amount === undefined) {
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
          state: 'payments',
          data: {
            action: 'add',
            description: conversationData.description,
            amount: amount
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

    const amount = await prisma.amountCurrency.create({
      data: {
        amount: conversationData.amount,
        currency: currency
      }
    })

    const newPayment = await prisma.payment.create({
      data: {
        description: conversationData.description,
        bookId: book.id,
        amountId: amount.id
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'payments',
        data: {
          action: 'edit',
          paymentId: newPayment.id
        }
      }
    })

    await bot.sendMessage(userId, `Pago <b>${newPayment.description}</b> agregada con monto de ${numeral(amount.amount).format('0,0.00')} ${amount.currency}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: paymentButtons()
      }
    })
  }

  if (conversationData.action === 'edit') {
    const paymentToEdit = await prisma.payment.findUnique({
      where: {
        id: conversationData.paymentId || 0
      },
      include: {
        amount: true
      }
    })

    if (!paymentToEdit) {
      await bot.sendMessage(userId, 'El pago seleccionado ya no existe.')
      await paymentsOnStart({ bot, msg })
      return
    }

    if (conversationData.property === 'description') {
      const isValid = z.string().min(3).max(50).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
        return
      }

      const payment = await prisma.payment.findUnique({
        where: {
          id: conversationData.paymentId || 0
        }
      })

      if (!payment) {
        await bot.sendMessage(userId, 'El pago seleccionado ya no existe.')
        // @ts-ignore
        await paymentsOnStart({ bot, query, msg })
        return
      }

      await prisma.payment.update({
        where: {
          id: payment.id
        },
        data: {
          description: text
        }
      })

      await bot.sendMessage(userId, `Pago actualizado: <b>${text}</b>\nMonto: ${numeral(paymentToEdit.amount.amount).format('0,0.00')} ${paymentToEdit.amount.currency}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: paymentButtons()
        }
      })
    }

    if (conversationData.property === 'amount') {
      if (conversationData.amount === undefined) {
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
            state: 'payments',
            data: {
              action: 'edit',
              paymentId: paymentToEdit.id,
              property: 'amount',
              amount: amount
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

      await prisma.amountCurrency.update({
        where: {
          id: paymentToEdit.amountId
        },
        data: {
          amount: conversationData.amount,
          currency: currency
        }
      })

      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'payments',
          data: {
            action: 'edit',
            paymentId: paymentToEdit.id
          }
        }
      })

      await bot.sendMessage(userId, `<b>${paymentToEdit.description}</b>\nMonto Actualizado: ${numeral(conversationData.amount).format('0,0.00')} ${currency}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: paymentButtons()
        }
      })
      return
    }
  }
}

export async function paymentsOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.message.chat.id
  const btnPress = query.data

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  if (btnPress === 'back') {
    if (conversationData.action === 'edit') {
      await paymentsOnStart({ bot, query })
      return
    }

    await budgetOnStart({ bot, query })
    return
  }

  if (btnPress === 'add') {
    const paymentsCount = await prisma.payment.count({
      where: {
        bookId: conversationData.bookId
      }
    })

    if (paymentsCount >= maxPayments) {
      await bot.sendMessage(userId, `No puedes agregar más de ${maxPayments} pagos.`)
      await paymentsOnStart({ bot, query })
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'payments',
        data: {
          action: 'add'
        }
      }
    })

    await bot.sendMessage(userId, 'Escribe la descripción del pago a agregar.')
    return
  }

  if (!conversationData.action) {
    // btn press is a paymentId
    const paymentId = parseInt(btnPress)
    if (Number.isNaN(paymentId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'payments',
        data: {
          action: 'edit',
          paymentId: paymentId
        }
      }
    })

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        amount: true
      }
    })

    if (!payment) {
      await bot.sendMessage(userId, 'El pago seleccionado ya no existe.')
      await paymentsOnStart({ bot, query })
      return
    }

    await bot.sendMessage(userId, `Editar <b>${payment.description}</b>\nMonto: ${numeral(payment.amount.amount).format('0,0.00')} ${payment.amount.currency}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: paymentButtons()
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    const paymentToEdit = await prisma.payment.findUnique({
      where: {
        id: conversationData.paymentId || 0
      }
    })

    if (!paymentToEdit) {
      await bot.sendMessage(userId, 'El pago seleccionado ya no existe.')
      await paymentsOnStart({ bot, query })
      return
    }

    if (btnPress === 'delete') {
      await prisma.expense.updateMany({
        where: {
          paymentId: paymentToEdit.id
        },
        data: {
          paymentId: null
        }
      })

      await prisma.payment.delete({
        where: {
          id: paymentToEdit.id
        }
      })

      await bot.sendMessage(userId, `Pago eliminado: <b>${paymentToEdit.description}</b>`, {
        parse_mode: 'HTML'
      })
      await paymentsOnStart({ bot, query })
      return
    }

    if (btnPress === 'description') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'payments',
          data: {
            action: 'edit',
            paymentId: paymentToEdit.id,
            property: 'description'
          }
        }
      })

      await bot.sendMessage(userId, 'Escribe la nueva descripción del pago:')
      return
    }

    if (btnPress === 'amount') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'payments',
          data: {
            action: 'edit',
            paymentId: paymentToEdit.id,
            property: 'amount'
          }
        }
      })

      await bot.sendMessage(userId, `Escribe el nuevo monto para\n<b>${paymentToEdit.description}</b>:`, {
        parse_mode: 'HTML'
      })
      return
    }
  }
}

export function paymentButtons(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Cambiar Monto', callback_data: 'amount' }],
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Regresar', callback_data: 'back' }]
  ]
}

export function paymentsButtons(payments: Payment[]): TelegramBot.InlineKeyboardButton[][] {
  const paymentsGroups = payments.reduce((acc, curr, i) => {
    if (i % 3 === 0) acc.push([curr])
    else acc[acc.length - 1].push(curr)
    return acc
  }, [] as Payment[][])

  return paymentsGroups.map(group => {
    return group.map(pay => ({
      text: `${pay.description}`,
      callback_data: `${pay.id}`
    }))
  })
}

export function limitsListText(limits: LimitsWithAmount[]) {
  const currencyInLimits = [... new Set(limits.map(l => l.amount.currency))]

  const lastLimits = currencyInLimits.map(currency => {
    const limit = limits.find(l => l.amount.currency === currency)
    return limit
  }).filter(l => l && l?.amount.amount > 0)

  if (lastLimits.length === 0) return ''

  return `\n\nLimites:\n` + lastLimits.map(l => {
    return `${numeral(l?.amount.amount || 0).format('0,0.00')} ${l?.amount.currency}`
  }).join('\n')
}
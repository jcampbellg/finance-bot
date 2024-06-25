import { MsgAndQueryProps, MsgProps, QueryFromPrivate, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import z from 'zod'
import { accountsButtons } from '@conversations/accounts'
import TelegramBot from 'node-telegram-bot-api'
import numeral from 'numeral'
import { waitingForCommandOnStart } from '@conversations/waitingForCommand'
import { ExpenseWithAll } from '@customTypes/prismaTypes'
import { categoriesButtons } from '@conversations/categories'
import { FileType, User } from '@prisma/client'
import auth from '@utils/auth'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export async function expenseOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
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
}

export async function expenseOnText({ bot, msg }: MsgProps) {
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

  if (conversationData.action === 'edit') {
    let expenseToEdit = await prisma.expense.findUnique({
      where: {
        id: conversationData.expenseId || 0
      },
      include: {
        account: true,
        amount: true,
        category: true,
        createdBy: true,
        files: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!expenseToEdit) {
      await bot.sendMessage(userId, 'No se encontró el gasto.')
      await waitingForCommandOnStart({ bot, msg })
      return
    }

    if (conversationData.property === 'description') {
      const isValid = z.string().min(3).max(50).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
        return
      }

      await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          description: text
        }
      })
      expenseToEdit.description = text

      const fileToSend = expenseFile(expenseToEdit)
      if (fileToSend) {
        await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
        await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
          caption: expenseText(expenseToEdit, user),
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: expenseButtons()
          }
        })
        return
      }

      await bot.sendMessage(userId, expenseText(expenseToEdit, user), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons()
        }
      })
      return
    }

    if (conversationData.property === 'amount') {
      if (conversationData.amount === undefined) {
        const amount = parseFloat(text)
        if (Number.isNaN(amount) || amount < 0) {
          await bot.sendMessage(userId, 'La respuesta debe ser un número mayor a 0.')
          return
        }

        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'expense',
            data: {
              expenseId: expenseToEdit.id,
              action: 'edit',
              property: 'amount',
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

      const updateExpense = await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          amount: {
            update: {
              amount: conversationData.amount,
              currency
            }
          }
        },
        select: {
          amount: true
        }
      })

      expenseToEdit.amount = updateExpense.amount

      const fileToSend = expenseFile(expenseToEdit)
      if (fileToSend) {
        await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
        await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
          caption: expenseText(expenseToEdit, user),
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: expenseButtons()
          }
        })
        return
      }

      await bot.sendMessage(userId, expenseText(expenseToEdit, user), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons()
        }
      })
      return
    }

    if (conversationData.property === 'file') {
      if (!msg.photo && !msg.document) {
        await bot.sendMessage(userId, 'Debes enviar un archivo.')
        return
      }

      const fileType: FileType = !!msg.photo ? 'photo' : 'document'

      const photoLen = msg.photo?.length || 0
      // @ts-ignore
      const fileId = fileType === 'photo' ? msg.photo[photoLen - 1].file_id : msg.document?.file_id

      if (!fileId) {
        await bot.sendMessage(msg.chat.id, 'No se encontró el archivo.\nIntenta de nuevo.')
        return
      }

      await bot.sendMessage(userId, 'Procesando archivo recibido...')

      const file = await prisma.files.create({
        data: {
          fileId,
          fileType,
          expenseId: expenseToEdit.id,
          validFrom: dayjs().tz(user.timezone).startOf('month').format()
        }
      })

      expenseToEdit.files.unshift(file)

      const fileToSend = expenseFile(expenseToEdit)
      if (fileToSend) {
        await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
        await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
          caption: expenseText(expenseToEdit, user),
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: expenseButtons()
          }
        })
        return
      }

      await bot.sendMessage(userId, expenseText(expenseToEdit, user), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons()
        }
      })
      return
    }
  }
}

export async function expenseOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book, userId } = await auth({ bot, query })
  if (!user) return
  if (!book) return

  const btnPress = query.data

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const conversationData: any = conversation?.data || {}

  if (!conversationData.action) {
    const expenseId = parseInt(btnPress)
    if (Number.isNaN(expenseId)) {
      await bot.sendMessage(userId, 'No se encontró el gasto.')
      await waitingForCommandOnStart({
        bot,
        query: query as QueryFromPrivate
      })
      return
    }

    const expenseToEdit = await prisma.expense.findUnique({
      where: {
        id: expenseId
      },
      include: {
        account: true,
        amount: true,
        category: true,
        createdBy: true,
        files: true
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

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'expense',
        data: {
          action: 'edit',
          expenseId: expenseToEdit.id
        }
      }
    })

    const fileToSend = expenseFile(expenseToEdit)
    if (fileToSend) {
      await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
      await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
        caption: expenseText(expenseToEdit, user),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons()
        }
      })
      return
    }
    await bot.sendMessage(userId, expenseText(expenseToEdit, user), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expenseButtons()
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    let expenseToEdit = await prisma.expense.findUnique({
      where: {
        id: conversationData.expenseId || 0
      },
      include: {
        account: true,
        amount: true,
        category: true,
        createdBy: true,
        files: {
          orderBy: {
            createdAt: 'asc'
          }
        }
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

    if (btnPress === 'description') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            expenseId: expenseToEdit.id,
            action: 'edit',
            property: 'description'
          }
        }
      })

      await bot.sendMessage(userId, 'Ingresa la nueva descripción:')
      return
    }

    if (btnPress === 'amount') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            expenseId: expenseToEdit.id,
            action: 'edit',
            property: 'amount'
          }
        }
      })

      await bot.sendMessage(userId, 'Ingresa el nuevo monto:')
      return
    }

    if (btnPress === 'delete') {
      await prisma.expense.delete({
        where: {
          id: expenseToEdit.id
        }
      })

      await bot.sendMessage(userId, 'Gasto eliminado.')
      await waitingForCommandOnStart({
        bot,
        query: query as QueryFromPrivate
      })
      return
    }

    if (btnPress === 'account') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            expenseId: expenseToEdit.id,
            action: 'edit',
            property: 'account'
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

      await bot.sendMessage(userId, 'Selecciona la nueva cuenta:', {
        reply_markup: {
          inline_keyboard: accountsButtons(accounts)
        }
      })
      return
    }

    if (btnPress === 'category') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            expenseId: expenseToEdit.id,
            action: 'edit',
            property: 'category'
          }
        }
      })

      const categories = await prisma.category.findMany({
        where: {
          bookId: book.id
        },
        orderBy: {
          description: 'asc'
        }
      })

      await bot.sendMessage(userId, 'Selecciona la nueva categoría:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Sin Categorizar', callback_data: 'noCategory' }],
            ...categoriesButtons(categories)
          ]
        }
      })
      return
    }

    if (btnPress === 'file') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            action: 'edit',
            expenseId: expenseToEdit.id,
            property: 'file'
          }
        }
      })

      await bot.sendMessage(userId, 'Envía el nuevo archivo:')
      return
    }

    if (conversationData.property === 'account') {
      const newAccount = await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          accountId: parseInt(btnPress)
        },
        include: {
          account: true
        }
      })

      expenseToEdit.account = newAccount.account
    }

    if (conversationData.property === 'category') {
      if (btnPress === 'noCategory') {
        await prisma.expense.update({
          where: {
            id: expenseToEdit.id
          },
          data: {
            categoryId: null
          }
        })

        expenseToEdit.category = null
      }

      const newCategory = await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          categoryId: parseInt(btnPress)
        },
        include: {
          category: true
        }
      })

      expenseToEdit.category = newCategory.category
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'expense',
        data: {
          action: 'edit',
          expenseId: expenseToEdit.id
        }
      }
    })

    const fileToSend = expenseFile(expenseToEdit)
    if (fileToSend) {
      await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
      await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
        caption: expenseText(expenseToEdit, user),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons()
        }
      })
      return
    }
    await bot.sendMessage(userId, expenseText(expenseToEdit, user), {
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
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Categorizar', callback_data: 'category' }, { text: 'Adjuntar', callback_data: 'file' }],
    [{ text: 'Cambiar Cuenta', callback_data: 'account' }, { text: 'Cambiar Monto', callback_data: 'amount' }],
  ]
}

export function expenseText(expense: ExpenseWithAll, user: User): string {
  const hasFile = expense.files.length > 0 ? '📎 ' : ''
  const category = expense.category ? `\nCategoria: ${expense.category.description}` : '\nSin categoría'
  const spanishDate = dayjs().tz(user.timezone).format('LL hh:mma')

  return `<i>${spanishDate}</i>\n${hasFile}<b>${expense.description}</b>\nCuenta: ${expense.account.description}\nMonto: ${numeral(expense.amount.amount).format('0,0.00')} ${expense.amount.currency}${category}\n\n¿Qué deseas hacer con este gasto?`
}

export function expenseFile(expense: ExpenseWithAll): { fileId: string, type: FileType } | null {
  if (expense.files.length === 0) return null

  const file = expense.files[0]

  return { fileId: file.fileId, type: file.fileType }
}
import { MsgAndQueryProps, MsgProps, QueryFromPrivate, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { accountsButtons } from '@conversations/accounts'
import TelegramBot from 'node-telegram-bot-api'
import numeral from 'numeral'
import { waitingForCommandOnStart } from '@conversations/waitingForCommand'
import { BookWithOwnerAndShares, ExpenseWithAll } from '@customTypes/prismaTypes'
import { categoriesButtons, maxCategories } from '@conversations/categories'
import { FileType } from '@prisma/client'
import auth from '@utils/auth'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { currencyEval, isDateValid, mathEval, titleEval } from '@utils/isValid'
import openAi from '@utils/openAi'

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
          include: {
            aiTags: true
          },
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
      const description = titleEval(text)
      if (!description.isOk) {
        await bot.sendMessage(userId, description.error)
        return
      }

      await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          description: description.value
        }
      })
      expenseToEdit.description = description.value
    }

    if (conversationData.property === 'amount') {
      if (conversationData.amount === undefined) {
        const amount = mathEval(text)
        if (!amount.isOk) {
          await bot.sendMessage(userId, amount.error)
          return
        }
        if (amount.value < 0) {
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
              amount: amount.value
            }
          }
        })

        await bot.sendMessage(userId, `Su moneda, en 3 letras:`)
        return
      }

      const currency = currencyEval(text)
      if (!currency.isOk) {
        await bot.sendMessage(userId, currency.error)
        return
      }

      const updateExpense = await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          amount: {
            update: {
              amount: conversationData.amount,
              currency: currency.value
            }
          }
        },
        select: {
          amount: true
        }
      })

      expenseToEdit.amount = updateExpense.amount
    }

    if (conversationData.property === 'split') {
      const splitAmmount = mathEval(text)
      if (!splitAmmount.isOk) {
        await bot.sendMessage(userId, splitAmmount.error)
        return
      }
      if (splitAmmount.value < 0) {
        await bot.sendMessage(userId, 'La respuesta debe ser un número mayor a 0.')
        return
      }
      if (splitAmmount.value > expenseToEdit.amount.amount) {
        await bot.sendMessage(userId, 'El monto a dividir debe ser menor al monto total.')
        return
      }

      const newAmount = await prisma.amountCurrency.create({
        data: {
          bookId: book.id,
          amount: splitAmmount.value,
          currency: expenseToEdit.amount.currency
        }
      })

      let newExpense = await prisma.expense.create({
        data: {
          description: `${expenseToEdit.description} (Dividido)`,
          createdById: user.id,
          accountId: expenseToEdit.accountId,
          amountId: newAmount.id,
          isIncome: expenseToEdit.isIncome,
          categoryId: expenseToEdit.categoryId,
          createdAt: expenseToEdit.createdAt,
          bookId: book.id
        },
        include: {
          files: true,
          amount: true,
          account: true,
          category: true,
          createdBy: true
        }
      })

      if (expenseToEdit.files.length > 0) {
        const tags = expenseToEdit.files[0].aiTags.map((tag) => tag.tag)
        const copyLastFile = await prisma.file.create({
          data: {
            bookId: book.id,
            fileId: expenseToEdit.files[0].fileId,
            fileType: expenseToEdit.files[0].fileType,
            expenseId: newExpense.id,
            validFrom: expenseToEdit.files[0].validFrom,
            ...(tags.length > 0 ? {
              aiTags: {
                createMany: {
                  data: tags.map((tag) => ({ tag, bookId: book.id }))
                }
              }
            } : {})
          }
        })

        newExpense.files = [copyLastFile]
      }

      await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          amount: {
            update: {
              amount: expenseToEdit.amount.amount - splitAmmount.value
            }
          }
        }
      })

      expenseToEdit.amount.amount -= splitAmmount.value

      await bot.sendMessage(userId, expenseText(expenseToEdit, book, true), {
        parse_mode: 'HTML'
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

      const fileToSend = expenseFile(newExpense)
      if (fileToSend) {
        await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
        await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
          caption: expenseText(newExpense, book),
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: expenseButtons(newExpense.isIncome)
          }
        })
        return
      }

      await bot.sendMessage(userId, expenseText(newExpense, book), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons(newExpense.isIncome)
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
      await bot.sendChatAction(userId, fileType === 'photo' ? 'upload_photo' : 'upload_document')

      let tags: string[] = []

      if (fileType === 'photo') {
        try {
          const fileUrl = await bot.getFileLink(fileId)
          const aiTag = await openAi.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
              role: 'system',
              content: 'You job is to get the items in the reciept, do not get the prices or the total amount, just the items with the name of the product.',
            }, {
              role: 'system',
              content: 'You will reply in json format like this: `{"items": ["item1", "item2", "item3"]}`',
            }, {
              role: 'system',
              content: 'If is not a reciept, or no items are found, reply with `{"items": []}`',
            }, {
              role: 'user',
              content: [{
                type: 'image_url',
                image_url: {
                  url: fileUrl,
                }
              }]
            }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          })
          if (!!aiTag.choices[0].message?.content) {
            const stringReply = aiTag.choices[0].message.content
            const jsonReply = JSON.parse(stringReply)
            if (jsonReply.items) {
              tags = jsonReply.items
            }
          }
        } catch (error) {
          console.error(error)
        }
      }

      // Expenses can only have one file
      await prisma.aiTags.deleteMany({
        where: {
          file: {
            expenseId: expenseToEdit.id
          }
        }
      })

      await prisma.file.deleteMany({
        where: {
          expenseId: expenseToEdit.id
        }
      })

      const file = await prisma.file.create({
        data: {
          bookId: book.id,
          fileId,
          fileType,
          expenseId: expenseToEdit.id,
          validFrom: dayjs(expenseToEdit.createdAt).tz(book.owner.timezone).startOf('month').format(),
          ...(tags.length > 0 ? {
            aiTags: {
              createMany: {
                data: tags.map((tag) => ({ tag, bookId: book.id }))
              }
            }
          } : {})
        },
        include: {
          aiTags: true
        }
      })

      expenseToEdit.files.unshift(file)
    }

    if (conversationData.property === 'date') {
      const isValid = isDateValid(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser una fecha válida.')
        return
      }

      const newDate = dayjs.tz(text, book.owner.timezone)

      const updatedExpense = await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          createdAt: newDate.format()
        }
      })
      expenseToEdit.createdAt = updatedExpense.createdAt
    }

    if (conversationData.property === 'category' && conversationData.isNew) {
      const categoryText = titleEval(text)
      if (!categoryText.isOk) {
        await bot.sendMessage(userId, categoryText.error)
        return
      }

      const newCategory = await prisma.category.create({
        data: {
          description: categoryText.value,
          bookId: book.id
        }
      })

      await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          categoryId: newCategory.id
        },
        include: {
          category: true
        }
      })

      await bot.sendMessage(userId, `Categoría <b>${categoryText.value}</b> creada.`, { parse_mode: 'HTML' })

      expenseToEdit.category = newCategory
    }

    const fileToSend = expenseFile(expenseToEdit)
    if (fileToSend) {
      await bot.sendChatAction(userId, fileToSend.type === 'photo' ? 'upload_photo' : 'upload_document')
      await bot[fileToSend.type === 'photo' ? 'sendPhoto' : 'sendDocument'](userId, fileToSend.fileId, {
        caption: expenseText(expenseToEdit, book),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons(expenseToEdit.isIncome)
        }
      })
      return
    }

    await bot.sendMessage(userId, expenseText(expenseToEdit, book), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expenseButtons(expenseToEdit.isIncome)
      }
    })
    return
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
        caption: expenseText(expenseToEdit, book),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons(expenseToEdit.isIncome)
        }
      })
      return
    }
    await bot.sendMessage(userId, expenseText(expenseToEdit, book), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expenseButtons(expenseToEdit.isIncome)
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

    if (btnPress === 'split') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            action: 'edit',
            property: 'split',
            expenseId: expenseToEdit.id
          }
        }
      })

      await bot.sendMessage(userId, `Ingresa un monto mayor a 0 y menor a ${expenseToEdit.amount.amount}.`)
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
      await prisma.aiTags.deleteMany({
        where: {
          file: {
            expenseId: expenseToEdit.id
          }
        }
      })

      await prisma.file.deleteMany({
        where: {
          expenseId: expenseToEdit.id
        }
      })

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
        orderBy: [
          {
            expenses: {
              _count: 'asc'
            }
          },
          {
            description: 'asc',
          }
        ],
        include: {
          expenses: true
        }
      })

      await bot.sendMessage(userId, 'Selecciona la nueva categoría:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Sin Categorizar', callback_data: 'noCategory' }, { text: 'Crear Categoría', callback_data: 'newCategory' }],
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

    if (btnPress === 'isIncome') {
      await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          isIncome: !expenseToEdit.isIncome
        }
      })

      expenseToEdit.isIncome = !expenseToEdit.isIncome
    }

    if (btnPress === 'date') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'expense',
          data: {
            expenseId: expenseToEdit.id,
            action: 'edit',
            property: 'date'
          }
        }
      })

      await bot.sendMessage(userId, 'Ingresa la nueva fecha:\n\n<i>Usa este formato en numeros: e.g. 2020-04-02T13:02</i>', { parse_mode: 'HTML' })
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
      if (btnPress === 'newCategory') {
        const categoriesCount = await prisma.category.count({
          where: {
            bookId: book.id
          }
        })

        if (categoriesCount >= maxCategories) {
          await bot.sendMessage(userId, `No puedes agregar más de ${maxCategories} categorías.`)
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
              property: 'category',
              isNew: true
            }
          }
        })

        await bot.sendMessage(userId, 'Escribe la descripción de la categoría a agregar.')
        return
      }

      const expenseWithCategoryChange = await prisma.expense.update({
        where: {
          id: expenseToEdit.id
        },
        data: {
          categoryId: btnPress === 'noCategory' ? null : parseInt(btnPress)
        },
        include: {
          category: true
        }
      })

      expenseToEdit.category = expenseWithCategoryChange.category
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
        caption: expenseText(expenseToEdit, book),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: expenseButtons(expenseToEdit.isIncome)
        }
      })
      return
    }
    await bot.sendMessage(userId, expenseText(expenseToEdit, book), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: expenseButtons(expenseToEdit.isIncome)
      }
    })
    return
  }
}

export function expenseButtons(isIncome: boolean): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Eliminar', callback_data: 'delete' }],
    [{ text: 'Categorizar', callback_data: 'category' }, { text: 'Adjuntar', callback_data: 'file' }, { text: 'Dividir', callback_data: 'split' }],
    [{ text: 'Cambiar Cuenta', callback_data: 'account' }, { text: 'Cambiar Monto', callback_data: 'amount' }],
    [{ text: isIncome ? 'Cambiar a Gasto' : 'Cambiar a Ingreso', callback_data: 'isIncome' }, { text: 'Cambiar Fecha', callback_data: 'date' }],
  ]
}

export function expenseText(expense: ExpenseWithAll, book: BookWithOwnerAndShares, hideQuestion: boolean = false): string {
  const hasFile = expense.files.length > 0 ? '📎 ' : ''
  const category = expense.category ? `\nCategoría: ${expense.category.description}` : '\nSin categoría'
  const spanishDate = dayjs(expense.createdAt).tz(book.owner.timezone).format('LL hh:mma')
  const isIncome = expense.isIncome ? ' (Ingreso)' : ''

  return `<i>${spanishDate}</i>\n${hasFile}<b>${expense.description}</b>\nCuenta: ${expense.account.description}\nMonto: ${numeral(expense.amount.amount).format('0,0.00')} ${expense.amount.currency}${isIncome}${category}${!hideQuestion ? `\n\n¿Qué deseas hacer con este gasto?` : ''}`
}

export function expenseFile(expense: ExpenseWithAll): { fileId: string, type: FileType } | null {
  if (expense.files.length === 0) return null

  const file = expense.files[0]

  return { fileId: file.fileId, type: file.fileType }
}

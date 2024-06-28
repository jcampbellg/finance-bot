import { budgetOnStart } from '@conversations/budget'
import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import { CategoryWithLimitsAndFiles, LimitsWithAmount } from '@customTypes/prismaTypes'
import { Category, FileType } from '@prisma/client'
import auth from '@utils/auth'
import { currencyEval, mathEval, titleEval } from '@utils/isValid'

dayjs.extend(utc)
dayjs.extend(timezone)

export const maxCategories = 50

export async function categoriesOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id
    },
    orderBy: [
      {
        description: 'asc',
      },
      {
        expenses: {
          _count: 'asc'
        }
      }
    ],
    include: {
      expenses: true
    }
  })

  await prisma.conversation.update({
    where: {
      chatId: user.id
    },
    data: {
      state: 'categories',
      data: {}
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o agrega una categoría a <b>${book.title}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        categories.length < maxCategories ? [{ text: 'Agregar', callback_data: 'add' }] : [],
        ...categoriesButtons(categories),
        [{ text: 'Regresar', callback_data: 'back' }]
      ]
    }
  })
  return
}

export async function categoriesOnText({ bot, msg }: MsgProps) {
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

  if (conversationData.action === 'add') {
    const newCatTitle = titleEval(text)
    if (!newCatTitle.isOk) {
      await bot.sendMessage(userId, newCatTitle.error)
      return
    }

    const newCategory = await prisma.category.create({
      data: {
        description: newCatTitle.value,
        bookId: book.id
      },
      include: {
        files: true
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'categories',
        data: {
          action: 'edit',
          categoryId: newCategory.id
        }
      }
    })

    await bot.sendMessage(userId, `<i>Categoría agregada.</i>`, { parse_mode: 'HTML' })
    await sendCategory(bot, userId, { ...newCategory, limits: [] })
    return
  }

  if (conversationData.action === 'edit') {
    const categoryToEdit = await prisma.category.findUnique({
      where: {
        id: conversationData.categoryId || 0
      },
      include: {
        files: true,
        limits: {
          include: {
            amount: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!categoryToEdit) {
      await bot.sendMessage(userId, 'La categoría seleccionada ya no existe.')
      await categoriesOnStart({ bot, msg })
      return
    }

    if (conversationData.property === 'description') {
      const newTitle = titleEval(text)
      if (!newTitle.isOk) {
        await bot.sendMessage(userId, newTitle.error)
        return
      }

      const categoryEdit = await prisma.category.update({
        where: {
          id: categoryToEdit.id
        },
        data: {
          description: newTitle.value
        },
        include: {
          files: true
        }
      })

      await bot.sendMessage(userId, `<i>Categoría actualizada.</i>`, { parse_mode: 'HTML' })
      await sendCategory(bot, userId, { ...categoryEdit, limits: categoryToEdit.limits })
      return
    }

    if (conversationData.property === 'limit') {
      if (conversationData.limit === undefined) {
        const limit = mathEval(text)
        if (!limit.isOk) {
          await bot.sendMessage(userId, limit.error)
          return
        }

        if (limit.value < 0) {
          await bot.sendMessage(userId, 'La respuesta debe ser un número mayor o igual a 0.')
          return
        }

        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'categories',
            data: {
              action: 'edit',
              categoryId: categoryToEdit.id,
              property: 'limit',
              limit: limit.value
            }
          }
        })

        await bot.sendMessage(userId, `Su moneda, en 3 letras:`, {
          parse_mode: 'HTML',
        })
        return
      }

      const currency = currencyEval(text)

      if (!currency.isOk) {
        await bot.sendMessage(userId, currency.error)
        return
      }

      const limitAmount = await prisma.amountCurrency.create({
        data: {
          amount: conversationData.limit,
          currency: currency.value
        }
      })

      await prisma.limit.create({
        data: {
          bookId: book.id,
          categoryId: categoryToEdit.id,
          amountId: limitAmount.id,
          ignoreInBudget: categoryToEdit.limits[0]?.ignoreInBudget || false,
          validFrom: dayjs().tz(book.owner.timezone).startOf('month').format()
        }
      })

      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: categoryToEdit.id
          }
        }
      })

      const newLimits = await prisma.limit.findMany({
        where: {
          categoryId: categoryToEdit.id
        },
        include: {
          amount: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      await sendCategory(bot, userId, { ...categoryToEdit, limits: newLimits })
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

      // Category can only have one file per month
      const validFromMonth = dayjs().tz(book.owner.timezone).startOf('month').format()

      await prisma.files.deleteMany({
        where: {
          categoryId: categoryToEdit.id,
          validFrom: validFromMonth
        }
      })

      const file = await prisma.files.create({
        data: {
          fileId,
          fileType,
          categoryId: categoryToEdit.id,
          validFrom: dayjs().tz(book.owner.timezone).startOf('month').format()
        }
      })

      await sendCategory(bot, userId, { ...categoryToEdit, files: [file] })
      return
    }
  }
}

export async function categoriesOnCallbackQuery({ bot, query }: QueryProps) {
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
      await categoriesOnStart({ bot, query })
      return
    }

    await budgetOnStart({ bot, query })
    return
  }

  if (btnPress === 'add') {
    const categoriesCount = await prisma.category.count({
      where: {
        bookId: book.id
      }
    })

    if (categoriesCount >= maxCategories) {
      await bot.sendMessage(userId, `No puedes agregar más de ${maxCategories} categorías.`)
      await categoriesOnStart({ bot, query })
      return
    }

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'categories',
        data: {
          action: 'add'
        }
      }
    })

    await bot.sendMessage(userId, 'Escribe la descripción de la categoría a agregar.')
    return
  }

  if (!conversationData.action) {
    // btn press is a category id
    const categoryId = parseInt(btnPress)
    if (Number.isNaN(categoryId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'categories',
        data: {
          action: 'edit',
          categoryId: categoryId
        }
      }
    })

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      include: {
        files: true,
        limits: {
          include: {
            amount: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!category) {
      await bot.sendMessage(userId, 'La categoría seleccionada ya no existe.')
      await categoriesOnStart({ bot, query })
      return
    }

    await sendCategory(bot, userId, category)
    return
  }

  if (conversationData.action === 'edit') {
    const categoryToEdit = await prisma.category.findUnique({
      where: {
        id: conversationData.categoryId || 0
      },
      include: {
        files: true,
        limits: {
          include: {
            amount: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!categoryToEdit) {
      await bot.sendMessage(userId, 'La categoría seleccionada ya no existe.')
      await categoriesOnStart({ bot, query })
      return
    }

    if (btnPress === 'ignore') {
      if (categoryToEdit.limits.length === 0) {
        await bot.sendMessage(userId, 'No se puede ignorar un limite si no hay uno asignado.')
        await sendCategory(bot, userId, categoryToEdit)
        return
      }

      const newLimit = await prisma.limit.update({
        where: {
          id: categoryToEdit.limits[0].id
        },
        data: {
          ignoreInBudget: !categoryToEdit.limits[0].ignoreInBudget
        },
        include: {
          amount: true
        }
      })

      await bot.sendMessage(userId, `<i>Categoría actualizada.</i>`, { parse_mode: 'HTML' })
      await sendCategory(bot, userId, { ...categoryToEdit, limits: [newLimit] })
      return
    }

    if (btnPress === 'payment') {
      await prisma.category.update({
        where: {
          id: categoryToEdit.id
        },
        data: {
          isPayment: !categoryToEdit.isPayment
        }
      })

      await bot.sendMessage(userId, `<i>Categoría actualizada.</i>`, { parse_mode: 'HTML' })
      await sendCategory(bot, userId, { ...categoryToEdit, isPayment: !categoryToEdit.isPayment })
      return
    }

    if (btnPress === 'delete') {
      await prisma.limit.deleteMany({
        where: {
          categoryId: categoryToEdit.id
        }
      })

      await prisma.category.update({
        where: {
          id: categoryToEdit.id
        },
        data: {
          expenses: {
            set: []
          }
        }
      })

      await prisma.category.delete({
        where: {
          id: categoryToEdit.id
        }
      })

      await bot.sendMessage(userId, `Categoría con sus limites eliminada:\n<b>${categoryToEdit.description}</b>`, {
        parse_mode: 'HTML'
      })
      await categoriesOnStart({ bot, query })
      return
    }

    if (btnPress === 'description') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: categoryToEdit.id,
            property: 'description'
          }
        }
      })

      await bot.sendMessage(userId, 'Escribe la nueva descripción de la categoría:')
      return
    }

    if (btnPress === 'limit') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: categoryToEdit.id,
            property: 'limit'
          }
        }
      })

      await bot.sendMessage(userId, `Escribe el nuevo limite para\n<b>${categoryToEdit.description}</b>:`, {
        parse_mode: 'HTML'
      })
      return
    }

    if (btnPress === 'file') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'categories',
          data: {
            action: 'edit',
            categoryId: categoryToEdit.id,
            property: 'file'
          }
        }
      })

      await bot.sendMessage(userId, 'Envía el nuevo archivo:')
      return
    }
  }
}

export function categoriesButtons(categories: Category[]): TelegramBot.InlineKeyboardButton[][] {
  const categoriesGroups = categories.reduce((acc, curr, i) => {
    if (i % 2 === 0) acc.push([curr])
    else acc[acc.length - 1].push(curr)
    return acc
  }, [] as Category[][])

  return categoriesGroups.map(group => {
    return group.map(cat => ({
      text: `${cat.description}`,
      callback_data: `${cat.id}`
    }))
  })
}

export function categoryButtons(isPayment: boolean, hasLimit: boolean, isIgnore: boolean): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: `${hasLimit ? 'Cambiar' : 'Agregar'} ${isPayment ? 'Monto' : 'Limite'}`, callback_data: 'limit' }, { text: isPayment ? 'Quitar de Pago Fijos' : 'Poner en Pagos Fijo', callback_data: 'payment' }],
    [{ text: 'Renombrar', callback_data: 'description' }, { text: 'Adjuntar', callback_data: 'file' }, { text: 'Eliminar', callback_data: 'delete' }],
    [...(hasLimit ? [{ text: isIgnore ? 'Sumar en presupuesto' : 'Ignorar en presupuesto', callback_data: 'ignore' }] : []), { text: 'Regresar', callback_data: 'back' }]
  ]
}

export function limitsListText(limits: LimitsWithAmount[], isPayment: boolean, isIgnore: boolean) {
  const paymentText = isPayment ? '\n\nPago Fijo' : ''

  if (limits.length === 0) return paymentText
  if (limits[0].amount.amount === 0) return paymentText

  const lastLimit = limits[0]
  const ignoreText = isIgnore ? '\n\n<i>Ignorado en presupuesto, no se sumara al gran total.</i>' : ''

  return `${paymentText}\n\n${isPayment ? 'Monto' : 'Limite'}:\n${numeral(lastLimit?.amount.amount || 0).format('0,0.00')} ${lastLimit?.amount.currency}${ignoreText}`
}

export async function sendCategory(bot: TelegramBot, chatId: number, category: CategoryWithLimitsAndFiles) {
  const hasFile = category.files.length > 0 ? '📎' : ''
  const hasLimit = category.limits.length > 0 && category.limits[0].amount.amount > 0
  const ignore = hasLimit ? category.limits[0].ignoreInBudget : false

  const caption = `${hasFile}<b>${category.description}</b>${limitsListText(category.limits, category.isPayment, ignore)}`

  if (hasFile) {
    const file = category.files[0]
    await bot.sendChatAction(chatId, file.fileType === 'photo' ? 'upload_photo' : 'upload_document')
    await bot[file.fileType === 'photo' ? 'sendPhoto' : 'sendDocument'](chatId, file.fileId, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: categoryButtons(category.isPayment, hasLimit, ignore)
      }
    })
    return
  }

  await bot.sendMessage(chatId, caption, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: categoryButtons(category.isPayment, hasLimit, ignore)
    }
  })
}
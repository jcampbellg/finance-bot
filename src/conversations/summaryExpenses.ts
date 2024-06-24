import { MsgAndQueryProps, MsgProps } from '@customTypes/messageTypes'
import fs from 'fs'
import { prisma } from '@utils/prisma'
import numeral from 'numeral'
import emojiRegex from 'emoji-regex'
import PDFDocument from 'pdfkit'
import blobStream from 'blob-stream'
import { AlignmentEnum, AsciiTable3 } from 'ascii-table3'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { CategoryWithLimitsAndExpenses } from '@customTypes/prismaTypes'
import auth from '@utils/auth'
import { z } from 'zod'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

const regex = emojiRegex()

const fonts = {
  regular: 'src/assets/font/Roboto-Regular.ttf',
  bold: 'src/assets/font/Roboto-Bold.ttf',
  light: 'src/assets/font/Roboto-Light.ttf',
  black: 'src/assets/font/Roboto-Black.ttf',
  telegrama: 'src/assets/font/telegrama_raw.otf'
}

export async function summaryExpensesOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summaryExpenses',
      data: {}
    }
  })

  await bot.sendMessage(userId, '¿En que moneda quieres el gran total?\n\nPor favor, escribe el código de la moneda en tres letras.')
  return
}

export async function summaryExpensesOnText({ bot, msg }: MsgProps) {
  const { user, book, userId } = await auth({ msg, bot } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const text = msg.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (!conversationData.currency) {
    const isValid = z.string().regex(/[a-zA-Z]+/).length(3).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser de 3 letras.')
      return
    }

    const currency = text.toUpperCase()

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        data: {
          ...conversationData,
          currency: currency
        }
      }
    })

    await bot.sendMessage(userId, 'Generando resumen de gastos...')
    await summaryExpensesCreatePDF({ bot, msg }, currency)
  }
}

export async function summaryExpensesCreatePDF({ bot, msg, query }: MsgAndQueryProps, currency: string) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const summaryMonth = dayjs().tz(user.timezone).startOf('month')

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id,
      isPayment: false,
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        where: {
          validFrom: {
            lte: summaryMonth.format()
          }
        },
        include: {
          amount: true
        }
      },
      expenses: {
        where: {
          createdAt: {
            gte: summaryMonth.format(),
            lte: summaryMonth.endOf('month').format()
          }
        },
        include: {
          amount: true,
          account: true
        }
      }
    }
  }).then(cats => cats.filter(cat => cat.expenses.length > 0))

  const payments = await prisma.category.findMany({
    where: {
      bookId: book.id,
      isPayment: true
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        where: {
          validFrom: {
            lte: summaryMonth.format()
          }
        },
        include: {
          amount: true
        }
      },
      expenses: {
        where: {
          createdAt: {
            gte: summaryMonth.format(),
            lte: summaryMonth.endOf('month').format()
          }
        },
        include: {
          amount: true,
          account: true
        }
      }
    }
  }).then(cats => cats.filter(cat => cat.expenses.length > 0))

  const filepath = 'src/assets/' + Math.random().toString(36).substring(7) + '.pdf'
  const stream = blobStream()

  await bot.sendChatAction(userId, 'upload_document')

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50
    }
  })

  doc.pipe(stream)
  doc.font(fonts.black).fontSize(24).text('RESUMEN DE GASTOS', { align: 'center' })
  doc.moveDown(0.2)
  doc.font(fonts.light).fontSize(14).text(book.title, { align: 'left' })
  doc.font(fonts.light).fontSize(14).text(summaryMonth.format('MMMM YYYY'), { align: 'left' })
  doc.font(fonts.light).fontSize(14).text(`Gran total en ${currency}`, { align: 'left' })
  doc.moveDown(0.5)

  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('CATEGORIAS', { align: 'center' })
  await categoriesTable({ doc, categories, emptyMessage: 'No hay gastos registrados', heading: ['Descripción', 'Monto'], summaryMonth, currency, bookId: book.id })
  doc.moveDown(2)

  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('PAGOS FIJOS', { align: 'center' })
  await categoriesTable({ doc, categories: payments, emptyMessage: 'No hay pagos fijos registrados', heading: ['Pago', 'Monto'], summaryMonth, currency, bookId: book.id })
  doc.moveDown(2)

  doc.end()
  stream.on('finish', async function () {
    const blob = stream.toBlob('application/pdf')
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await bot.sendDocument(userId, buffer, {}, { filename: `${summaryMonth.format('MMMM YYYY')} [${currency}] Resumen de presupuesto.pdf`, contentType: 'application/pdf' })
    fs.unlink(filepath, () => { })
  })
  return
}

type CategoriesTableProps = {
  doc: PDFKit.PDFDocument
  categories: CategoryWithLimitsAndExpenses[]
  emptyMessage: string
  heading: string[]
  currency: string
  bookId: number
  summaryMonth: dayjs.Dayjs
}

async function categoriesTable({ doc, categories, emptyMessage, heading, bookId, summaryMonth, currency }: CategoriesTableProps) {
  const exchangeRate = await prisma.exchangeRate.findMany({
    where: {
      bookId: bookId,
      validFrom: {
        lte: summaryMonth.format()
      },
      to: currency
    }
  })

  doc.font(fonts.telegrama).fontSize(12)
  if (categories.length === 0) {
    doc.text(emptyMessage, { align: 'center' })
    return {}
  } else {
    const tableArray = categories.reduce((acc: string[][], curr: CategoryWithLimitsAndExpenses) => {
      const category = curr.description.replace(regex, '').trim()
      const expenses = curr.expenses.map(exp => {
        const description = exp.description.replace(regex, '').trim()
        const amount = `${numeral(exp.amount.amount).format('0,0.00')} ${exp.amount.currency}`
        return [description, amount]
      })
      const totalByMainCurrency = curr.expenses.reduce((acc, curr) => acc + curr.amount.amount, 0)

      return [...acc, [category, ''], ...expenses, ['', '']]
    }, [])

    console.log(tableArray)

    const table = new AsciiTable3().setHeading(...heading).setStyle('compact').addRowMatrix(tableArray).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.LEFT).setAlign(2, AlignmentEnum.RIGHT)

    doc.text(table.toString(), { align: 'center' })
  }
}
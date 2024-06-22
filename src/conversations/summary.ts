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
import { CategoryWithLimits, IncomeWithSalary } from '@customTypes/prismaTypes'
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

export async function summaryBudgetOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summaryBudget',
      data: {}
    }
  })

  await bot.sendMessage(userId, '¿En que moneda quieres el gran total?\n\nPor favor, escribe el código de la moneda en tres letras.')
  return
}

export async function summaryBudgetOnText({ bot, msg }: MsgProps) {
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

    await bot.sendMessage(userId, 'Generando resumen de presupuesto...')
    await summaryBudgetCreatePDF({ bot, msg }, currency)
  }
}

export async function summaryBudgetCreatePDF({ bot, msg, query }: MsgAndQueryProps, currency: string) {
  const { user, book, userId } = await auth({ msg, bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const summaryMonth = dayjs().utc().startOf('month')

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id,
      isPayment: false
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
      }
    }
  })

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
      }
    }
  })

  const incomes = await prisma.income.findMany({
    where: {
      bookId: book.id
    },
    include: {
      salary: {
        where: {
          validFrom: {
            lte: summaryMonth.format()
          }
        },
        include: {
          amount: true
        }
      }
    }
  })

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
  doc.font(fonts.black).fontSize(24).text('RESUMEN DE PRESUPUESTO', { align: 'center' })
  doc.moveDown(0.2)
  doc.font(fonts.light).fontSize(14).text(book.title, { align: 'left' })
  doc.font(fonts.light).fontSize(14).text(summaryMonth.format('MMMM YYYY'), { align: 'left' })
  doc.font(fonts.light).fontSize(14).text(`Gran total en ${currency}`, { align: 'left' })
  doc.moveDown(0.5)

  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('INGRESOS', { align: 'center' })
  const incomesByCurrency = incomesTable({ doc, incomes, emptyMessage: 'No hay ingresos registrados', heading: ['Ingreso', 'Monto'] })
  doc.moveDown(2)

  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('CATEGORIAS', { align: 'center' })
  const limitsByCurrency = categoriesTable({ doc, categories, emptyMessage: 'No hay categorías registradas', heading: ['Categoría', 'Límite'] })
  doc.moveDown(2)

  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('PAGOS FIJOS', { align: 'center' })
  const paymentsByCurrency = categoriesTable({ doc, categories: payments, emptyMessage: 'No hay pagos fijos registrados', heading: ['Pago', 'Monto / Límite'] })
  doc.moveDown(2)

  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('TOTAL PRESUPUESTADO', { align: 'center' })
  await totalTable({ doc, subtotalsSubtract: [limitsByCurrency, paymentsByCurrency], subtotalsAdd: [incomesByCurrency], currency, bookId: book.id, summaryMonth })

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
  categories: CategoryWithLimits[]
  emptyMessage: string,
  heading: string[]
}

function categoriesTable({ doc, categories, emptyMessage, heading }: CategoriesTableProps): Record<string, number> {
  doc.font(fonts.telegrama).fontSize(12)
  if (categories.length === 0) {
    doc.text(emptyMessage, { align: 'center' })
    return {}
  } else {
    const catTable = new AsciiTable3().setHeading(...heading).setStyle('compact').addRowMatrix(categories.map(cat => {
      const description = cat.description.replace(regex, '').trim()
      const limit = cat.limits.length > 0 ? `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}` : '0'
      return [description, limit]
    })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.LEFT).setAlign(2, AlignmentEnum.RIGHT)

    doc.text(catTable.toString(), { align: 'center' })
    // Totals by currency
    const catCurrency = [...new Set(categories.filter(c => c.limits.length > 0).map(c => c.limits[0].amount.currency))]

    if (catCurrency.length > 0) {
      const catTotalByCurrency: Record<string, number> = catCurrency.reduce((acc, currency) => {
        const total = categories.filter(c => c.limits.length > 0 && c.limits[0].amount.currency === currency).reduce((acc, curr) => acc + curr.limits[0].amount.amount, 0)
        return { ...acc, [currency]: total }
      }, {})
      const catTotalTable = new AsciiTable3().setStyle('compact').addRowMatrix(catCurrency.map(currency => {
        return [`SUBTOTAL ${currency}`, `${numeral(catTotalByCurrency[currency]).format('0,0.00')} ${currency}`]
      })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.RIGHT).setAlign(2, AlignmentEnum.RIGHT).setHeadingAlignRight()

      doc.text(catTotalTable.toString(), { align: 'center' })

      return catTotalByCurrency
    }
    return {}
  }
}

type IncomesTableProps = {
  doc: PDFKit.PDFDocument
  incomes: IncomeWithSalary[]
  emptyMessage: string,
  heading: string[]
}

function incomesTable({ doc, incomes, emptyMessage, heading }: IncomesTableProps): Record<string, number> {
  doc.font(fonts.telegrama).fontSize(12)
  if (incomes.length === 0) {
    doc.text(emptyMessage, { align: 'center' })
    return {}
  } else {
    const incomesTable = new AsciiTable3().setHeading(...heading).setStyle('compact').addRowMatrix(incomes.map(inc => {
      const description = inc.description.replace(regex, '').trim()
      const amount = inc.salary.length > 0 ? `${numeral(inc.salary[0].amount.amount).format('0,0.00')} ${inc.salary[0].amount.currency}` : '0'
      return [description, amount]
    })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.LEFT).setAlign(2, AlignmentEnum.RIGHT)

    doc.text(incomesTable.toString(), { align: 'center' })
    // Totals by currency
    const incomesCurrency = [...new Set(incomes.filter(c => c.salary.length > 0).map(c => c.salary[0].amount.currency))]

    if (incomesCurrency.length > 0) {
      const incomesTotalByCurrency: Record<string, number> = incomesCurrency.reduce((acc, currency) => {
        const total = incomes.filter(inc => inc.salary.length > 0 && inc.salary[0].amount.currency === currency).reduce((acc, curr) => acc + curr.salary[0].amount.amount, 0)
        return { ...acc, [currency]: total }
      }, {})
      const incomesTotalTable = new AsciiTable3().setStyle('compact').addRowMatrix(incomesCurrency.map(currency => {
        return [`SUBTOTAL ${currency}`, `${numeral(incomesTotalByCurrency[currency]).format('0,0.00')} ${currency}`]
      })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.RIGHT).setAlign(2, AlignmentEnum.RIGHT).setHeadingAlignRight()

      doc.text(incomesTotalTable.toString(), { align: 'center' })

      return incomesTotalByCurrency
    }
    return {}
  }
}

type TotalsTableProps = {
  doc: PDFKit.PDFDocument
  subtotalsAdd: Record<string, number>[]
  subtotalsSubtract: Record<string, number>[]
  currency: string
  bookId: number
  summaryMonth: dayjs.Dayjs
}

async function totalTable({ doc, subtotalsAdd, subtotalsSubtract, currency, bookId, summaryMonth }: TotalsTableProps) {
  const totalAdd: Record<string, number> = subtotalsAdd.reduce((acc, curr) => {
    return Object.keys(curr).reduce((acc, key) => {
      return { ...acc, [key]: (acc[key] || 0) + curr[key] }
    }, acc)
  }, {})

  const totalSub: Record<string, number> = subtotalsSubtract.reduce((acc, curr) => {
    return Object.keys(curr).reduce((acc, key) => {
      return { ...acc, [key]: (acc[key] || 0) + curr[key] }
    }, acc)
  }, {})

  const currencies = [...new Set([...Object.keys(totalAdd), ...Object.keys(totalSub)])]

  if (currencies.length === 0) {
    return {}
  }

  const total: Record<string, number> = currencies.reduce((acc, currency) => {
    return { ...acc, [currency]: (totalAdd[currency] || 0) - (totalSub[currency] || 0) }
  }, {})

  const exchangeRate = await prisma.exchangeRate.findMany({
    where: {
      bookId: bookId,
      validFrom: {
        lte: summaryMonth.format()
      },
      to: currency
    }
  })

  const totalInMainCurrency = currencies.reduce((acc, curr) => {
    if (curr === currency) return acc + (total[curr] || 0)

    const rate = exchangeRate.find(exc => exc.from === curr)?.amount || 1
    return acc + (total[curr] || 0) * rate
  }, 0)

  const budgetInMainCurrency = currencies.reduce((acc, curr) => {
    if (curr === currency) return acc + (totalSub[curr] || 0)

    const rate = exchangeRate.find(exc => exc.from === curr)?.amount || 1
    return acc + (totalSub[curr] || 0) * rate
  }, 0)

  const incomeInMainCurrency = currencies.reduce((acc, curr) => {
    if (curr === currency) return acc + (totalAdd[curr] || 0)

    const rate = exchangeRate.find(exc => exc.from === curr)?.amount || 1
    return acc + (totalAdd[curr] || 0) * rate
  }, 0)

  console.log(totalSub, budgetInMainCurrency, incomeInMainCurrency)

  const totalTable = new AsciiTable3().setStyle('compact').addRowMatrix([
    [`INGRESOS EN ${currency}`, `${numeral(incomeInMainCurrency).format('0,0.00')} ${currency}`],
    [`PRESUPUESTADO EN ${currency}`, `-${numeral(budgetInMainCurrency).format('0,0.00')} ${currency}`],
    [`DISPONIBLE EN ${currency}`, `${numeral(totalInMainCurrency).format('0,0.00')} ${currency}`]
  ]).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.RIGHT).setAlign(2, AlignmentEnum.RIGHT).setHeadingAlignRight()

  doc.font(fonts.telegrama).fontSize(12)
  doc.text(totalTable.toString(), { align: 'center' })

  return total
}
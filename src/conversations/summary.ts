import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import PdfPrinter from 'pdfmake'
import { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import fs from 'fs'
import blobStream from 'blob-stream'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import emojiRegex from 'emoji-regex'
import numeral from 'numeral'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export async function summaryOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summary',
      data: {}
    }
  })

  const prevMonth = dayjs().utc().startOf('month').subtract(1, 'month')
  const thisMonth = dayjs().utc().startOf('month')
  const nextMonth = dayjs().utc().startOf('month').add(1, 'month')

  await bot.sendMessage(userId, '¿Qué mes deseas ver?', {
    reply_markup: {
      inline_keyboard: [[{
        text: prevMonth.format('MMMM YYYY'),
        callback_data: `${prevMonth.format()}`
      }, {
        text: thisMonth.format('MMMM YYYY'),
        callback_data: `${thisMonth.format()}`
      }, {
        text: nextMonth.format('MMMM YYYY'),
        callback_data: `${nextMonth.format()}`
      }]]
    }
  })
}

export async function summaryOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book, userId } = await auth({ bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summary',
      data: {
        date: query.data
      }
    }
  })

  await bot.sendMessage(userId, `<i>Generando resumen de ${dayjs(query.data).utc().format('MMMM YYYY')}</i>`, {
    parse_mode: 'HTML'
  })

  await createPDF({ bot, query, monthYear: query.data })
}

type CreatePDFProps = QueryProps & {
  monthYear: string
}

const fonts = {
  Roboto: {
    normal: 'src/assets/fonts/roboto/Roboto-Regular.ttf',
    bold: 'src/assets/fonts/roboto/Roboto-Bold.ttf',
    italics: 'src/assets/fonts/roboto/Roboto-Italic.ttf',
    bolditalics: 'src/assets/fonts/roboto/Roboto-BoldItalic.ttf'
  },
  RobotoMono: {
    normal: 'src/assets/fonts/robotomono/RobotoMono-Regular.ttf',
    bold: 'src/assets/fonts/robotomono/RobotoMono-Bold.ttf',
    italics: 'src/assets/fonts/robotomono/RobotoMono-Italic.ttf',
    bolditalics: 'src/assets/fonts/robotomono/RobotoMono-BoldItalic.ttf'
  }
}

const regex = emojiRegex()

async function createPDF({ bot, query, monthYear }: CreatePDFProps) {
  const { user, book, userId } = await auth({ bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const monthStart = dayjs(monthYear).utc().startOf('month')
  const monthEnd = dayjs(monthYear).utc().endOf('month')

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        where: {
          validFrom: {
            lte: monthStart.format()
          }
        },
        include: {
          amount: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      },
      expenses: {
        where: {
          createdAt: {
            gte: monthStart.format(),
            lte: monthEnd.format()
          }
        },
        include: {
          amount: true,
          account: true
        }
      }
    }
  })

  const expensesWithNoCategory = await prisma.expense.findMany({
    where: {
      bookId: book.id,
      categoryId: null,
      createdAt: {
        gte: monthStart.format(),
        lte: monthEnd.format()
      }
    },
    include: {
      amount: true,
      account: true
    }
  })

  const exchangeRates = await prisma.exchangeRate.findMany({
    where: {
      bookId: book.id,
      validFrom: {
        gte: monthStart.format(),
        lte: monthEnd.format()
      }
    }
  })

  const noCategoryExpenses = {
    description: 'Gastos sin categoría',
    limits: [],
    expenses: expensesWithNoCategory
  }

  const categoriesSummary: TableCell[][] = [noCategoryExpenses, ...categories.filter(c => !c.isPayment)].map(cat => {
    const description = cat.description.replace(regex, '').trim()
    const hasLimit = cat.limits.length > 0 && cat.limits[0].amount.amount > 0

    const expensesWithCurrencies: Record<string, number> = cat.expenses.reduce((accumulator, exp) => {
      const currency = exp.amount.currency
      const amount = exp.amount.amount

      return {
        ...accumulator,
        [currency]: (accumulator[currency] || 0) + amount
      }
    }, {} as Record<string, number>)

    const expensesString = Object.keys(expensesWithCurrencies).map(currency => {
      const amount = expensesWithCurrencies[currency]
      return `${numeral(amount).format('0,0.00')} ${currency}`
    })

    if (hasLimit) {
      const limit = `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}`
      const limitCurrency = cat.limits[0].amount.currency

      const totalInLimitCurrency: number = cat.expenses.reduce((accumulator, exp) => {
        const currency = exp.amount.currency
        const amount = exp.amount.amount

        const exchangeRate = exchangeRates.find(rate => rate.to === limitCurrency && rate.from === currency)?.amount || 1
        return accumulator + (amount * exchangeRate)
      }, 0)

      const hasExceeded = totalInLimitCurrency > cat.limits[0].amount.amount

      return [
        {
          text: [description, { text: hasExceeded ? '\nLimite excedido' : '', bold: true, color: 'red' }],
        },
        {
          layout: 'noBorders',
          table: {
            widths: ['*'],
            body: [
              ...expensesString.map(exp => [exp]),
              [{
                table: {
                  widths: ['*', 'auto', '*'],
                  body: [
                    [
                      {
                        text: `${numeral(totalInLimitCurrency).format('0,0.00')} ${limitCurrency}`,
                        bold: false,
                        alignment: 'left',
                        border: [false, true, false, false]
                      },
                      {
                        text: '/',
                        alignment: 'center',
                        border: [false, true, false, false]
                      },
                      {
                        text: limit,
                        bold: true,
                        alignment: 'right',
                        border: [false, true, false, false]
                      }
                    ]
                  ]
                },
              }]
            ],
          }
        }
      ]
    }

    return [
      description,
      {
        layout: 'noBorders',
        table: {
          widths: ['*'],
          body: [
            ...expensesString.map(exp => [exp]),
          ],
        }
      }
    ]
  })

  const paymentsSummary: TableCell[][] = categories.filter(c => c.isPayment).map(cat => {
    const description = cat.description.replace(regex, '').trim()
    const hasLimit = cat.limits.length > 0 && cat.limits[0].amount.amount > 0

    const expensesWithCurrencies: Record<string, number> = cat.expenses.reduce((accumulator, exp) => {
      const currency = exp.amount.currency
      const amount = exp.amount.amount

      return {
        ...accumulator,
        [currency]: (accumulator[currency] || 0) + amount
      }
    }, {} as Record<string, number>)

    const expensesString = Object.keys(expensesWithCurrencies).map(currency => {
      const amount = expensesWithCurrencies[currency]
      return `${numeral(amount).format('0,0.00')} ${currency}`
    })

    const noExpenses = expensesString.length === 0

    if (hasLimit) {
      const limit = `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}`
      const limitCurrency = cat.limits[0].amount.currency

      const totalInLimitCurrency: number = cat.expenses.reduce((accumulator, exp) => {
        const currency = exp.amount.currency
        const amount = exp.amount.amount

        const exchangeRate = exchangeRates.find(rate => rate.to === limitCurrency && rate.from === currency)?.amount || 1
        return accumulator + (amount * exchangeRate)
      }, 0)

      const hasPaid = totalInLimitCurrency >= (cat.limits[0].amount.amount * 0.70)
      const hasOverpaid = totalInLimitCurrency > cat.limits[0].amount.amount

      return [
        {
          text: [description, { text: hasOverpaid ? '\nPagado de mas' : (hasPaid ? '\nPagado' : '\nSin Pagar'), bold: true, color: (!hasPaid || hasOverpaid) ? 'red' : 'green' }],
        },
        {
          layout: 'noBorders',
          table: {
            widths: ['*'],
            body: [
              ...expensesString.map(exp => [exp]),
              [{
                table: {
                  widths: ['*', 'auto', '*'],
                  body: [
                    [
                      {
                        text: `${numeral(totalInLimitCurrency).format('0,0.00')} ${limitCurrency}`,
                        bold: false,
                        alignment: 'left',
                        border: [false, !noExpenses, false, false]
                      },
                      {
                        text: '/',
                        alignment: 'center',
                        border: [false, !noExpenses, false, false]
                      },
                      {
                        text: limit,
                        bold: true,
                        alignment: 'right',
                        border: [false, !noExpenses, false, false]
                      }
                    ]
                  ]
                },
              }]
            ],
          }
        }
      ]
    }

    return [
      description,
      {
        layout: 'noBorders',
        table: {
          widths: ['*'],
          body: [
            ...expensesString.map(exp => [exp]),
          ],
        }
      }
    ]
  })

  const filepath = 'src/assets/' + Math.random().toString(36).substring(7) + '.pdf'
  const stream = blobStream()
  const printer = new PdfPrinter(fonts)
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        font: 'Roboto',
        bold: true,
        fontSize: 22,
        marginBottom: 20,
        alignment: 'center',
        text: `Resumen de ${monthStart.format('MMMM YYYY')}`
      },
      {
        font: 'RobotoMono',
        fontSize: 16,
        alignment: 'center',
        text: `Categorías`,
        marginBottom: 5
      },
      {
        font: 'RobotoMono',
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Categoría', bold: true },
              { text: 'Gastos / Limite', bold: true }
            ],
            ...categoriesSummary,
          ]
        }
      },
      {
        font: 'RobotoMono',
        fontSize: 16,
        alignment: 'center',
        text: `Pagos Fijos`,
        marginBottom: 5,
        marginTop: 10
      },
      {
        font: 'RobotoMono',
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Descripción', bold: true },
              { text: 'Pagos / Deuda', bold: true }
            ],
            ...paymentsSummary,
          ]
        }
      }
    ]
  }

  const pdfDoc = printer.createPdfKitDocument(docDefinition, {})
  pdfDoc.pipe(stream)
  pdfDoc.end()

  stream.on('finish', async function () {
    const blob = stream.toBlob('application/pdf')
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await bot.sendDocument(userId, buffer, {}, { filename: `Resumen.pdf`, contentType: 'application/pdf' })
    fs.unlink(filepath, () => { })
  })
}
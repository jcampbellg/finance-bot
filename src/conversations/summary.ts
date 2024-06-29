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
import { CategoryWithLimitsAndExpenses } from '@customTypes/prismaTypes'

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

  const prevMonth = dayjs().tz(book.owner.timezone).startOf('month').subtract(1, 'month')
  const thisMonth = dayjs().tz(book.owner.timezone).startOf('month')
  const nextMonth = dayjs().tz(book.owner.timezone).startOf('month').add(1, 'month')

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

  await bot.sendMessage(userId, `<i>Generando resumen de ${dayjs(query.data).tz(book.owner.timezone).format('MMMM YYYY')}</i>`, {
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

  const monthTZStart = dayjs(monthYear).tz(book.owner.timezone).startOf('month')
  const monthTZEnd = dayjs(monthYear).tz(book.owner.timezone).endOf('month')

  const incomes = await prisma.income.findMany({
    where: {
      bookId: book.id,
    },
    include: {
      salary: {
        where: {
          validFrom: {
            lte: monthTZStart.format()
          }
        },
        include: {
          amount: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      },
    }
  })

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
            lte: monthTZStart.format()
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
            gte: monthTZStart.format(),
            lte: monthTZEnd.format()
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
        gte: monthTZStart.format(),
        lte: monthTZEnd.format()
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
        lte: monthTZStart.format()
      }
    }
  })

  const noCategoryExpenses: CategoryWithLimitsAndExpenses = {
    description: 'Sin Categoría',
    limits: [],
    expenses: expensesWithNoCategory,
    bookId: book.id,
    isPayment: false,
    createdAt: dayjs().utc().toDate(),
    updatedAt: dayjs().utc().toDate(),
    id: 0
  }

  const allCategories = [...(expensesWithNoCategory.length > 0 ? [noCategoryExpenses] : []), ...categories]

  const categoriesSummary: TableCell[][] = allCategories.filter(c => !c.isPayment).map(cat => {
    const hasLimit = cat.limits.length > 0 && cat.limits[0].amount.amount > 0
    const description = `${cat.description.replace(regex, '').trim()}${hasLimit ? (cat.limits[0].ignoreInBudget ? ' *' : '') : ''}`

    const expensesWithCurrencies: Record<string, number> = cat.expenses.reduce((accumulator, exp) => {
      const currency = exp.amount.currency
      const amount = exp.amount.amount
      const isIncome = exp.isIncome

      return {
        ...accumulator,
        [currency]: (accumulator[currency] || 0) + (isIncome ? -amount : amount)
      }
    }, {} as Record<string, number>)

    const expensesString = Object.keys(expensesWithCurrencies).map(currency => {
      const amount = expensesWithCurrencies[currency]
      return `${numeral(amount).format('0,0.00')} ${currency}`
    })

    const limit = hasLimit && `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}`
    const limitCurrency = hasLimit ? cat.limits[0].amount.currency : ''

    const totalInLimitCurrency: number = hasLimit ? cat.expenses.reduce((accumulator, exp) => {
      const currency = exp.amount.currency
      const amount = exp.amount.amount

      const exchangeRate = exchangeRates.find(rate => rate.to === limitCurrency && rate.from === currency)?.amount || 1
      return accumulator + (amount * exchangeRate)
    }, 0) : 0

    const hasExceeded = hasLimit ? totalInLimitCurrency > cat.limits[0].amount.amount : false

    const limitSumTable = hasLimit ? [{
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
      }
    }] : []

    return [
      {
        text: [description, { text: hasExceeded ? '\nLimite excedido' : '', bold: true, color: 'red' }],
      },
      {
        layout: 'noBorders',
        table: {
          widths: ['*'],
          body: [
            ...(expensesString.length > 0 ? expensesString.map(exp => [exp]) : [['No hay gastos registrados']]),
            ...(hasLimit ? [limitSumTable] : []),
          ],
        }
      }
    ]
  })

  const paymentsSummary: TableCell[][] = categories.filter(c => c.isPayment).map(cat => {
    const hasLimit = cat.limits.length > 0 && cat.limits[0].amount.amount > 0
    const description = `${cat.description.replace(regex, '').trim()}${hasLimit ? (cat.limits[0].ignoreInBudget ? ' *' : '') : ''}`

    const expensesWithCurrencies: Record<string, number> = cat.expenses.reduce((accumulator, exp) => {
      const currency = exp.amount.currency
      const amount = exp.amount.amount
      const isIncome = exp.isIncome

      return {
        ...accumulator,
        [currency]: (accumulator[currency] || 0) + (isIncome ? -amount : amount)
      }
    }, {} as Record<string, number>)

    const expensesString = Object.keys(expensesWithCurrencies).map(currency => {
      const amount = expensesWithCurrencies[currency]
      return `${numeral(amount).format('0,0.00')} ${currency}`
    })

    const limit = hasLimit && `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}`
    const limitCurrency = hasLimit ? cat.limits[0].amount.currency : ''

    const totalInLimitCurrency: number = hasLimit ? cat.expenses.reduce((accumulator, exp) => {
      const currency = exp.amount.currency
      const amount = exp.amount.amount

      const exchangeRate = exchangeRates.find(rate => rate.to === limitCurrency && rate.from === currency)?.amount || 1
      return accumulator + (amount * exchangeRate)
    }, 0) : 0

    const hasPaid = hasLimit ? totalInLimitCurrency >= cat.limits[0].amount.amount * 0.65 : false
    const hasExceeded = hasLimit ? totalInLimitCurrency > cat.limits[0].amount.amount : false

    const limitSumTable = hasLimit ? [{
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
      }
    }] : []

    return [
      {
        text: [description, { text: !hasLimit ? '' : (hasExceeded ? '\nPago de mas' : (hasPaid ? '\nPagado' : '\nSin pagar')), bold: true, color: hasExceeded || !hasPaid ? 'red' : 'green' }],
      },
      {
        layout: 'noBorders',
        table: {
          widths: ['*'],
          body: [
            ...(expensesString.length > 0 ? expensesString.map(exp => [exp]) : [['No hay pagos registrados']]),
            ...(hasLimit ? [limitSumTable] : []),
          ],
        }
      }
    ]
  })

  const incomeSummary: TableCell[][] = incomes.map(inc => {
    const description = inc.description.replace(regex, '').trim()
    const hasSalary = inc.salary.length > 0

    if (!hasSalary) {
      return [
        description, 'No hay salario registrado'
      ]
    }

    const salary = inc.salary[0].amount

    return [
      description,
      `${numeral(salary.amount).format('0,0.00')} ${salary.currency}`
    ]
  })

  const byCurrencyExpenses = allCategories.reduce((accumulator, cat) => {
    if (cat.limits.length > 0 && cat.limits[0].amount.amount > 0 && cat.limits[0].ignoreInBudget) return accumulator

    const expenses = cat.expenses.reduce((acc, exp) => {
      return { ...acc, [exp.amount.currency]: (acc[exp.amount.currency] || 0) + (exp.isIncome ? -exp.amount.amount : exp.amount.amount) }
    }, {} as Record<string, number>)

    const newAccumulator = Object.keys(expenses).reduce((acc, currency) => {
      return { ...acc, [currency]: (acc[currency] || 0) + expenses[currency] }
    }, accumulator)

    return { ...accumulator, ...newAccumulator }
  }, {} as Record<string, number>)

  const byCurrencyLimits = allCategories.reduce((accumulator, cat) => {
    if (cat.limits.length === 0) return accumulator
    if (cat.limits[0].amount.amount === 0) return accumulator
    if (cat.limits[0].ignoreInBudget) return accumulator

    const limit = cat.limits[0].amount

    return { ...accumulator, [limit.currency]: (accumulator[limit.currency] || 0) + limit.amount }
  }, {} as Record<string, number>)

  const byCurrencyIncomes = incomes.reduce((accumulator, inc) => {
    if (inc.salary.length === 0) return accumulator

    const salary = inc.salary[0].amount
    return { ...accumulator, [salary.currency]: (accumulator[salary.currency] || 0) + salary.amount }
  }, {} as Record<string, number>)

  const allCoins = [...Object.keys(byCurrencyLimits), ...Object.keys(byCurrencyIncomes), ...Object.keys(byCurrencyExpenses)].filter((value, index, self) => self.indexOf(value) === index)

  const budgetSummary: TableCell[][] = allCoins.map(coin => {
    const income = Object.keys(byCurrencyIncomes).reduce((accumulator, inc) => {
      const currency = inc
      const amount = byCurrencyIncomes[inc]

      const exchangeRate = exchangeRates.find(rate => rate.to === coin && rate.from === currency)?.amount || 1
      return accumulator + (amount * exchangeRate)
    }, 0)

    const limits = Object.keys(byCurrencyLimits).reduce((accumulator, inc) => {
      const currency = inc
      const amount = byCurrencyLimits[inc]

      const exchangeRate = exchangeRates.find(rate => rate.to === coin && rate.from === currency)?.amount || 1
      return accumulator + (amount * exchangeRate)
    }, 0)

    const totalBudget = income - limits
    return [
      [{ text: coin, bold: true, colSpan: 2, style: { fillColor: '#d3d3d3' } }, {}],
      ['Ingresos (+)', `${numeral(income).format('0,0.00')} ${coin}`],
      ['Limites y Pagos Fijos (-)', `${numeral(limits).format('0,0.00')} ${coin}`],
      [{ text: `Disponible`, bold: true }, { text: `${numeral(totalBudget).format('0,0.00')} ${coin}`, bold: true, style: {} }],
    ]
  }).reduce((acc, curr) => [...acc, ...curr], [])

  const expensesListSummary: TableCell[][] = allCategories.map(cat => {
    const hasLimit = cat.limits.length > 0 && cat.limits[0].amount.amount > 0
    const description = cat.description.replace(regex, '').trim() + (hasLimit ? (cat.limits[0].ignoreInBudget ? ' *' : '') : '')

    return [{
      font: 'RobotoMono',
      layout: 'lightHorizontalLines',
      colSpan: 2,
      table: {
        dontBreakRows: true,
        widths: ['*', '*'],
        body: [
          [{ text: description, bold: true, colSpan: 2, style: { fillColor: '#d3d3d3' } }, {}],
          [
            { text: 'Descripción', bold: true, style: { fillColor: '#f2f2f2' } },
            { text: 'Monto', bold: true, style: { fillColor: '#f2f2f2' } }
          ],
          ...(cat.expenses.length > 0 ? cat.expenses.map(exp => {
            const currency = exp.amount.currency
            const amount = exp.amount.amount
            const date = dayjs(exp.createdAt).tz(book.owner.timezone).format('LL hh:mma')
            const account = exp.account.description.replace(regex, '').trim()
            const description = exp.description.replace(regex, '').trim()
            const isIncome = exp.isIncome ? ' (Ingreso)' : ''

            return [{
              text: [description, { text: `\n${date}\n${account}`, italics: true, fontSize: 10, color: '#666666' }],
            }, { text: `${numeral(amount).format('0,0.00')} ${currency}${isIncome}`, bold: isIncome }]
          }) : [[{ text: 'No hay gastos registrados', colSpan: 2, alignment: 'center' }, {}]])
        ]
      }
    },
    {}]
  })

  const expesesSummary: TableCell[][] = allCoins.map(coin => {
    const income = Object.keys(byCurrencyIncomes).reduce((accumulator, inc) => {
      const currency = inc
      const amount = byCurrencyIncomes[inc]

      const exchangeRate = exchangeRates.find(rate => rate.to === coin && rate.from === currency)?.amount || 1
      return accumulator + (amount * exchangeRate)
    }, 0)

    const expenses = Object.keys(byCurrencyExpenses).reduce((accumulator, inc) => {
      const currency = inc
      const amount = byCurrencyExpenses[inc]

      const exchangeRate = exchangeRates.find(rate => rate.to === coin && rate.from === currency)?.amount || 1
      return accumulator + (amount * exchangeRate)
    }, 0)

    const savings = income - expenses

    return [
      [{ text: coin, bold: true, colSpan: 2, style: { fillColor: '#d3d3d3' } }, {}],
      ['Ingresos (+)', `${numeral(income).format('0,0.00')} ${coin}`],
      ['Gastos (-)', `${numeral(expenses).format('0,0.00')} ${coin}`],
      [{ text: `Ahorro`, bold: true }, { text: `${numeral(savings).format('0,0.00')} ${coin}`, bold: true, style: {} }],
    ]
  }).reduce((acc, curr) => [...acc, ...curr], [])

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
        marginBottom: 5,
        alignment: 'center',
        text: `Resumen de ${monthTZStart.format('MMMM YYYY')}`
      },
      {
        font: 'Roboto',
        fontSize: 16,
        marginBottom: 20,
        alignment: 'left',
        text: `${book.title.replace(regex, '')}\nGenerado el ${monthTZStart.tz(book.owner.timezone).format('LL hh:mma')}`
      },
      {
        marginBottom: 20,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'PRESUPUESTO POR MONEDA CON CAMBIO', bold: true, colSpan: 2, alignment: 'center' },
              {}
            ],
            [
              { text: 'Asegurarse de tener los cambios de moneda establecidos para tener los valores convertidos correctamente. Utiliza /cambio para configurarlos.', fontSize: 10, italics: true, colSpan: 2, alignment: 'left' },
              {}
            ],
            ...budgetSummary,
            [
              { text: 'NOTA: Las categorías/pagos fijos con * no fueron sumadas en este total.', colSpan: 2, alignment: 'left', italics: true, fontSize: 10 }, {}
            ]
          ]
        }
      },
      {
        marginBottom: 10,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Categorías', bold: true, colSpan: 2, alignment: 'center' },
              {}
            ],
            [
              { text: 'Categoría', bold: true, style: { fillColor: '#d3d3d3' } },
              { text: 'Gastos por moneda / Limite', bold: true, style: { fillColor: '#d3d3d3' } }
            ],
            ...(categoriesSummary.length > 0 ? categoriesSummary : [[{ text: 'No hay categorías registradas', colSpan: 2, alignment: 'center' }, {}]]),
            [
              { text: '* Ignorado en el total del presupuesto por moneda.', colSpan: 2, alignment: 'left', italics: true, fontSize: 10 }, {}
            ]
          ]
        }
      },
      {
        marginBottom: 10,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Pagos Fijos', bold: true, colSpan: 2, alignment: 'center' },
              {}
            ],
            [
              { text: 'Descripción', bold: true, style: { fillColor: '#d3d3d3' } },
              { text: 'Pagos por moneda / Deuda', bold: true, style: { fillColor: '#d3d3d3' } }
            ],
            ...(paymentsSummary.length > 0 ? paymentsSummary : [[{ text: 'No hay pagos registrados', colSpan: 2, alignment: 'center' }, {}]]),
            [
              { text: '* Ignorado en el total del presupuesto por moneda.', colSpan: 2, alignment: 'left', italics: true, fontSize: 10 }, {}
            ]
          ]
        }
      },
      {
        marginBottom: 20,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Ingresos', bold: true, colSpan: 2, alignment: 'center' },
              {}
            ],
            [
              { text: 'Descripción', bold: true, style: { fillColor: '#d3d3d3' } },
              { text: 'Salario', bold: true, style: { fillColor: '#d3d3d3' } }
            ],
            ...(incomeSummary.length > 0 ? incomeSummary : [[{ text: 'No hay ingresos registrados', colSpan: 2, alignment: 'center' }, {}]])
          ]
        }
      },
      {
        marginBottom: 20,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Gastos por Categoría', bold: true, colSpan: 2, alignment: 'center' },
              {}
            ],
            ...(expensesListSummary.length > 0 ? expensesListSummary : [[{ text: 'No hay gastos registrados', colSpan: 2, alignment: 'center' }, {}]]),
            [
              { text: '* Ignorado en el total de gastos por moneda.', colSpan: 2, alignment: 'left', italics: true, fontSize: 10 }, {}
            ]
          ]
        }
      },
      {
        marginBottom: 10,
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        unbreakable: true,
        table: {
          dontBreakRows: true,
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'TOTAL DE GASTOS POR MONEDA CON CAMBIO', bold: true, colSpan: 2, alignment: 'center' },
              {}
            ],
            [
              { text: 'Asegurarse de tener los cambios de moneda establecidos para tener los valores convertidos correctamente. Utiliza /cambio para configurarlos.', fontSize: 10, italics: true, colSpan: 2, alignment: 'left' },
              {}
            ],
            ...expesesSummary,
            [
              { text: 'NOTA: Los gastos con  categorías con * no fueron sumadas en este total.', colSpan: 2, alignment: 'left', italics: true, fontSize: 10 }, {}
            ]
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

    await bot.sendDocument(userId, buffer, {}, { filename: `${monthTZStart.format('MMMM YYYY')} Resumen.pdf`, contentType: 'application/pdf' })
    fs.unlink(filepath, () => { })
  })
}

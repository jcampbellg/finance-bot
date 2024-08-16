import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import sendPDF from '@utils/sendPDF'
import xprisma from '@utils/xprisma'
import numeral from 'numeral'
import { TDocumentDefinitions } from 'pdfmake/interfaces'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import parseEmoji from '@utils/parseEmoji'
import { FILL_COLOR, LABEL_COLOR } from '@utils/constant'
import { table } from 'console'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function pdfCategories(params: ConversationPropsWithBookSelected) {
  const { query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const currencies = await xprisma.account.currencies(user)
  const symbols = currencies.map(a => a.symbol).filter((value, index, self) => self.indexOf(value) === index)

  const empty = symbols.map(() => ({}))
  const widths = symbols.map(() => '*')

  const type = query.data.startsWith('pdf_payments') ? 'PAYMENT' : query.data.startsWith('pdf_incomes') ? 'INCOME' : 'CATEGORY'
  const monthTZStart = query.data.includes('next') ? dayjs().tz(user.timezone).startOf('month').add(1, 'month') : query.data.includes('current') ? dayjs().tz(user.timezone).startOf('month') : dayjs().tz(user.timezone).startOf('month').subtract(1, 'month')
  const monthTZEnd = query.data.includes('next') ? dayjs().tz(user.timezone).endOf('month').add(1, 'month') : query.data.includes('current') ? dayjs().tz(user.timezone).endOf('month') : dayjs().tz(user.timezone).endOf('month').subtract(1, 'month')

  const categories = await xprisma.category.findManyPDF(user, type, monthTZStart, monthTZEnd)

  const header = (type === 'PAYMENT' ? 'Transacciones por Pagos Fijos' : type === 'INCOME' ? 'Transacciones por Ingresos' : 'Transacciones por Categorias')
  const filename = type === 'PAYMENT' ? 'Pagos Fijos ' : type === 'INCOME' ? 'Ingresos ' : 'Categorias '

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        text: `${filename} ${monthTZStart.format('MMMM YYYY')}`,
        marginBottom: 10,
      },
      {
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['auto', ...widths],
          body: [
            [
              { text: `Resumen de ${filename}`, bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: FILL_COLOR },
              ...symbols.map(s => ({ bold: true, text: s, alignment: 'right', fillColor: FILL_COLOR }))
            ],
            ...categories.map(c => {
              return [
                parseEmoji(c.description),
                ...symbols.map(s => {
                  const limit = c.limits.find(l => l.currency === s)
                  return [
                    { text: numeral(c.totals[s] || 0).format('0,0.00'), alignment: 'right' },
                    ...(!!limit ? [{ text: `${numeral(limit.amount).format('0,0.00')}`, alignment: 'right', bold: true }] : [{}])
                  ]
                })
              ]
            })
          ]
        }
      },
      {
        pageBreak: 'before',
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['auto', ...widths],
          body: [
            [
              { text: header, bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: FILL_COLOR },
              ...symbols.map(s => ({ bold: true, text: s, alignment: 'right', fillColor: FILL_COLOR }))
            ],
            ...categories.map(c => {
              const transactions = c.transactions.map(t => {
                const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'
                const spanishDate = dayjs(isNormal ? t.paidAt : t.createdAt).tz(user.timezone).format('D MMM YY')

                return [
                  [
                    { ...parseEmoji(t.description), fillColor: FILL_COLOR, marginLeft: 10 },
                    { text: spanishDate, alignment: 'left', color: LABEL_COLOR }
                  ],
                  ...symbols.map(s => {
                    const isMatch = t.currency === s
                    return { text: isMatch ? numeral(t.amount).format('0,0.00') : '-', alignment: 'right' }
                  })
                ]
              })

              return [
                [
                  { ...parseEmoji(c.description), marginLeft: 10, bold: true, fillColor: FILL_COLOR },
                  ...symbols.map(s => {
                    const limit = c.limits.find(l => l.currency === s)
                    return [
                      { text: numeral(c.totals[s] || 0).format('0,0.00'), alignment: 'right', fillColor: FILL_COLOR },
                      ...(!!limit ? [{ text: `${numeral(limit.amount).format('0,0.00')}`, alignment: 'right', bold: true, fillColor: FILL_COLOR }] : [{}])
                    ]
                  })
                ],
                ...transactions,
                ...(transactions.length === 0 ? [[
                  { text: 'No se encontraron transacciones', italic: true, colSpan: symbols.length + 1, alignment: 'center' },
                  ...empty
                ]] : [])
              ]
            }).reduce((pv, v) => ([...pv, ...v]), [])
            // })
          ]
        }
      }
    ]
  }

  const jsonDD = JSON.stringify(docDefinition, null, 2)

  require('child_process').spawn('clip').stdin.end(jsonDD)

  await sendPDF(filename + monthTZStart.format('MMMM YYYY'), params, docDefinition)
}
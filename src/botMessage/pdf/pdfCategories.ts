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
  const monthTZStart = query.data.includes('current') ? dayjs().tz(user.timezone).startOf('month') : dayjs().tz(user.timezone).startOf('month').subtract(1, 'month')
  const monthTZEnd = query.data.includes('current') ? dayjs().tz(user.timezone).endOf('month') : dayjs().tz(user.timezone).endOf('month').subtract(1, 'month')

  const payments = await xprisma.category.findManyPDF(user, type, monthTZStart, monthTZEnd)

  const header = type === 'PAYMENT' ? 'Transacciones por Pagos Fijos' : type === 'INCOME' ? 'Transacciones por Ingresos' : 'Transacciones por Categorias'
  const filename = type === 'PAYMENT' ? 'Pagos Fijos ' : type === 'INCOME' ? 'Ingresos ' : 'Categorias '

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
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
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: '#d3d3d3' },
              ...symbols.map(s => ({ bold: true, text: s, alignment: 'right', fillColor: '#d3d3d3' }))
            ],
            ...payments.map(p => {
              const transactions = p.transactions.map(t => {
                const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'
                const spanishDate = dayjs(isNormal ? t.paidAt : t.createdAt).tz(user.timezone).format('D MMM YY')

                return [
                  [{ ...t.parsedDescription, font: 'RobotoMono' }, { text: spanishDate, alignment: 'left', color: '#5e5e5e' }],
                  ...symbols.map(s => {
                    const isMatch = t.currency === s
                    return { text: isMatch ? numeral(t.amount).format('0,0.00') : 'N/A', alignment: 'right' }
                  })
                ]
              })

              return [
                [
                  { ...p.parsedDescription, font: 'RobotoMono', fillColor: '#d3d3d3', marginLeft: 10 },
                  // { text: p.description, fillColor: '#d3d3d3', margin: [10, 0] },
                  ...symbols.map(s => {
                    const limit = p.limits.find(l => l.currency === s)
                    const limitAmount = !!limit ? ` / ${numeral(limit.amount).format('0,0.00')}` : ''
                    return { text: numeral(p.totals[s] || 0).format('0,0.00') + limitAmount, bold: true, fillColor: '#d3d3d3', alignment: 'right' }
                  })
                ],
                ...transactions,
                ...(transactions.length === 0 ? [[
                  { text: 'No se encontraron transacciones', italic: true, colSpan: symbols.length + 1, alignment: 'center' },
                  ...empty
                ]] : [])
              ]
            }).reduce((pv, v) => ([...pv, ...v]), [])
          ]
        }
      }
    ]
  }

  await sendPDF(filename + monthTZEnd.format('MMMM YYYY'), params, docDefinition)
}
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import sendPDF from '@utils/sendPDF'
import xprisma from '@utils/xprisma'
import numeral from 'numeral'
import { TDocumentDefinitions } from 'pdfmake/interfaces'

export default async function pdfPayments(params: ConversationPropsWithBookSelected) {
  const { query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const currencies = await xprisma.account.currencies(user)
  const symbols = currencies.map(a => a.symbol).filter((value, index, self) => self.indexOf(value) === index)

  const empty = symbols.map(() => ({}))
  const widths = symbols.map(() => '*')

  const payments = await xprisma.category.findManyPDF(user, 'PAYMENT')

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
              { text: 'Transacciones por Pagos Fijos', bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: '#d3d3d3' },
              ...symbols.map(s => ({ text: s, alignment: 'right', fillColor: '#d3d3d3' }))
            ],
            ...payments.map(p => {
              const transactions = p.transactions.map(t => {
                return [
                  { ...t.parsedDescription, font: 'RobotoMono' },
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
                  ...symbols.map(s => ({ text: numeral(p.totals[s] || 0).format('0,0.00'), bold: true, fillColor: '#d3d3d3', alignment: 'right' }))
                ],
                ...transactions,
                ...(transactions.length === 0 ? [[
                  { text: 'No se encontraron transacciones', colSpan: symbols.length + 1, alignment: 'center' },
                  ...empty
                ]] : [])
              ]
            }).reduce((pv, v) => ([...pv, ...v]), [])
          ]
        }
      }
    ]
  }

  await sendPDF('Test', params, docDefinition)
}
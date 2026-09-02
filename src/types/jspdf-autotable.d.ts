import 'jspdf'

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

declare module 'jspdf-autotable' {
  interface UserOptions {
    startY?: number
    head?: any[][]
    body?: any[][]
    styles?: any
    headStyles?: any
    theme?: string
  }

  function autoTable(doc: any, options: UserOptions): void
  export default autoTable
}

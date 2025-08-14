import { useEffect, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from "@/components/ui/button"

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

function App() {
  const [pdfText, setPdfText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch the PDF file from the public directory
        const response = await fetch('/pdf/ternakan.pdf')
        if (!response.ok) {
          throw new Error('Failed to fetch PDF file')
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const pdf = await pdfjs.getDocument(arrayBuffer).promise
        
        let fullText = ''
        
        // Extract text from each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          const pageText = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
          fullText += pageText + '\n'
        }
        
        setPdfText(fullText)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while loading the PDF')
        console.error('Error loading PDF:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadPdf()
  }, [])

  if (loading) {
    return <div>Loading PDF...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>PDF Content</h1>
      <Button>Test</Button>
      <div className='text-red-500'>
        {pdfText || 'No text found in PDF'}
      </div>
    </div>
  )
}

export default App

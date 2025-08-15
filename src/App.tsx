import { useEffect, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import OpenAI from "openai";

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PageText {
  pageNumber: number
  text: string
}

function App() {
  const [pageTexts, setPageTexts] = useState<PageText[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startPage, setStartPage] = useState<string>('')
  const [endPage, setEndPage] = useState<string>('')
  const [totalPages, setTotalPages] = useState<number>(0)
  
  const API_KEY=import.meta.env.VITE_GROQ_API_KEY;

  // Initialize OpenAI client
  const client = new OpenAI({
    apiKey: API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    dangerouslyAllowBrowser: true,
  });

  const response = client.responses.create({
    model: "openai/gpt-oss-20b",
    input: "Tell me a fun fact about the moon in one sentence.",
  });

  // Load PDF metadata to get total pages
  useEffect(() => {
    console.log("API_KEY: ",API_KEY)
    const loadPdfMetadata = async () => {
      try {
        const response = await fetch('/pdf/ternakan.pdf')
        if (!response.ok) {
          throw new Error('Failed to fetch PDF file')
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const pdf = await pdfjs.getDocument(arrayBuffer).promise
        setTotalPages(pdf.numPages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while loading the PDF')
        console.error('Error loading PDF:', err)
      }
    }
    
    loadPdfMetadata()
  }, [])

  const extractPagesText = async () => {
    try {
      setLoading(true)
      setError(null)
      setPageTexts([])
      
      const start = parseInt(startPage) || 1
      const end = endPage ? parseInt(endPage) : start
      
      // Validation
      if (start < 1 || start > totalPages) {
        throw new Error(`Start page must be between 1 and ${totalPages}`)
      }
      if (end < start || end > totalPages) {
        throw new Error(`End page must be between ${start} and ${totalPages}`)
      }
      
      // Fetch the PDF file from the public directory
      const response = await fetch('/pdf/ternakan.pdf')
      if (!response.ok) {
        throw new Error('Failed to fetch PDF file')
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const pdf = await pdfjs.getDocument(arrayBuffer).promise
      
      const extractedPages: PageText[] = []
      
      // Extract text from specified pages
      for (let pageNum = start; pageNum <= end; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        
        extractedPages.push({
          pageNumber: pageNum,
          text: pageText
        })
      }
      
      setPageTexts(extractedPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while extracting pages')
      console.error('Error extracting pages:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">PDF Page Extractor</CardTitle>
            <p className="text-gray-600 text-center">
              Extract text from specific pages of your PDF document
            </p>
          </CardHeader>
          <CardContent>
            {totalPages > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  📄 Total pages in PDF: <span className="font-semibold">{totalPages}</span>
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Label htmlFor="startPage" className="text-sm font-medium">
                  Start Page
                </Label>
                <Input
                  id="startPage"
                  type="number"
                  placeholder="e.g., 71"
                  value={startPage}
                  onChange={(e) => setStartPage(e.target.value)}
                  min="1"
                  max={totalPages}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endPage" className="text-sm font-medium">
                  End Page (optional - leave empty for single page)
                </Label>
                <Input
                  id="endPage"
                  type="number"
                  placeholder="e.g., 72"
                  value={endPage}
                  onChange={(e) => setEndPage(e.target.value)}
                  min="1"
                  max={totalPages}
                  className="mt-1"
                />
              </div>
            </div>

            <Button 
              onClick={extractPagesText} 
              disabled={loading || !startPage || totalPages === 0}
              className="w-full"
            >
              {loading ? 'Extracting...' : 'Extract Text'}
            </Button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">❌ {error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {pageTexts.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Extracted Content</h2>
            {pageTexts.map((pageData, index) => (
              <Card key={pageData.pageNumber}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    📄 Page {pageData.pageNumber}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                      {pageData.text || 'No text found on this page'}
                    </pre>
                  </div>
                </CardContent>
                {index < pageTexts.length - 1 && <Separator className="my-4" />}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

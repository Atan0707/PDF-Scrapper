import { useEffect, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import OpenAI from "openai"
import { PDF_EXTRACTION_PROMPT } from "./prompt"

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PageText {
  pageNumber: number
  text: string
}

interface ExtractedData {
  title: string
  year: string
  source: string
  livestock_types: string[]
  summary: {
    jumlah: Record<string, number>
    pertubuhan: Record<string, number>
    individu: Record<string, number>
  }
  states: Record<string, Record<string, {
    individu: number
    pertubuhan: number
  }>>
}

function App() {
  const [pageTexts, setPageTexts] = useState<PageText[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startPage, setStartPage] = useState<string>('')
  const [endPage] = useState<string>('')
  const [totalPages, setTotalPages] = useState<number>(0)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [processingWithAI, setProcessingWithAI] = useState(false)
  
  const API_KEY=import.meta.env.VITE_GROQ_API_KEY;

  // Initialize OpenAI client
  const client = new OpenAI({
    apiKey: API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    dangerouslyAllowBrowser: true,
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
  }, [API_KEY])

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

  const processWithAI = async () => {
    if (pageTexts.length === 0) {
      setError('No extracted text available to process')
      return
    }

    try {
      setProcessingWithAI(true)
      setError(null)
      
      // Combine all page texts
      const combinedText = pageTexts.map(page => page.text).join('\n\n')
      
      // Call OpenAI API
      const completion = await client.chat.completions.create({
        model: "openai/gpt-oss-20b", // You can change your model here
        messages: [
          {
            role: "system",
            content: PDF_EXTRACTION_PROMPT // You can custom the prompt on prompt.ts
          },
          {
            role: "user", 
            content: `Please extract and format the following PDF text data:\n\n${combinedText}`
          }
        ],
        temperature: 0.1, // Low temperature for more consistent output
        max_tokens: 4000
      })

      const responseContent = completion.choices[0]?.message?.content
      if (!responseContent) {
        throw new Error('No response from AI')
      }

      // Clean the response content by removing markdown code blocks if present
      let cleanedResponse = responseContent.trim()
      
      // Remove ```json and ``` markers if they exist
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '')
      }
      
      // Parse the JSON response
      const parsedData: ExtractedData = JSON.parse(cleanedResponse.trim())
      setExtractedData(parsedData)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing with AI')
      console.error('Error processing with AI:', err)
    } finally {
      setProcessingWithAI(false)
    }
  }

  const convertToCSV = (data: ExtractedData): string => {
    const lines: string[] = []
    
    // Header with document info
    lines.push(`${data.title}`)
    lines.push(`Tahun: ${data.year}`)
    lines.push(`Sumber: ${data.source}`)
    lines.push(`Jenis Ternakan: ${data.livestock_types.join(', ')}`)
    lines.push('')
    
    // Summary data
    lines.push('Ringkasan Data')
    lines.push('Category,Type,Total,' + data.livestock_types.join(','))
    
    // JUMLAH row
    const jumlahRow = ['JUMLAH', 'Total', data.summary.jumlah.total]
    data.livestock_types.forEach(type => {
      jumlahRow.push(data.summary.jumlah[type] || 0)
    })
    lines.push(jumlahRow.join(','))
    
    // PERTUBUHAN row
    const pertubRows = ['PERTUBUHAN', 'Total', data.summary.pertubuhan.total]
    data.livestock_types.forEach(type => {
      pertubRows.push(data.summary.pertubuhan[type] || 0)
    })
    lines.push(pertubRows.join(','))
    
    // INDIVIDU row
    const individuRow = ['INDIVIDU', 'Total', data.summary.individu.total]
    data.livestock_types.forEach(type => {
      individuRow.push(data.summary.individu[type] || 0)
    })
    lines.push(individuRow.join(','))
    
    lines.push('')
    
    // State-wise data
    lines.push('Data mengikut negeri')
    
    // Create headers for state data
    const stateHeaders = ['State', 'Livestock_Type', 'Category', 'Count']
    lines.push(stateHeaders.join(','))
    
    // Add state data rows
    Object.entries(data.states).forEach(([stateName, stateData]) => {
      data.livestock_types.forEach(livestockType => {
        if (stateData[livestockType]) {
          lines.push([stateName, livestockType, 'individu', stateData[livestockType].individu].join(','))
          lines.push([stateName, livestockType, 'pertubuhan', stateData[livestockType].pertubuhan].join(','))
        }
      })
    })
    
    return lines.join('\n')
  }

  const downloadCSV = () => {
    if (!extractedData) return
    
    const csvContent = convertToCSV(extractedData)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `livestock-data-${extractedData.year}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
                {/* Before this aku buat dia as start page */}
                <Label htmlFor="startPage" className="text-sm font-medium"> 
                  Page 
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
              {/* Last page yang dia nak baca */}
              {/* <div>
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
              </div> */}
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
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Extracted Content</h2>
              <Button 
                onClick={processWithAI}
                disabled={processingWithAI}
                className="bg-green-600 hover:bg-green-700"
              >
                {processingWithAI ? '🤖 Processing...' : '🤖 Format as JSON'}
              </Button>
            </div>

            {extractedData && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    ✨ Formatted JSON Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 p-4 rounded-lg border overflow-auto max-h-96">
                    <pre className="text-green-400 text-sm font-mono leading-relaxed">
                      {JSON.stringify(extractedData, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2))
                      }}
                      variant="outline"
                      size="sm"
                    >
                      📋 Copy JSON
                    </Button>
                    <Button 
                      onClick={() => {
                        const dataStr = JSON.stringify(extractedData, null, 2)
                        const dataBlob = new Blob([dataStr], {type: 'application/json'})
                        const url = URL.createObjectURL(dataBlob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = 'livestock-data.json'
                        link.click()
                        URL.revokeObjectURL(url)
                      }}
                      variant="outline"
                      size="sm"
                    >
                      💾 Download JSON
                    </Button>
                    <Button 
                      onClick={downloadCSV}
                      variant="outline"
                      size="sm"
                      className="bg-green-50 hover:bg-green-100 border-green-300"
                    >
                      📊 Download CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
